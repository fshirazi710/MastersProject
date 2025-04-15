"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
# Signature verification imports
import json
from eth_account.messages import encode_defunct
from eth_account import Account
from web3 import Web3 # Needed for checksum address comparison

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    ShareListSubmitRequest,
    StandardResponse
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

# Renamed function to reflect its purpose (verification + eligibility check)
@router.post("/submit-share/{election_id}")
async def verify_share_submission_request(
    election_id: int, 
    data: ShareListSubmitRequest, # Contains shares, public_key, signature
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
):
    """Verify holder signature and eligibility before frontend submits shares."""
    public_key_input = data.public_key
    # Ensure the input key is checksummed for comparison
    try:
        submitter_address = Web3.to_checksum_address(public_key_input)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid public key format provided.")

    try:
        # --- Eligibility Checks --- 
        is_active = await blockchain_service.is_holder_active(election_id, submitter_address)
        if not is_active:
            raise HTTPException(status_code=403, detail="Public key is not an active holder for this election")

        has_submitted = await blockchain_service.has_holder_submitted(election_id, submitter_address)
        if has_submitted:
             raise HTTPException(status_code=409, detail="Shares already submitted by this holder for this election")

        # --- Signature Verification --- 
        # 1. Reconstruct the message payload exactly as signed by the frontend
        #    Sort shares by vote_id for deterministic payload
        sorted_shares = sorted(data.shares, key=lambda x: x.vote_id)
        vote_indices = [item.vote_id for item in sorted_shares]
        share_strings = [item.share for item in sorted_shares]
        
        # Define the message structure (needs to match frontend signing)
        # Using JSON dumps for lists and f-string for simple structure
        # Consider adding chainId or a nonce for stronger replay protection if needed.
        message_payload = f"SubmitShares:{election_id}:{json.dumps(vote_indices)}:{json.dumps(share_strings)}:{submitter_address}"
        message_hash = encode_defunct(text=message_payload)

        # 2. Recover the signer's address from the signature and message hash
        try:
            recovered_address = Account.recover_message(message_hash, signature=data.signature)
            logger.info(f"Recovered address: {recovered_address}")
            logger.info(f"Submitter address: {submitter_address}")
        except Exception as e:
            # Handle potential exceptions during recovery (e.g., invalid signature format)
            logger.error(f"Signature recovery failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid signature format or recovery failed.")

        # 3. Compare the recovered address with the submitter's address
        if recovered_address.lower() != submitter_address.lower():
            logger.warning(f"Signature verification failed. Expected {submitter_address}, got {recovered_address}")
            raise HTTPException(status_code=403, detail="Signature verification failed. Signer does not match provided public key.")

        logger.info(f"Signature verified successfully for {submitter_address} in election {election_id}.")

        # --- Return Response --- 
        # If verification passes, return success. Frontend will handle tx submission.
        return StandardResponse(
            success=True,
            message="Holder eligibility and signature verified. Proceed with transaction submission."
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error processing share submission request for {submitter_address} in election {election_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during share submission processing")


@router.get("/decryption-status/{election_id}")
async def decryption_status(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    shares = await blockchain_service.call_contract_function("getShares", election_id)
    
    votes = await blockchain_service.call_contract_function("getVotes", election_id)

    logger.info(shares)
    logger.info(votes)
    
    vote_shares = defaultdict(list)
    share_indexes = defaultdict(list)
    
    for vote_id, public_key, share, index in shares:
        vote_shares[vote_id].append(share)
        share_indexes[vote_id].append(index + 1)  # Optional, if you want to shift indexes by 1

    # Sort the shares and indexes for each vote_id based on indexes
    for vote_id in vote_shares:
        sorted_shares_indexes = sorted(zip(share_indexes[vote_id], vote_shares[vote_id]))
        sorted_indexes, sorted_shares = zip(*sorted_shares_indexes)

        share_indexes[vote_id] = list(sorted_indexes)
        vote_shares[vote_id] = list(sorted_shares)


@router.post("/verify", response_model=StandardResponse[ShareVerificationResponse])
async def verify_share(
    request: ShareVerificationRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """Verify a share submission."""
    try:
        # Convert share tuple to list
        share_list = list(request.share)
        is_valid = await blockchain_service.verify_share_submission(
            vote_id=request.vote_id,
            holder_address=request.holder_address,
            share=share_list
        )
        
        return StandardResponse(
            success=True,
            message="Share verification successful" if is_valid else "Share verification failed",
            data=ShareVerificationResponse(
                valid=is_valid,
                holder_address=request.holder_address,
                vote_id=request.vote_id
            )
        )
    except Exception as e:
        logger.error(f"Error verifying share: {str(e)}")
        raise handle_blockchain_error("verify share", e)


@router.get("/get-shares/{election_id}")
async def get_shares(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Call the blockchain service to decrypt the vote
        shares = await blockchain_service.call_contract_function("getShares", election_id)
        
        # Create a dictionary to store the sorted shares and their corresponding indexes for each vote_id
        vote_shares = defaultdict(list)
        share_indexes = defaultdict(list)

        for vote_id, public_key, share, index in shares:
            vote_shares[vote_id].append(share)
            share_indexes[vote_id].append(index + 1)  # Optional, if you want to shift indexes by 1

        # Sort the shares and indexes for each vote_id based on indexes
        for vote_id in vote_shares:
            sorted_shares_indexes = sorted(zip(share_indexes[vote_id], vote_shares[vote_id]))
            sorted_indexes, sorted_shares = zip(*sorted_shares_indexes)

            share_indexes[vote_id] = list(sorted_indexes)
            vote_shares[vote_id] = list(sorted_shares)

        return share_indexes, vote_shares

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting vote: {str(e)}")
        raise handle_blockchain_error("decrypt vote", e)
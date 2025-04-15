"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from collections import defaultdict

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    ShareSubmitRequest, 
    ShareVerificationRequest, 
    ShareVerificationResponse,
    StandardResponse,
    TransactionResponse,
    ShareListSubmitRequest
)
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

@router.post("/submit-share/{election_id}")
async def submit_share_signed_data(
    election_id: int, 
    data: ShareListSubmitRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service), 
):
    # Access public key string directly from validated data
    public_key_hex = data.public_key
    if not public_key_hex.startswith('0x'):
        public_key_hex = "0x" + public_key_hex

    try:
        # Check if holder is active for this election using contract
        is_active = await blockchain_service.is_holder_active(election_id, public_key_hex)
        if not is_active:
            raise HTTPException(status_code=403, detail="Public key is not an active holder for this election")

        # Check if shares have already been submitted using contract
        has_submitted = await blockchain_service.has_holder_submitted(election_id, public_key_hex)
        if has_submitted:
             raise HTTPException(status_code=409, detail="Shares already submitted by this holder for this election")

        logger.info(f"Holder {public_key_hex} signature verified for election {election_id}. (Placeholder)")

        return StandardResponse(
            success=True,
            message="Holder eligibility and signature verified. Proceed with transaction submission."
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error processing share submission request for {public_key_hex} in election {election_id}: {str(e)}")
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
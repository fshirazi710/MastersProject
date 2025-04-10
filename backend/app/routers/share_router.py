"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from collections import defaultdict
import math # Potentially needed if the stored value isn't an integer

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
async def submit_share(
    election_id: int, 
    data: ShareListSubmitRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service), 
    db=Depends(get_db)
):
    # Access public key string directly from validated data
    public_key_hex = data.public_key
    if not public_key_hex.startswith('0x'):
        public_key_hex = "0x" + public_key_hex

    # Check if shares have already been released for this holder
    # Assuming db.public_keys stores info about submitted shares?
    # This check might need adjustment based on your actual DB schema for tracking submissions.
    existing_submission = await db.public_keys.find_one({
        "vote_id": election_id, # Assuming vote_id maps to election_id here?
        "public_key": public_key_hex,
        "released_secret": True # Assuming a field to track share release
    })
    if existing_submission:
         raise HTTPException(status_code=400, detail="secret share has already been released for this election")

    # Prepare data for the contract call
    # The contract function submitShares expects uint256[] voteIndex and string[] shareList
    vote_indices = []
    share_list = []
    for item in data.shares:
        vote_indices.append(item.vote_id)
        share_list.append(item.share) # Assuming item.share is the hex string expected by contract

    if not vote_indices: # Or check if share_list is empty
        raise HTTPException(status_code=400, detail="No shares provided to submit.")

    # --- Prepare Transaction --- 
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

    # Estimate Gas
    # TODO: Verify contract function name is submitShares and parameters match
    estimated_gas = blockchain_service.contract.functions.submitShares(
        election_id,
        vote_indices,    # Use prepared list
        public_key_hex,  # Use holder's public key
        share_list       # Use prepared list
    ).estimate_gas({"from": WALLET_ADDRESS})

    # Build Transaction
    submit_share_tx = blockchain_service.contract.functions.submitShares(
        election_id,
        vote_indices,
        public_key_hex,
        share_list
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    # Sign and send the transaction
    signed_tx = blockchain_service.w3.eth.account.sign_transaction(submit_share_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)

    if receipt.status == 1:
        public_key_input = data.public_key
        public_key_to_query = public_key_input[2:] if public_key_input.startswith('0x') else public_key_input

        # Mark the share as successfully submitted in the database
        # The final reward_token will be updated later when results are finalized
        try:
            filter_criteria = {"public_key": public_key_to_query, "vote_id": election_id}
            # Set a flag indicating successful submission
            update_field = {"$set": {"share_submitted_successfully": True}}
            update_result = await db.public_keys.update_one(filter_criteria, update_field)

            if update_result.matched_count == 0:
                # This case might indicate an issue, as the holder should exist if they are submitting a share.
                logger.warning(f"DB update for share_submitted_successfully flag failed: No document found for pk {public_key_to_query} and vote_id {election_id}")
            elif update_result.modified_count == 0:
                # This might mean the flag was already set, which could be okay or indicate a duplicate submission attempt handling.
                logger.info(f"Share submission flag already set for pk {public_key_to_query} and vote_id {election_id}")
            else:
                logger.info(f"Successfully marked share submission for pk {public_key_to_query} and vote_id {election_id}")

        except Exception as db_err:
            logger.error(f"Database error while setting share submission flag for pk {public_key_to_query}, vote_id {election_id}: {str(db_err)}")
            # Decide if this should prevent the success response. For now, let's still return success but log the error.
            # raise HTTPException(status_code=500, detail="Failed to update share submission status in database")

        return StandardResponse(
            success=True,
            # Updated message to reflect only submission, not reward calculation
            message="Share submitted successfully. Reward will be updated upon election finalization."
        )
    else:
        # Transaction failed
        raise HTTPException(status_code=500, detail="secret share(s) failed to be stored on the blockchain")


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
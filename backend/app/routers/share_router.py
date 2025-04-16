"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
# Import defaultdict
from collections import defaultdict
# Signature verification imports
import json
from eth_account.messages import encode_defunct
from eth_account import Account
from web3 import Web3 # Needed for checksum address comparison
# Import HexBytes from hexbytes library instead of eth_utils
from hexbytes import HexBytes

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    ShareListSubmitRequest,
    StandardResponse,
    ShareVerificationRequest,
    ShareVerificationResponse
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

# Update Route Path and Parameter Name
@router.post("/submit-share/{vote_session_id}", response_model=StandardResponse)
async def submit_share(
    # Rename parameter
    vote_session_id: int, 
    request: ShareListSubmitRequest, # Pydantic model enforces structure
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Verifies a signed share submission request from a holder. 
    The actual share submission transaction is now sent by the frontend.
    """
    logger.info(f"Received share verification request for session {vote_session_id} from {request.public_key}")

    # 1. Basic Input Validation (Pydantic handles most)
    if not request.shares:
        raise HTTPException(status_code=422, detail="Shares list cannot be empty.")
    if not request.signature:
         raise HTTPException(status_code=422, detail="Signature is missing.")

    # 2. Verify Signature
    try:
        # Prepare message payload exactly as signed on frontend
        payload_dict = {
            # Rename key: electionId -> voteSessionId
            "voteSessionId": vote_session_id,
            "shares": [share.model_dump() for share in request.shares], # Use model_dump for consistency
            "publicKey": request.public_key # Address of the submitter
        }
        # Use fast-json-stable-stringify equivalent logic if needed, otherwise standard json dump
        # Assuming standard JSON sorting for now
        message_json = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
        message_hash = encode_defunct(text=message_json)
        
        # Recover address from signature
        recovered_address = Account.recover_message(message_hash, signature=HexBytes(request.signature))
        checksum_recovered_address = blockchain_service.w3.to_checksum_address(recovered_address)
        checksum_request_address = blockchain_service.w3.to_checksum_address(request.public_key)

        # Compare recovered address with the one provided in the request
        if checksum_recovered_address != checksum_request_address:
            logger.warning(f"Signature verification failed for session {vote_session_id}. Recovered: {checksum_recovered_address}, Provided: {checksum_request_address}")
            raise HTTPException(status_code=401, detail="Signature verification failed.")

        logger.info(f"Signature verified successfully for session {vote_session_id}, holder {request.public_key}")

        # 3. Check Contract State (Optional but recommended)
        # Verify the sender is actually an active holder for this session
        is_active = await blockchain_service.is_holder_active(vote_session_id, checksum_request_address)
        if not is_active:
             logger.warning(f"Attempted share submission by non-active holder {request.public_key} for session {vote_session_id}")
             raise HTTPException(status_code=403, detail="Submitter is not an active holder for this vote session.")

        # Optionally check if shares have already been submitted on-chain by this holder
        has_submitted = await blockchain_service.has_holder_submitted_share(vote_session_id, checksum_request_address)
        if has_submitted:
            logger.info(f"Holder {request.public_key} already submitted shares for session {vote_session_id} (on-chain). Allowing verification potentially for resubmission UI.")
            # Decide if this should be an error or just a note
            raise HTTPException(status_code=409, detail="Shares already submitted by this holder on-chain.")

        # Verification successful
        return StandardResponse(
            success=True,
            message="Share submission signature verified successfully."
        )

    except ValueError as ve:
        logger.error(f"Value error during share verification for session {vote_session_id}: {ve}")
        raise HTTPException(status_code=400, detail=f"Invalid data format: {ve}")
    except HTTPException as http_exc: # Re-raise HTTP exceptions
        raise http_exc
    except Exception as e:
        logger.exception(f"Unexpected error verifying share submission for session {vote_session_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during share verification.")


@router.get("/decryption-status/{vote_session_id}")
async def decryption_status(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # TODO: Review the logic of this endpoint. What is its purpose?
    # Does it need both shares and votes? Does it return anything?
    # Rename contract call: getShares -> getEncryptedShares (ASSUMPTION)
    # Rename parameter: election_id -> vote_session_id
    shares = await blockchain_service.call_contract_function("getEncryptedShares", vote_session_id)
    
    # Rename contract call: getVotes -> getEncryptedVotes
    # Rename parameter: election_id -> vote_session_id
    votes = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)

    # Update log message
    logger.info(f"Retrieved shares for session {vote_session_id}: {shares}")
    # Update log message
    logger.info(f"Retrieved votes for session {vote_session_id}: {votes}")
    
    vote_shares = defaultdict(list)
    share_indexes = defaultdict(list)
    
    # Assuming shares tuple structure: (vote_index_within_session, public_key, share_data, holder_index_within_session)
    # Adjust indices if the Share struct in contract is different
    for vote_id, public_key, share, index in shares:
        vote_shares[vote_id].append(share) 
        share_indexes[vote_id].append(index + 1) # Keep original logic of 1-based index?

    # Sort the shares and indexes for each vote_id based on indexes
    for vote_id in vote_shares:
        sorted_shares_indexes = sorted(zip(share_indexes[vote_id], vote_shares[vote_id]))
        # Handle potential empty list after sorting
        if sorted_shares_indexes:
            sorted_indexes, sorted_shares = zip(*sorted_shares_indexes)
            share_indexes[vote_id] = list(sorted_indexes)
            vote_shares[vote_id] = list(sorted_shares)
        else:
            share_indexes[vote_id] = []
            vote_shares[vote_id] = []
    
    # This endpoint currently doesn't return anything explicitly.
    # Consider returning a status based on retrieved data, e.g., using ShareStatusResponse?
    # return { "status": "Processed", "vote_shares_count": len(vote_shares) } # Example return


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


@router.get("/get-shares/{vote_session_id}")
async def get_shares(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # Docstring update
    """Retrieve all submitted shares for a specific vote session, grouped by vote index."""
    try:
        # Rename contract call: getShares -> getEncryptedShares (ASSUMPTION)
        # Rename parameter: election_id -> vote_session_id
        shares_from_chain = await blockchain_service.call_contract_function("getEncryptedShares", vote_session_id)
        
        # Create a dictionary to store the sorted shares and their corresponding indexes for each vote_id
        vote_shares_map = defaultdict(list)
        share_indexes_map = defaultdict(list)
        holder_map = defaultdict(list) # Store holder per share

        # Assuming shares tuple structure: (vote_index_within_session, public_key, share_data, holder_index_within_session)
        # Adjust indices if the Share struct in contract is different
        for vote_index, public_key, share_data, holder_index in shares_from_chain:
            vote_shares_map[vote_index].append(share_data)
            # Store 1-based index corresponding to holder index? Or use holder_index directly?
            share_indexes_map[vote_index].append(holder_index + 1) # Assuming we want 1-based index
            holder_map[vote_index].append(public_key)

        # Prepare response data (e.g., a list of dicts, one per vote_index)
        response_data = []
        # Use the keys from vote_shares_map which represent the vote indices present
        for vote_index in vote_shares_map.keys(): 
             # Sort shares based on holder index for consistent ordering
            sorted_combined = sorted(zip(share_indexes_map[vote_index], vote_shares_map[vote_index], holder_map[vote_index]))
            
            if sorted_combined:
                sorted_indices, sorted_shares, sorted_holders = zip(*sorted_combined)
                # Format shares for the specific vote_index
                formatted_shares = [
                    {"holder_address": holder, "share_index": idx, "share_value": share}
                    for idx, share, holder in zip(sorted_indices, sorted_shares, sorted_holders)
                ]
            else:
                 formatted_shares = []

            response_data.append({
                "vote_index": vote_index,
                "submitted_shares": formatted_shares,
                "count": len(formatted_shares)
            })

        # Sort response data by vote_index for consistency
        response_data.sort(key=lambda x: x['vote_index']) 

        # Consider returning StandardResponse structure?
        # return StandardResponse(success=True, message="Shares retrieved", data=response_data)
        return response_data # Currently returning raw list

    except HTTPException:
        raise
    except Exception as e:
        # Update log message
        logger.error(f"Error getting shares for session {vote_session_id}: {str(e)}")
        # Update detail message
        raise handle_blockchain_error(f"get shares for session {vote_session_id}", e)
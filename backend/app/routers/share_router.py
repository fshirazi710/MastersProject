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
    StandardResponse
)
from app.services.blockchain import BlockchainService

import logging
import asyncio

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
        # --- CORRECTED: Reconstruct message EXACTLY as signed on frontend ---
        # Extract data from the request payload (ShareListSubmitRequest)
        holder_address = request.public_key
        # Sort shares by vote_id to ensure consistent order before stringifying
        # Note: request.shares is already validated by Pydantic
        sorted_shares = sorted(request.shares, key=lambda s: s.vote_id)
        vote_indices = [s.vote_id for s in sorted_shares]
        share_strings = [s.share for s in sorted_shares]
        
        # Use Python's json.dumps for deterministic serialization of the lists, similar to jsonStableStringify
        # Use separators=(',', ':') to remove extra whitespace
        vote_indices_json = json.dumps(vote_indices, separators=(',', ':'))
        share_strings_json = json.dumps(share_strings, separators=(',', ':'))

        # Construct the message string identical to the frontend format
        # Ensure vote_session_id is treated as a string here to match frontend template literal
        message_to_verify = f"SubmitShares:{str(vote_session_id)}:{vote_indices_json}:{share_strings_json}:{holder_address}"
        
        # Log the message being verified for debugging
        logger.debug(f"Verifying signature for message: {message_to_verify}")

        message_hash = encode_defunct(text=message_to_verify)
        # --------------------------------------------------------------------
        
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
        # Verify the sender is actually registered for this session
        is_registered = await blockchain_service.is_participant_registered(vote_session_id, checksum_request_address)
        if not is_registered:
             logger.warning(f"Attempted share verification by non-registered participant {request.public_key} for session {vote_session_id}")
             raise HTTPException(status_code=403, detail="Submitter is not registered for this vote session.")

        # Check if shares have already been submitted on-chain by this holder (checks ParticipantRegistry)
        has_submitted = await blockchain_service.has_participant_submitted_shares(vote_session_id, checksum_request_address)
        if has_submitted:
            logger.info(f"Holder {request.public_key} already submitted shares for session {vote_session_id} (on-chain). Allowing verification potentially for resubmission UI.")
            # If resubmission isn't allowed or needed, treat this as an error:
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


# Endpoint removed as functionality is redundant or unclear
# @router.get("/decryption-status/{vote_session_id}")
# async def decryption_status(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
#     ...

@router.get("/get-shares/{vote_session_id}")
async def get_shares(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve all submitted decryption shares for a specific vote session, grouped by vote index."""
    try:
        # 1. Get VoteSession address
        session_addr, _ = await blockchain_service.get_session_addresses(vote_session_id)
        if not session_addr:
            logger.warning(f"Could not retrieve session address for session ID {vote_session_id}. Assuming session does not exist.")
            raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found or contract addresses missing.")

        # 2. Get VoteSession contract instance
        session_contract = blockchain_service.get_session_contract(session_addr)
        
        # 3. Get the number of submitted shares
        try:
            num_shares = await blockchain_service.call_contract_function(session_contract, "getNumberOfDecryptionShares")
            logger.info(f"Found {num_shares} submitted decryption shares for session {vote_session_id}.")
        except Exception as count_err:
             logger.error(f"Error calling getNumberOfDecryptionShares for session {vote_session_id}: {count_err}")
             # If count fails, we cannot proceed
             raise HTTPException(status_code=500, detail="Failed to retrieve share count from blockchain.")

        # 4. Fetch each share individually
        shares_from_chain = []
        if num_shares > 0:
            fetch_tasks = [
                blockchain_service.call_contract_function(session_contract, "getDecryptionShare", i) 
                for i in range(num_shares)
            ]
            # Use asyncio.gather to fetch shares concurrently
            results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
            
            # Process results, filtering out potential errors
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error fetching decryption share at index {i} for session {vote_session_id}: {result}")
                    # Decide how to handle: skip this share, or raise an error for the whole request?
                    # Let's skip the problematic share for now.
                    continue 
                shares_from_chain.append(result)

        # 5. Process and Format Shares
        vote_shares_map = defaultdict(list)
        share_indexes_map = defaultdict(list)
        holder_map = defaultdict(list) # Store holder per share

        # Structure returned by getDecryptionShare(index):
        # (uint256 voteIndex, address holderAddress, bytes share, uint256 index)
        for share_tuple in shares_from_chain:
            # Unpack tuple (order confirmed by ABI)
            vote_idx_contract, holder_addr_contract, share_bytes_contract, share_idx_contract = share_tuple 
            vote_shares_map[vote_idx_contract].append(share_bytes_contract)
            share_indexes_map[vote_idx_contract].append(share_idx_contract)
            holder_map[vote_idx_contract].append(holder_addr_contract)

        # Prepare response data
        response_data = []
        for vote_index in sorted(vote_shares_map.keys()):
            sorted_combined = sorted(zip(share_indexes_map[vote_index], vote_shares_map[vote_index], holder_map[vote_index]))
            
            formatted_shares = []
            if sorted_combined:
                sorted_indices, sorted_shares_bytes, sorted_holders = zip(*sorted_combined)
                formatted_shares = [
                    {
                        "holder_address": holder,
                        "share_index": idx,
                        "share_value": share.hex() if share else None
                    }
                    for idx, share, holder in zip(sorted_indices, sorted_shares_bytes, sorted_holders)
                ]

            response_data.append({
                "vote_index": vote_index,
                "submitted_shares": formatted_shares,
                "count": len(formatted_shares)
            })

        # 6. Wrap response in StandardResponse
        return StandardResponse(
            success=True, 
            message=f"Successfully retrieved {len(shares_from_chain)} shares for session {vote_session_id}", 
            data=response_data
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.error(f"Error getting shares for session {vote_session_id}: {error_detail}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get shares for session {vote_session_id}: {error_detail}")
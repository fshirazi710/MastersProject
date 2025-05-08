"""
Encrypted Vote router for managing encrypted votes in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from fastapi.responses import JSONResponse

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.schemas import (
    StandardResponse,
)
from app.schemas.encrypted_vote import PublicKeyValidateRequest

from app.services.blockchain import BlockchainService

import logging
import asyncio
import re # Import regex for hex checking
from binascii import unhexlify # Import for hex decoding
from web3.exceptions import ContractLogicError

# Configure logging
logger = logging.getLogger(__name__)

# Update Router Prefix and Tag
router = APIRouter(prefix="/encrypted-votes", tags=["Encrypted Votes"])


@router.post("/validate-public-key", response_model=StandardResponse[bool])
async def validate_public_key(request: PublicKeyValidateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Validates the provided BLS public key format."""
    public_key_hex = request.public_key
    logger.info(f"Validating public key format: {public_key_hex}")

    is_valid_format = False
    try:
        # Basic format check: Starts with '0x', followed by hex characters (adjust length check as needed for BLS keys)
        if isinstance(public_key_hex, str) and public_key_hex.startswith("0x") and len(public_key_hex) > 4 and re.fullmatch(r'0x[0-9a-fA-F]+', public_key_hex):
            is_valid_format = True # Placeholder: Real validation might involve checking against known keys or cryptographic properties
        else:
             logger.warning(f"Invalid format for public key: {public_key_hex}")

    except Exception as e:
        logger.error(f"Error during public key validation for {public_key_hex}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during key validation.")

    if not is_valid_format:
         # Return success=True, but data=False, as the endpoint worked but the key is invalid
         return StandardResponse(success=True, message="Public key format is not valid.", data=False)

    # If format is valid, return success=True and data=True
    # Note: This currently only checks format, not cryptographic validity or existence in a specific context
    return StandardResponse(
        success=True,
        message="Public key format validated successfully.",
        data=True 
    )


@router.post("/info/{vote_session_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_encrypted_vote_info(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve all submitted encrypted vote data for a specific vote session."""
    try:
        # 1. Get VoteSession address and contract instance
        session_addr, _ = await blockchain_service.get_session_addresses(vote_session_id)
        if not session_addr:
            logger.warning(f"Could not retrieve session address for session ID {vote_session_id}. Assuming session does not exist.")
            raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found or contract addresses missing.")
        session_contract = blockchain_service.get_session_contract(session_addr)

        # 2. Get the number of submitted votes
        try:
            num_votes = await blockchain_service.call_contract_function(session_contract, "getNumberOfVotes")
            logger.info(f"Found {num_votes} submitted votes for session {vote_session_id}.")
        except Exception as count_err:
             logger.error(f"Error calling getNumberOfVotes for session {vote_session_id}: {count_err}")
             raise HTTPException(status_code=500, detail="Failed to retrieve vote count from blockchain.")

        # 3. Fetch each vote individually using asyncio.gather
        all_votes_data = []
        if num_votes > 0:
            fetch_tasks = [
                blockchain_service.call_contract_function(session_contract, "getEncryptedVote", i) 
                for i in range(num_votes)
            ]
            results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
            
            for index, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error fetching encrypted vote at index {index} for session {vote_session_id}: {result}")
                    continue # Skip this vote if fetching failed
                
                vote_tuple = result
                # Structure returned by getEncryptedVote(index):
                # (bytes ciphertext, bytes g1r, bytes g2r, bytes[] alpha, address voter, uint256 threshold)
                # Unpack carefully, ensuring correct indices
                try:
                    ciphertext, g1r, g2r, alpha_bytes_list, voter, threshold = vote_tuple
                    # Convert bytes fields to hex strings for JSON serialization
                    alphas_hex = [a.hex() for a in alpha_bytes_list] if alpha_bytes_list else []
                    all_votes_data.append({
                        "id": vote_session_id, # Keep session id for context?
                        "vote_index": index, # Use the loop index
                        "ciphertext": ciphertext.hex() if ciphertext else None,
                        "g1r": g1r.hex() if g1r else None,
                        "g2r": g2r.hex() if g2r else None,
                        "alphas": alphas_hex,
                        "voter": voter, # Already checksummed address from contract
                        "threshold": threshold
                    })
                except (ValueError, IndexError, TypeError) as unpack_err:
                     logger.error(f"Error unpacking/processing vote tuple at index {index} for session {vote_session_id}: {unpack_err}. Tuple: {vote_tuple}")
                     # Skip malformed tuple
                     continue

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {len(all_votes_data)} encrypted vote(s) for session {vote_session_id}",
            data=all_votes_data
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.error(f"Error getting encrypted vote information for session {vote_session_id}: {error_detail}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get encrypted vote information: {error_detail}")


@router.post("/eligibility/{vote_session_id}", response_model=StandardResponse)
async def check_vote_eligibility(
    vote_session_id: int, 
    request: dict, # Reuse existing dict or define specific EligibilityCheckRequest schema?
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Checks if a voter is eligible to submit an encrypted vote to the specified vote session.
    Does NOT submit the vote transaction; that must be done by the voter on the frontend.
    Requires 'voter_address' in the request body.
    """
    
    # --- Validate Voter Address --- 
    voter_address_str = request.get("voter_address") # Expect voter address in payload
    if not voter_address_str or not isinstance(voter_address_str, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'voter_address' field (string expected).")
    try:
        voter_address = blockchain_service.w3.to_checksum_address(voter_address_str)
        logger.info(f"Checking vote eligibility for voter {voter_address} in session {vote_session_id}.")
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voter address format.")

    try:
        # 1. Check Session Status
        session_details = await blockchain_service.get_session_details(vote_session_id)
        if not session_details:
             logger.warning(f"Eligibility check failed for {voter_address}: Session {vote_session_id} not found.")
             raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found.")
        
        session_status = session_details.get('status')
        if session_status != "VotingOpen":
            logger.warning(f"Eligibility check failed for {voter_address}: Session {vote_session_id} status is {session_status}, not 'VotingOpen'.")
            raise HTTPException(status_code=400, detail=f"Vote session is not in the voting phase (status: {session_status}).")

        # 2. Check if Voter is Registered
        is_registered = await blockchain_service.is_participant_registered(vote_session_id, voter_address)
        if not is_registered:
            logger.warning(f"Eligibility check failed for {voter_address}: Not registered for session {vote_session_id}.")
            raise HTTPException(status_code=403, detail="Voter is not registered for this vote session.")

        # 3. Check if Voter has Already Voted
        has_voted = await blockchain_service.has_participant_voted(vote_session_id, voter_address)
        if has_voted:
            logger.warning(f"Eligibility check failed for {voter_address}: Already voted in session {vote_session_id}.")
            raise HTTPException(status_code=409, detail="Voter has already cast a vote in this session.")

        # All checks passed
        logger.info(f"Voter {voter_address} is eligible to vote in session {vote_session_id}. Frontend should proceed with transaction.")
        return StandardResponse(
            success=True,
            message="Voter is eligible to cast a vote."
            # No data needed beyond success status
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.exception(f"Unexpected error during vote eligibility check for voter {voter_address} in session {vote_session_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Internal server error during vote eligibility check: {error_detail}")

"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_blockchain_service
from app.helpers.vote_session_helper import get_vote_session_status
from app.schemas import (
    StandardResponse,
    TransactionResponse,
    HolderCountResponse,
    HolderJoinRequest,
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holders", tags=["Holders"])


@router.get("/all/{vote_session_id}")
async def get_all_holders(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve all registered holder addresses for a specific vote session."""
    try:
        # Rename contract call: getHoldersByElection -> getHoldersByVoteSession
        # Rename parameter: election_id -> vote_session_id
        holders = await blockchain_service.call_contract_function("getHoldersByVoteSession", vote_session_id)

        # Return response using StandardResponse
        return StandardResponse(
            success=True,
            # Update message
            message=f"Successfully retrieved all holders for session {vote_session_id}",
            data=holders
        )
    except Exception as e:
        # Update log message
        logger.error(f"Error getting all holders for session {vote_session_id}: {str(e)}")
        # Update detail message
        raise HTTPException(status_code=500, detail=f"failed to retrieve list of all secret holders for session {vote_session_id}")


@router.get("/count/{vote_session_id}", response_model=StandardResponse[HolderCountResponse])
async def get_holder_count(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve the total number of registered holders for a specific vote session."""
    try:
        # Rename contract call: getNumHoldersByElection -> getNumHoldersByVoteSession
        # Rename parameter: election_id -> vote_session_id
        count = await blockchain_service.call_contract_function("getNumHoldersByVoteSession", vote_session_id)
        
        # Return response
        return StandardResponse(
            success=True,
            # Update message
            message=f"Successfully retrieved holder count for session {vote_session_id}",
            data=HolderCountResponse(count=count)
        )
    except Exception as e:
        # Update log message
        logger.error(f"Error getting holder count for session {vote_session_id}: {str(e)}")
        # Update detail message
        raise HTTPException(status_code=500, detail=f"failed to retrieve number of secret holders for session {vote_session_id}")


# Updated endpoint: Checks eligibility, does not submit transaction
@router.post("/join/{vote_session_id}", response_model=StandardResponse)
async def join_vote_session(
    vote_session_id: int,
    data: HolderJoinRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Checks eligibility for a user to join a vote session as a holder.
    The actual joining (contract call with deposit) is done by the frontend.
    """
    # Ensure checksum address
    try:
        user_address = blockchain_service.w3.to_checksum_address(data.user_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user address format provided.")

    logger.info(f"Received request for user {user_address} to join session {vote_session_id}")

    try:
        # 1. Check if session exists and is in 'join' phase
        try:
            # Rename contract call: getElection -> getVoteSession
            # Rename parameter: election_id -> vote_session_id
            session_info = await blockchain_service.call_contract_function("getVoteSession", vote_session_id)
            # Assuming indices 3 and 4 are start/end timestamps
            # Rename helper function: get_election_status -> get_vote_session_status
            session_status = await get_vote_session_status(session_info[3], session_info[4])
            if session_status != "join":
                # Update message
                logger.warning(f"Attempt to join session {vote_session_id} by {user_address} failed: Session status is {session_status}, not 'join'.")
                raise HTTPException(status_code=400, detail=f"Vote session is not in the join phase (status: {session_status}).")
        except Exception as e:
            # Handle potential errors from contract call (e.g., session not found)
            logger.error(f"Error fetching info for session {vote_session_id}: {e}")
            # Update message
            raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found or error retrieving status.")

        # 2. Check if user is already a holder for this session
        # Rename contract call: isHolderActive -> is_holder_active
        is_already_holder = await blockchain_service.is_holder_active(vote_session_id, user_address)
        if is_already_holder:
            logger.warning(f"User {user_address} attempted to join session {vote_session_id} but is already a holder.")
            raise HTTPException(status_code=409, detail="User is already registered as a holder for this vote session.")

        # 3. Eligibility confirmed - Return success
        # Frontend will now proceed with the joinAsHolder transaction
        logger.info(f"User {user_address} is eligible to join session {vote_session_id}. Frontend should proceed with transaction.")
        return StandardResponse(
            success=True,
            # Update message
            message="User is eligible to join the vote session as a holder."
        )

    except HTTPException as http_exc:
        raise http_exc # Re-raise specific HTTP exceptions
    except Exception as e:
        # Update log message
        logger.exception(f"Unexpected error during eligibility check for user {user_address} joining session {vote_session_id}: {e}")
        # Update message
        raise HTTPException(status_code=500, detail="Internal server error during eligibility check.")

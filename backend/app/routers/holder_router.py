"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_blockchain_service
from app.helpers.vote_session_helper import get_vote_session_status
# Import error handling utility
from app.core.error_handling import handle_blockchain_error
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
    """Retrieve all registered holder addresses for a specific vote session from the ParticipantRegistry."""
    try:
        # 1. Get registry address
        _, registry_addr = await blockchain_service.get_session_addresses(vote_session_id)
        if not registry_addr:
            raise ValueError(f"Could not find registry address for session ID {vote_session_id}")

        # 2. Get registry contract instance
        registry_contract = blockchain_service.get_registry_contract(registry_addr)

        # 3. Call getActiveHolders
        holders = await blockchain_service.call_contract_function(registry_contract, "getActiveHolders")

        # Return response using StandardResponse
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved all active holders for session {vote_session_id}",
            data=holders
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error getting all holders for session {vote_session_id}: {str(e)}")
        error_detail = handle_blockchain_error(e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve list of all active holders for session {vote_session_id}: {error_detail}")


@router.get("/count/{vote_session_id}", response_model=StandardResponse[HolderCountResponse])
async def get_holder_count(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve the total number of registered holders for a specific vote session from the ParticipantRegistry."""
    try:
        # 1. Get registry address
        _, registry_addr = await blockchain_service.get_session_addresses(vote_session_id)
        if not registry_addr:
            raise ValueError(f"Could not find registry address for session ID {vote_session_id}")

        # 2. Get registry contract instance
        registry_contract = blockchain_service.get_registry_contract(registry_addr)
        
        # 3. Call getNumberOfActiveHolders
        count = await blockchain_service.call_contract_function(registry_contract, "getNumberOfActiveHolders", vote_session_id)
        
        # Return response
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved active holder count for session {vote_session_id}",
            data=HolderCountResponse(count=count)
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error getting holder count for session {vote_session_id}: {str(e)}")
        error_detail = handle_blockchain_error(e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve number of active holders for session {vote_session_id}: {error_detail}")


# Updated endpoint: Checks eligibility, does not submit transaction
@router.post("/join/{vote_session_id}", response_model=StandardResponse)
async def join_vote_session(
    vote_session_id: int,
    data: HolderJoinRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Checks eligibility for a user to join a vote session as a holder.
    Uses the new ParticipantRegistry and VoteSession contracts.
    The actual joining (contract call with deposit) is done by the frontend.
    """
    try:
        user_address = blockchain_service.w3.to_checksum_address(data.user_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user address format provided.")

    logger.info(f"Checking eligibility for user {user_address} to join session {vote_session_id} as holder.")

    try:
        # 1. Check if session exists and is in 'RegistrationOpen' phase
        session_details = await blockchain_service.get_session_details(vote_session_id)
        if not session_details:
             # Handle case where session doesn't exist (get_session_details might raise or return None)
             logger.warning(f"Attempt to join non-existent session {vote_session_id} by {user_address}")
             raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found.")

        session_status = session_details.get('status')
        if session_status != "RegistrationOpen":
            logger.warning(f"Attempt to join session {vote_session_id} by {user_address} failed: Session status is {session_status}, not 'RegistrationOpen'.")
            raise HTTPException(status_code=400, detail=f"Vote session is not in the registration phase (status: {session_status}).")

        # 2. Check if user is already registered for this session
        is_already_registered = await blockchain_service.is_participant_registered(vote_session_id, user_address)
        if is_already_registered:
            logger.warning(f"User {user_address} attempted to join session {vote_session_id} but is already registered.")
            raise HTTPException(status_code=409, detail="User is already registered for this vote session.")

        # 3. Eligibility confirmed - Return success
        logger.info(f"User {user_address} is eligible to join session {vote_session_id}. Frontend should proceed with transaction.")
        return StandardResponse(
            success=True,
            message="User is eligible to join the vote session as a holder."
        )

    except HTTPException as http_exc:
        raise http_exc # Re-raise specific HTTP exceptions
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.exception(f"Unexpected error during eligibility check for user {user_address} joining session {vote_session_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Internal server error during eligibility check: {error_detail}")

# --- New Endpoint for Participant Details ---

@router.get("/details/{vote_session_id}/{participant_address}", response_model=StandardResponse[dict])
async def get_holder_details(
    vote_session_id: int,
    participant_address: str,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """Retrieve detailed information for a specific participant in a vote session from the ParticipantRegistry."""
    try:
        checksum_address = blockchain_service.w3.to_checksum_address(participant_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid participant address format provided.")
        
    logger.info(f"Fetching details for participant {checksum_address} in session {vote_session_id}.")
    
    try:
        details = await blockchain_service.get_participant_details(vote_session_id, checksum_address)
        
        if not details or not details.get('isRegistered'): # Check if participant exists/is registered
            logger.warning(f"Participant {checksum_address} not found or not registered in session {vote_session_id}.")
            raise HTTPException(status_code=404, detail=f"Participant {checksum_address} not found or not registered in session {vote_session_id}.")

        # Convert amounts back to Ether string for frontend display
        details["depositAmount"] = str(blockchain_service.w3.from_wei(details.get("depositAmount", 0), 'ether'))
        # Note: rewardAmount might not be set until after calculation. Handle potential KeyError or None.
        reward_wei = details.get("rewardAmount") # Access safely
        details["rewardAmount"] = str(blockchain_service.w3.from_wei(reward_wei, 'ether')) if reward_wei is not None else "0.0" # Default to "0.0" if not set

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved details for participant {checksum_address} in session {vote_session_id}",
            data=details
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.error(f"Error getting details for participant {checksum_address} in session {vote_session_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve participant details: {error_detail}")

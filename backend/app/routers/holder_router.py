"""
Holder router for managing secret holders (participants) in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List # Import List
# Import Motor DB type and dependency
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb_utils import get_mongo_db

from app.core.dependencies import get_blockchain_service # Keep for Wei->Eth conversion
# Remove obsolete import
# from app.helpers.vote_session_helper import get_vote_session_status # Might be obsolete
# Import error handling utility
from app.core.error_handling import handle_blockchain_error
# Update schema imports - remove HolderCountResponse, HolderJoinRequest if not used
from app.schemas import (
    StandardResponse,
    # TransactionResponse, # No longer needed?
    # HolderCountResponse, # REMOVE THIS
    # HolderJoinRequest, # REMOVE THIS TOO
)
# Import new Participant schemas
from app.schemas.participant import ParticipantListItem, ParticipantDetail, ParticipantCacheModel

from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

# Update prefix to reflect participant focus?
router = APIRouter(prefix="/sessions/{vote_session_id}/participants", tags=["Participants"])


# --- Endpoint to get all participants for a session --- 
@router.get("/", response_model=StandardResponse[List[ParticipantListItem]])
async def get_session_participants(
    vote_session_id: int, 
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):
    """Retrieve a list of all participants (holders and potentially voters) for a specific vote session from the cache."""
    try:
        participants_cursor = db.session_participants.find({"session_id": vote_session_id})
        participants_list = []
        async for participant_doc in participants_cursor:
            # Map MongoDB doc to ParticipantListItem Pydantic model
            # Using aliases defined in the schema
            try:
                 api_item = ParticipantListItem.model_validate(participant_doc)
                 participants_list.append(api_item)
            except Exception as validation_error:
                 logger.warning(f"Skipping participant doc due to validation error: {validation_error}. Doc: {participant_doc.get('_id')}")
                 continue
                 
        logger.info(f"Retrieved {len(participants_list)} participants for session {vote_session_id} from cache.")
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {len(participants_list)} participants for session {vote_session_id}",
            data=participants_list
        )
    except Exception as e:
        logger.error(f"Error getting participants for session {vote_session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve participants for session {vote_session_id}: {str(e)}")


# --- Endpoint to get detailed info for a specific participant --- 
# This replaces the old /details/{...}/{...} endpoint
@router.get("/{participant_address}", response_model=StandardResponse[ParticipantDetail])
async def get_participant_detail(
    vote_session_id: int,
    participant_address: str,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    blockchain_service: BlockchainService = Depends(get_blockchain_service) # For Wei->Eth
):
    """Retrieve detailed information for a specific participant in a vote session from the cache."""
    try:
        checksum_address = blockchain_service.w3.to_checksum_address(participant_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid participant address format provided.")
        
    logger.info(f"Fetching details for participant {checksum_address} in session {vote_session_id} from cache.")
    
    try:
        participant_doc = await db.session_participants.find_one({
            "session_id": vote_session_id, 
            "participant_address": checksum_address
        })
        
        if not participant_doc:
            logger.warning(f"Participant {checksum_address} not found in cache for session {vote_session_id}.")
            raise HTTPException(status_code=404, detail=f"Participant {checksum_address} not found in session {vote_session_id} cache.")

        # Convert deposit Wei to Eth string for response
        deposit_eth = "0.0"
        if wei_str := participant_doc.get('deposit_amount_wei'):
             try:
                 deposit_eth = str(blockchain_service.w3.from_wei(int(wei_str), 'ether'))
             except ValueError:
                 logger.warning(f"Could not convert deposit_amount_wei '{wei_str}' to Eth for participant {checksum_address}")
        
        # Add the converted value for the response model 
        participant_doc['deposit_amount_eth'] = deposit_eth 
        
        # Map MongoDB doc to ParticipantDetail Pydantic model
        try:
            details = ParticipantDetail.model_validate(participant_doc)
        except Exception as validation_error:
            logger.error(f"Pydantic validation failed for participant detail: {validation_error}. Doc: {participant_doc}")
            raise HTTPException(status_code=500, detail="Failed to process participant data.")
            
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved details for participant {checksum_address} in session {vote_session_id}",
            data=details
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        error_detail = handle_blockchain_error(e) # Keep blockchain error handler?
        logger.error(f"Error getting details for participant {checksum_address} in session {vote_session_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve participant details: {error_detail}")


# --- Keep old endpoints for now? Review necessity --- 

# @router.get("/all/{vote_session_id}") # Old endpoint - replaced by GET /
# async def get_all_holders(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # ... (Implementation fetched only addresses from blockchain) ... 

# @router.get("/count/{vote_session_id}", response_model=StandardResponse[HolderCountResponse]) # Old endpoint - count can be derived from GET /
# async def get_holder_count(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # ... (Implementation fetched count from blockchain) ...

# @router.post("/join/{vote_session_id}", response_model=StandardResponse) # Keep eligibility check?
# async def join_vote_session(
#     vote_session_id: int,
#     data: HolderJoinRequest,
#     blockchain_service: BlockchainService = Depends(get_blockchain_service)
# ):
    # ... (Implementation checks blockchain state) ... 

# @router.get("/details/{vote_session_id}/{participant_address}", response_model=StandardResponse[dict]) # Old endpoint - replaced by GET /{participant_address}
# async def get_holder_details(
#     vote_session_id: int,
#     participant_address: str,
#     blockchain_service: BlockchainService = Depends(get_blockchain_service)
# ):
    # ... (Implementation fetched from blockchain) ...

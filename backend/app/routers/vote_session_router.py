"""
Vote Session router for managing vote sessions in the system.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.dependencies import get_blockchain_service
from app.db.mongodb_utils import get_mongo_db
# Import configuration variables
# from app.core.config import WALLET_ADDRESS, PRIVATE_KEY
# Import error handling utility
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    StandardResponse,
    SliderConfig,
    VoteSessionMetadata
)
# Import new session schemas
from app.schemas.session import SessionApiResponseItem, SessionDetailApiResponse, SessionStatusApiResponse, SessionCacheModel
from app.services.blockchain import BlockchainService
import logging
import json
import asyncio

# Configure logging
logger = logging.getLogger(__name__)
error_logger = logging.getLogger(__name__)
error_logger.propagate = True

router = APIRouter(prefix="/vote-sessions", tags=["Vote Sessions"])


# @router.post("/create", response_model=StandardResponse[TransactionResponse])
# async def create_vote_session(data: ExtendedVoteSessionCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
#     """Creates a new vote session using the VoteSessionFactory."""
#     core_session_data = data.vote_session_data
# 
#     try:
#         # Convert dates to Unix timestamps
#         start_timestamp = int(datetime.fromisoformat(core_session_data.start_date.replace('Z', '+00:00')).timestamp())
#         end_timestamp = int(datetime.fromisoformat(core_session_data.end_date.replace('Z', '+00:00')).timestamp())
#         # Assuming sharesEndDate is also provided in ISO format
#         shares_end_timestamp = int(datetime.fromisoformat(core_session_data.shares_end_date.replace('Z', '+00:00')).timestamp())
# 
#         # Convert required deposit from Ether to Wei
#         required_deposit_wei = blockchain_service.w3.to_wei(core_session_data.required_deposit, 'ether')
#         
#         # Prepare metadata string (simple JSON for now, adjust if needed)
#         metadata_dict = {
#             # Add any specific metadata fields expected by the contract if any
#             # Example: "version": "1.0"
#         }
#         metadata_str = json.dumps(metadata_dict)
# 
#         logger.info(f"Attempting to create session via factory with params: title='{core_session_data.title}', start={start_timestamp}, end={end_timestamp}, shares_end={shares_end_timestamp}, deposit={required_deposit_wei}, threshold={core_session_data.min_share_threshold}")
# 
#         # Call the updated blockchain service method
#         # This now handles the transaction and returns parsed event data
#         creation_result = await blockchain_service.create_vote_session(
#             title=core_session_data.title,
#             description=core_session_data.description,
#             start_date=start_timestamp,
#             end_date=end_timestamp,
#             shares_end_date=shares_end_timestamp,
#             options=core_session_data.options,
#             metadata=metadata_str, # Pass the prepared metadata string
#             required_deposit=required_deposit_wei,
#             min_share_threshold=core_session_data.min_share_threshold
#         )
#         
#         # Extract the new session ID from the result
#         vote_session_id = creation_result['sessionId']
#         session_contract_addr = creation_result['voteSessionContract']
#         registry_contract_addr = creation_result['participantRegistryContract']
# 
#         logger.info(f"Successfully created session pair via factory. Session ID: {vote_session_id}, Session Addr: {session_contract_addr}, Registry Addr: {registry_contract_addr}")
# 
#         # --- Store Frontend Metadata in DB --- 
#         # Use the session ID obtained from the event
#         if data.displayHint or data.sliderConfig:
#             try:
#                 slider_config_json = json.dumps(data.sliderConfig.model_dump()) if data.sliderConfig else None
#                 
#                 metadata_to_store = {
#                     "vote_session_id": vote_session_id,
#                     "displayHint": data.displayHint,
#                     "sliderConfig": slider_config_json
#                 }
#                 logger.debug(f"Attempting to store frontend metadata: {metadata_to_store}") 
#                 
#                 await db.election_metadata.update_one(
#                     {"vote_session_id": vote_session_id},
#                     {"$set": metadata_to_store},
#                     upsert=True
#                 )
#                 logger.info(f"Stored/Updated frontend metadata for vote session ID {vote_session_id}")
#             
#             except Exception as meta_err:
#                 # Log error during DB storage but don't fail the whole request if session creation succeeded
#                 logger.error(f"Exception occurred during frontend metadata storage for session {vote_session_id}. Error: {meta_err}")
# 
#         # Return success response including the new session ID
#         return StandardResponse(
#             success=True,
#             message=f"Successfully created vote session with ID {vote_session_id}",
#             # Return the session ID and potentially contract addresses if useful for frontend
#             data=TransactionResponse( 
#                 transaction_hash="N/A - Event Parsed", # tx hash is inside receipt used internally 
#                 session_id=vote_session_id,
#                 session_address=session_contract_addr,
#                 registry_address=registry_contract_addr
#             )
#         )
# 
#     except HTTPException as http_exc:
#         # Re-raise HTTPExceptions directly
#         raise http_exc
#     except TimeoutError as e:
#         logger.error(f"Timeout creating vote session: {e}")
#         raise HTTPException(status_code=504, detail=f"Blockchain transaction timed out: {e}")
#     except Exception as e:
#         # Handle potential errors from blockchain service or other issues
#         error_detail = handle_blockchain_error(e) 
#         logger.error(f"Failed to create vote session: {error_detail}")
#         raise HTTPException(status_code=500, detail=f"Failed to create vote session: {error_detail}")


# --- Internal Helper for Fetching Enriched Session Data ---
# async def _get_enriched_session_data(session_id: int, blockchain_service: BlockchainService, db) -> Dict[str, Any] | None:
#     """Internal helper to fetch blockchain data and DB metadata for a single session."""
#     try:
#         # 0. Get Session and Registry Addresses first
#         session_addr, registry_addr = await blockchain_service.get_session_addresses(session_id)
#         if not session_addr or not registry_addr:
#             logger.warning(f"Could not retrieve valid contract addresses for session ID {session_id}.")
#             return None
# 
#         # 1. Get Core Session Details & Status from VoteSession (using fetched session_addr)
#         # Modify get_session_details if it doesn't already accept session_addr, or fetch directly here.
#         # Assuming get_session_details primarily uses the session_id to look up addresses via factory,
#         # let's call it as before but use our verified addresses later.
#         session_details = await blockchain_service.get_session_details(session_id)
#         if not session_details:
#              logger.warning(f"No session details found for ID {session_id} in _get_enriched_session_data.")
#              return None # Session likely doesn't exist or failed to fetch
#         
#         params = session_details['parameters']
#         status = session_details['status']
#         # Verify registry address consistency (already done in get_session_details, but good practice)
#         if params.get('participantRegistry') != registry_addr:
#             logger.warning(f"Registry address mismatch for session {session_id}. Factory: {registry_addr}, Params: {params.get('participantRegistry')}")
#             # Prefer the one fetched directly from the factory
# 
#         # 2. Get Registry Contract Instance (using fetched registry_addr)
#         registry_contract = blockchain_service.get_registry_contract(registry_addr)
# 
#         # 3. Get Participant/Holder Counts & Details from ParticipantRegistry
#         total_secret_holders = 0
#         participant_count = 0 # Might differ if non-holders can vote
#         released_keys = 0 # Count of submitted shares
#         active_holders = []
#         
#         try:
#             # Get list of registered holder addresses
#             active_holders = await blockchain_service.call_contract_function(registry_contract, "getActiveHolders", session_id)
#             total_secret_holders = len(active_holders)
#             # Participant count might eventually come from registryContract.getRegisteredParticipantCount() if voters differ
#             participant_count = total_secret_holders # Adjust if voters != holders 
#             
#             # Concurrently check share submission status for each holder
#             share_checks = [blockchain_service.get_participant_details(session_id, holder) for holder in active_holders]
#             results = await asyncio.gather(*share_checks, return_exceptions=True)
#             
#             for result in results:
#                 if isinstance(result, dict) and result.get('hasSubmittedShares') is True:
#                     released_keys += 1
#                 elif isinstance(result, Exception):
#                      logger.error(f"Error fetching participant details for a holder in session {session_id}: {result}")
#                      # Decide how to handle? Continue counting?
# 
#         except Exception as reg_err:
#             logger.error(f"Error fetching holder data from registry for session {session_id}: {reg_err}")
#             # Proceed with potentially zero counts if registry calls fail?
# 
#         # 4. Get Required Keys (Threshold)
#         required_keys = params.get('minShareThreshold', 0)
# 
#         # 5. Fetch Frontend Metadata from DB
#         metadata_db = await db.election_metadata.find_one({"vote_session_id": session_id})
#         slider_config_parsed = None
#         display_hint = None
#         if metadata_db:
#             display_hint = metadata_db.get('displayHint')
#             slider_config_raw = metadata_db.get('sliderConfig')
#             if slider_config_raw:
#                 try:
#                     slider_config_parsed = json.loads(slider_config_raw)
#                 except json.JSONDecodeError:
#                     logger.error(f"Failed to parse sliderConfig JSON from DB for session {session_id}")
# 
#         # 6. Format Output - Match old structure where possible
#         # Fetch reward pool separately
#         reward_wei = 0 # Default value
#         try:
#             reward_wei = await blockchain_service.call_contract_function(registry_contract, "getTotalRewardPool", session_id)
#         except Exception as reward_err:
#             logger.error(f"Error fetching reward pool for session {session_id}: {reward_err}")
#             # Continue with default value if fetch fails
#             
#         formatted_data = {
#             "id": session_id, 
#             "title": params.get('title'),
#             "description": params.get('description'),
#             "start_date": datetime.fromtimestamp(params.get('startDate', 0)).strftime("%Y-%m-%dT%H:%M"), 
#             "end_date": datetime.fromtimestamp(params.get('endDate', 0)).strftime("%Y-%m-%dT%H:%M"), 
#             "status": status,
#             "participant_count": participant_count,
#             "secret_holder_count": total_secret_holders,
#             "options": params.get('options'),
#             "reward_pool": str(blockchain_service.w3.from_wei(reward_wei, 'ether')), # Use fetched or default value
#             "required_deposit": str(blockchain_service.w3.from_wei(params.get('requiredDeposit', 0), 'ether')),
#             "required_keys": required_keys,
#             "released_keys": released_keys,
#             "displayHint": display_hint,
#             "sliderConfig": slider_config_parsed,
#             "sessionContractAddress": session_addr,
#             "registryContractAddress": registry_addr,
#             "sharesEndDate": datetime.fromtimestamp(params.get('sharesCollectionEndDate', 0)).strftime("%Y-%m-%dT%H:%M"),
#             "registrationEndDate": datetime.fromtimestamp(params.get('registrationEndDate', 0)).strftime("%Y-%m-%dT%H:%M"),
#             "metadata": params.get('metadata')
#         }
#         return formatted_data
# 
#     except Exception as e:
#         logger.error(f"Error in _get_enriched_session_data for session {session_id}: {e}", exc_info=True)
#         # Optionally re-raise or return None based on desired error handling for callers
#         return None 


@router.get("/all", response_model=StandardResponse[List[SessionApiResponseItem]])
async def get_all_vote_sessions(db: AsyncIOMotorDatabase = Depends(get_mongo_db)):
    """Retrieves summary information for all deployed vote sessions from the cache."""
    try:
        sessions_cursor = db.sessions.find({}) # Find all documents in 'sessions' collection
        sessions_data = []
        async for session_doc in sessions_cursor:
            # Use session_id as the primary identifier (assuming it's unique)
            session_id = session_doc.get('session_id')
            if session_id is None:
                 logger.warning(f"Found session document without session_id: {session_doc.get('_id')}")
                 continue # Skip documents without session_id

            # Convert timestamps to ISO strings
            start_date_iso = None
            if ts := session_doc.get('start_date_ts'):
                start_date_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()
            end_date_iso = None
            if ts := session_doc.get('end_date_ts'):
                end_date_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()

            # Map to API response schema
            api_item = SessionApiResponseItem(
                id=session_id,
                title=session_doc.get('title'),
                status=session_doc.get('current_status_str'),
                startDate=start_date_iso,
                endDate=end_date_iso,
                # Use aliases defined in the schema
                vote_session_address=session_doc.get('vote_session_address'),
                participant_registry_address=session_doc.get('participant_registry_address')
            )
            sessions_data.append(api_item)
        
        logger.info(f"Retrieved {len(sessions_data)} vote sessions from cache.")
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved information for {len(sessions_data)} vote sessions",
            data=sessions_data
        )
    except Exception as e:
        logger.error(f"Error in get_all_vote_sessions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get all vote session information from cache: {str(e)}")


@router.get("/session/{vote_session_id}", response_model=StandardResponse[SessionDetailApiResponse])
async def get_vote_session_information(
    vote_session_id: int, # Assuming session ID is integer for now
    db: AsyncIOMotorDatabase = Depends(get_mongo_db),
    blockchain_service: BlockchainService = Depends(get_blockchain_service) # Needed for Wei to Eth conversion
):
    """Retrieves detailed information for a specific vote session from the cache."""
    try:
        # Use session_id as the lookup key (assuming it's stored as _id or indexed)
        session_doc = await db.sessions.find_one({"session_id": vote_session_id})

        if session_doc is None:
            logger.warning(f"Session ID {vote_session_id} not found in cache.")
            raise HTTPException(status_code=404, detail=f"Vote session with ID {vote_session_id} not found in cache.")

        logger.info(f"Retrieved session {vote_session_id} from cache.")

        # --- Data Transformation --- 
        start_date_iso = None
        if ts := session_doc.get('start_date_ts'):
            start_date_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()
        end_date_iso = None
        if ts := session_doc.get('end_date_ts'):
            end_date_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()
        shares_end_date_iso = None
        if ts := session_doc.get('shares_collection_end_date_ts'):
            shares_end_date_iso = datetime.fromtimestamp(ts, timezone.utc).isoformat()

        # Convert Wei amounts to Eth strings
        required_deposit_eth = "0.0"
        if wei_str := session_doc.get('required_deposit_wei'):
            try:
                required_deposit_eth = str(blockchain_service.w3.from_wei(int(wei_str), 'ether'))
            except ValueError:
                logger.warning(f"Could not convert required_deposit_wei '{wei_str}' to Eth for session {vote_session_id}")
        
        reward_pool_eth = "0.0"
        if wei_str := session_doc.get('reward_pool_wei'): # Get reward_pool_wei from cache
            try:
                # Convert Wei to Eth string
                reward_pool_eth = str(blockchain_service.w3.from_wei(int(wei_str), 'ether'))
            except ValueError:
                logger.warning(f"Could not convert reward_pool_wei '{wei_str}' to Eth for session {vote_session_id}")

        # Parse sliderConfig if it exists
        slider_config_parsed = None
        if isinstance(sc := session_doc.get('sliderConfig'), str):
            try: 
                slider_config_parsed = json.loads(sc)
            except json.JSONDecodeError: pass # Ignore if parsing fails
        elif isinstance(sc, dict):
            slider_config_parsed = sc

        # Map to SessionDetailApiResponse using aliases
        response_data = SessionDetailApiResponse(
            id=session_doc['session_id'],
            title=session_doc.get('title'),
            description=session_doc.get('description'),
            startDate=start_date_iso,
            endDate=end_date_iso,
            sharesEndDate=shares_end_date_iso,
            status=session_doc.get('current_status_str'),
            options=session_doc.get('options'),
            metadata_contract=session_doc.get('metadata_contract'),
            required_deposit_eth=required_deposit_eth, # Use alias
            min_share_threshold=session_doc.get('min_share_threshold'),
            vote_session_address=session_doc.get('vote_session_address'),
            participant_registry_address=session_doc.get('participant_registry_address'),
            actual_min_share_threshold=session_doc.get('actual_min_share_threshold'), # Use alias
            # --- Fields below are placeholders - need actual data source (e.g., separate counts collection or enrich here) ---
            participant_count=session_doc.get('participant_count'), # Placeholder - need count from participants collection
            secret_holder_count=session_doc.get('secret_holder_count'), # Placeholder
            reward_pool=reward_pool_eth, # Use the converted value
            released_keys=session_doc.get('released_keys'), # Placeholder - need count
            displayHint=session_doc.get('displayHint'), # Assuming this might be cached directly
            sliderConfig=slider_config_parsed # Assuming this might be cached directly
        )

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved information for vote session {vote_session_id}",
            data=response_data
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error getting vote session {vote_session_id} information: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get vote session information: {str(e)}")


@router.get("/session/{vote_session_id}/status", response_model=StandardResponse[SessionStatusApiResponse])
async def get_vote_session_status_cached(
    vote_session_id: int,
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
):
    """Retrieves the current status and key timestamps for a specific vote session from the cache."""
    try:
        # Fetch only needed fields from cache
        session_doc = await db.sessions.find_one(
            {"session_id": vote_session_id},
            projection={"current_status_str": 1, "start_date_ts": 1, "end_date_ts": 1, "shares_collection_end_date_ts": 1, "_id": 0}
        )

        if session_doc is None:
            logger.warning(f"Session ID {vote_session_id} status not found in cache.")
            raise HTTPException(status_code=404, detail=f"Status for vote session ID {vote_session_id} not found in cache.")

        status_data = SessionStatusApiResponse(
            status=session_doc.get('current_status_str', 'Unknown'),
            startDateTs=session_doc.get('start_date_ts'),
            endDateTs=session_doc.get('end_date_ts'),
            sharesEndDateTs=session_doc.get('shares_collection_end_date_ts')
        )

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved status for vote session {vote_session_id}",
            data=status_data
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error getting vote session {vote_session_id} status from cache: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get vote session status from cache: {str(e)}")


# @router.post("/trigger-reward-distribution/{vote_session_id}", response_model=StandardResponse[TransactionResponse])
# async def trigger_reward_distribution(
#     vote_session_id: int,
#     blockchain_service: BlockchainService = Depends(get_blockchain_service)
#     # TODO: Add Auth dependency to ensure only authorized user can call this
# ):
#     """Allows an admin/authorized user to trigger the reward distribution for a session.
#     This calls the triggerRewardCalculation on the VoteSession contract, 
#     which in turn calls calculateRewards on the ParticipantRegistry.
#     """
#     logger.info(f"Attempting to trigger reward distribution for vote session ID: {vote_session_id}")
#     try:
#         # Ensure the blockchain service has a method for this
#         # This assumes a method like `trigger_reward_distribution_on_chain` exists in BlockchainService
#         # that handles the specific contract call to VoteSession.triggerRewardCalculation().
#         # The BlockchainService method would use `send_transaction` internally.
#         
#         # For this example, let's assume blockchain_service.trigger_reward_distribution_on_chain
#         # is a placeholder for the actual implementation needed if this endpoint is kept.
#         # Since send_transaction is removed, this would need a new specific implementation if kept.
#         
#         # Placeholder for the actual call logic, which would involve send_transaction:
#         # tx_receipt = await blockchain_service.trigger_reward_distribution_on_chain(vote_session_id)
#         # logger.info(f"Reward distribution triggered successfully for session {vote_session_id}. Tx hash: {tx_receipt.transactionHash.hex()}")
# 
#         # This endpoint is being commented out as part of the backend rewrite. 
#         # If reinstated, it needs a dedicated service method that can perform a write transaction.

#         logger.warning("trigger_reward_distribution endpoint is currently disabled/commented out.")
#         raise HTTPException(status_code=501, detail="Endpoint not implemented/currently disabled.")

#         # return StandardResponse(
#         #     success=True, 
#         #     message=f"Reward distribution triggered for session {vote_session_id}",
#         #     data=TransactionResponse(
#         #         transaction_hash=tx_receipt.transactionHash.hex(),
#         #         # Add other relevant info from receipt if needed
#         #     )
#         # )
#     except HTTPException as http_exc:
#         raise http_exc # Re-raise HTTPExceptions from service/validation
#     except TimeoutError as e:
#         logger.error(f"Timeout triggering reward distribution for session {vote_session_id}: {e}")
#         raise HTTPException(status_code=504, detail=f"Blockchain transaction timed out: {e}")
#     except Exception as e:
#         error_detail = handle_blockchain_error(e)
#         logger.error(f"Failed to trigger reward distribution for session {vote_session_id}: {error_detail}")
#         raise HTTPException(status_code=500, detail=f"Failed to trigger reward distribution: {error_detail}")


@router.get("/session/{vote_session_id}/metadata", response_model=StandardResponse[VoteSessionMetadata])
async def get_vote_session_metadata(vote_session_id: int, db: AsyncIOMotorDatabase = Depends(get_mongo_db)):
    """Retrieve display hint and slider configuration metadata for a specific vote session from the DB."""
    try:
        # Assuming metadata is stored in a separate collection 'election_metadata'
        # This endpoint might remain reading from DB directly if metadata isn't part of the main session cache
        metadata_doc = await db.election_metadata.find_one({"vote_session_id": vote_session_id})
        
        if metadata_doc:
            # Parse sliderConfig from JSON string if it exists and is a string
            slider_config_data = metadata_doc.get('sliderConfig')
            parsed_slider_config = None
            if isinstance(slider_config_data, str):
                try:
                    parsed_slider_config = json.loads(slider_config_data)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse sliderConfig JSON for session {vote_session_id}: {slider_config_data}")
                    # Keep it None or handle as error?
            elif isinstance(slider_config_data, dict): # Handle case where it might already be dict
                 parsed_slider_config = slider_config_data

            # Prepare the final data, ensuring _id is removed if present and not needed
            final_metadata = {
                "vote_session_id": metadata_doc.get('vote_session_id'),
                "displayHint": metadata_doc.get('displayHint'),
                "sliderConfig": parsed_slider_config
            }
            # Use VoteSessionMetadata for validation before returning
            validated_data = VoteSessionMetadata(**final_metadata)

            return StandardResponse(
                success=True,
                message="Vote session metadata retrieved successfully",
                data=validated_data 
            )
        else:
            # Return default/empty metadata if none found in DB
            default_metadata = VoteSessionMetadata(
                vote_session_id=vote_session_id, 
                displayHint=None,
                sliderConfig=None
            )
            return StandardResponse(
                success=True,
                message="No specific metadata found for this vote session",
                data=default_metadata
            )
            
    except Exception as e:
        logger.error(f"Error retrieving metadata for vote session {vote_session_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve metadata for vote session {vote_session_id}"
        )

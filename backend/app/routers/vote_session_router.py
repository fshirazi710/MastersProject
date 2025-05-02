"""
Vote Session router for managing vote sessions in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.dependencies import get_blockchain_service, get_db
# Import configuration variables
from app.core.config import WALLET_ADDRESS, PRIVATE_KEY
# Import error handling utility
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    StandardResponse,
    TransactionResponse,
    ExtendedVoteSessionCreateRequest,
    SliderConfig,
    VoteSessionMetadata
)
from app.helpers.vote_session_helper import get_vote_session_status, vote_session_information_response, create_vote_session_transaction
from app.services.blockchain import BlockchainService
import logging
import json
import asyncio

# Configure logging
logger = logging.getLogger(__name__)
error_logger = logging.getLogger(__name__)
error_logger.propagate = True

router = APIRouter(prefix="/vote-sessions", tags=["Vote Sessions"])


@router.post("/create", response_model=StandardResponse[TransactionResponse])
async def create_vote_session(data: ExtendedVoteSessionCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    """Creates a new vote session using the VoteSessionFactory."""
    core_session_data = data.vote_session_data

    try:
        # Convert dates to Unix timestamps
        start_timestamp = int(datetime.fromisoformat(core_session_data.start_date.replace('Z', '+00:00')).timestamp())
        end_timestamp = int(datetime.fromisoformat(core_session_data.end_date.replace('Z', '+00:00')).timestamp())
        # Assuming sharesEndDate is also provided in ISO format
        shares_end_timestamp = int(datetime.fromisoformat(core_session_data.shares_end_date.replace('Z', '+00:00')).timestamp())

        # Convert required deposit from Ether to Wei
        required_deposit_wei = blockchain_service.w3.to_wei(core_session_data.required_deposit, 'ether')
        
        # Prepare metadata string (simple JSON for now, adjust if needed)
        metadata_dict = {
            # Add any specific metadata fields expected by the contract if any
            # Example: "version": "1.0"
        }
        metadata_str = json.dumps(metadata_dict)

        logger.info(f"Attempting to create session via factory with params: title='{core_session_data.title}', start={start_timestamp}, end={end_timestamp}, shares_end={shares_end_timestamp}, deposit={required_deposit_wei}, threshold={core_session_data.min_share_threshold}")

        # Call the updated blockchain service method
        # This now handles the transaction and returns parsed event data
        creation_result = await blockchain_service.create_vote_session(
            title=core_session_data.title,
            description=core_session_data.description,
            start_date=start_timestamp,
            end_date=end_timestamp,
            shares_end_date=shares_end_timestamp,
            options=core_session_data.options,
            metadata=metadata_str, # Pass the prepared metadata string
            required_deposit=required_deposit_wei,
            min_share_threshold=core_session_data.min_share_threshold
        )
        
        # Extract the new session ID from the result
        vote_session_id = creation_result['sessionId']
        session_contract_addr = creation_result['voteSessionContract']
        registry_contract_addr = creation_result['participantRegistryContract']

        logger.info(f"Successfully created session pair via factory. Session ID: {vote_session_id}, Session Addr: {session_contract_addr}, Registry Addr: {registry_contract_addr}")

        # --- Store Frontend Metadata in DB --- 
        # Use the session ID obtained from the event
        if data.displayHint or data.sliderConfig:
            try:
                slider_config_json = json.dumps(data.sliderConfig.model_dump()) if data.sliderConfig else None
                
                metadata_to_store = {
                    "vote_session_id": vote_session_id,
                    "displayHint": data.displayHint,
                    "sliderConfig": slider_config_json
                }
                logger.debug(f"Attempting to store frontend metadata: {metadata_to_store}") 
                
                await db.election_metadata.update_one(
                    {"vote_session_id": vote_session_id},
                    {"$set": metadata_to_store},
                    upsert=True
                )
                logger.info(f"Stored/Updated frontend metadata for vote session ID {vote_session_id}")
            
            except Exception as meta_err:
                # Log error during DB storage but don't fail the whole request if session creation succeeded
                logger.error(f"Exception occurred during frontend metadata storage for session {vote_session_id}. Error: {meta_err}")

        # Return success response including the new session ID
        return StandardResponse(
            success=True,
            message=f"Successfully created vote session with ID {vote_session_id}",
            # Return the session ID and potentially contract addresses if useful for frontend
            data=TransactionResponse( 
                transaction_hash="N/A - Event Parsed", # tx hash is inside receipt used internally 
                session_id=vote_session_id,
                session_address=session_contract_addr,
                registry_address=registry_contract_addr
            )
        )

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions directly
        raise http_exc
    except TimeoutError as e:
        logger.error(f"Timeout creating vote session: {e}")
        raise HTTPException(status_code=504, detail=f"Blockchain transaction timed out: {e}")
    except Exception as e:
        # Handle potential errors from blockchain service or other issues
        error_detail = handle_blockchain_error(e) 
        logger.error(f"Failed to create vote session: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to create vote session: {error_detail}")


# --- Internal Helper for Fetching Enriched Session Data ---
async def _get_enriched_session_data(session_id: int, blockchain_service: BlockchainService, db) -> Dict[str, Any] | None:
    """Internal helper to fetch blockchain data and DB metadata for a single session."""
    try:
        # 0. Get Session and Registry Addresses first
        session_addr, registry_addr = await blockchain_service.get_session_addresses(session_id)
        if not session_addr or not registry_addr:
            logger.warning(f"Could not retrieve valid contract addresses for session ID {session_id}.")
            return None

        # 1. Get Core Session Details & Status from VoteSession (using fetched session_addr)
        # Modify get_session_details if it doesn't already accept session_addr, or fetch directly here.
        # Assuming get_session_details primarily uses the session_id to look up addresses via factory,
        # let's call it as before but use our verified addresses later.
        session_details = await blockchain_service.get_session_details(session_id)
        if not session_details:
             logger.warning(f"No session details found for ID {session_id} in _get_enriched_session_data.")
             return None # Session likely doesn't exist or failed to fetch
        
        params = session_details['parameters']
        status = session_details['status']
        # Verify registry address consistency (already done in get_session_details, but good practice)
        if params.get('participantRegistry') != registry_addr:
            logger.warning(f"Registry address mismatch for session {session_id}. Factory: {registry_addr}, Params: {params.get('participantRegistry')}")
            # Prefer the one fetched directly from the factory

        # 2. Get Registry Contract Instance (using fetched registry_addr)
        registry_contract = blockchain_service.get_registry_contract(registry_addr)

        # 3. Get Participant/Holder Counts & Details from ParticipantRegistry
        total_secret_holders = 0
        participant_count = 0 # Might differ if non-holders can vote
        released_keys = 0 # Count of submitted shares
        active_holders = []
        
        try:
            # Get list of registered holder addresses
            active_holders = await blockchain_service.call_contract_function(registry_contract, "getActiveHolders", session_id)
            total_secret_holders = len(active_holders)
            # Participant count might eventually come from registryContract.getRegisteredParticipantCount() if voters differ
            participant_count = total_secret_holders # Adjust if voters != holders 
            
            # Concurrently check share submission status for each holder
            share_checks = [blockchain_service.get_participant_details(session_id, holder) for holder in active_holders]
            results = await asyncio.gather(*share_checks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, dict) and result.get('hasSubmittedShares') is True:
                    released_keys += 1
                elif isinstance(result, Exception):
                     logger.error(f"Error fetching participant details for a holder in session {session_id}: {result}")
                     # Decide how to handle? Continue counting?

        except Exception as reg_err:
            logger.error(f"Error fetching holder data from registry for session {session_id}: {reg_err}")
            # Proceed with potentially zero counts if registry calls fail?

        # 4. Get Required Keys (Threshold)
        required_keys = params.get('minShareThreshold', 0)

        # 5. Fetch Frontend Metadata from DB
        metadata_db = await db.election_metadata.find_one({"vote_session_id": session_id})
        slider_config_parsed = None
        display_hint = None
        if metadata_db:
            display_hint = metadata_db.get('displayHint')
            slider_config_raw = metadata_db.get('sliderConfig')
            if slider_config_raw:
                try:
                    slider_config_parsed = json.loads(slider_config_raw)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse sliderConfig JSON from DB for session {session_id}")

        # 6. Format Output - Match old structure where possible
        # Fetch reward pool separately
        reward_wei = 0 # Default value
        try:
            reward_wei = await blockchain_service.call_contract_function(registry_contract, "getTotalRewardPool", session_id)
        except Exception as reward_err:
            logger.error(f"Error fetching reward pool for session {session_id}: {reward_err}")
            # Continue with default value if fetch fails
            
        formatted_data = {
            "id": session_id, 
            "title": params.get('title'),
            "description": params.get('description'),
            "start_date": datetime.fromtimestamp(params.get('startDate', 0)).strftime("%Y-%m-%dT%H:%M"), 
            "end_date": datetime.fromtimestamp(params.get('endDate', 0)).strftime("%Y-%m-%dT%H:%M"), 
            "status": status,
            "participant_count": participant_count,
            "secret_holder_count": total_secret_holders,
            "options": params.get('options'),
            "reward_pool": str(blockchain_service.w3.from_wei(reward_wei, 'ether')), # Use fetched or default value
            "required_deposit": str(blockchain_service.w3.from_wei(params.get('requiredDeposit', 0), 'ether')),
            "required_keys": required_keys,
            "released_keys": released_keys,
            "displayHint": display_hint,
            "sliderConfig": slider_config_parsed,
            "sessionContractAddress": session_addr,
            "registryContractAddress": registry_addr,
            "sharesEndDate": datetime.fromtimestamp(params.get('sharesCollectionEndDate', 0)).strftime("%Y-%m-%dT%H:%M"),
            "registrationEndDate": datetime.fromtimestamp(params.get('registrationEndDate', 0)).strftime("%Y-%m-%dT%H:%M"),
            "metadata": params.get('metadata')
        }
        return formatted_data

    except Exception as e:
        logger.error(f"Error in _get_enriched_session_data for session {session_id}: {e}", exc_info=True)
        # Optionally re-raise or return None based on desired error handling for callers
        return None 


@router.get("/all", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_all_vote_sessions(blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    """Retrieves summary information for all deployed vote sessions."""
    try:
        sessions_data = []
        # Get total count from the factory service method
        num_of_sessions = await blockchain_service.get_session_count()
        logger.info(f"Found {num_of_sessions} sessions from factory.")

        # Create tasks to fetch data for all sessions concurrently
        tasks = [_get_enriched_session_data(session_id, blockchain_service, db) for session_id in range(num_of_sessions)]
        results = await asyncio.gather(*tasks)

        # Filter out None results (errors during fetching)
        sessions_data = [result for result in results if result is not None]

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved information for {len(sessions_data)} vote sessions",
            data=sessions_data
        )
    except Exception as e:
        logger.error(f"Error in get_all_vote_sessions: {e}", exc_info=True)
        # Use the error handling utility if available, or a generic message
        error_detail = handle_blockchain_error(e)
        raise HTTPException(status_code=500, detail=f"Failed to get all vote session information: {error_detail}")


@router.get("/session/{vote_session_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_vote_session_information(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    """Retrieves detailed information for a specific vote session."""
    session_data = await _get_enriched_session_data(vote_session_id, blockchain_service, db)

    if session_data is None:
        # Error logged within the helper function
        raise HTTPException(status_code=404, detail=f"Vote session with ID {vote_session_id} not found or failed to load.")

    return StandardResponse(
        success=True,
        message=f"Successfully retrieved information for vote session {vote_session_id}",
        data=session_data
    )


@router.post("/trigger-reward-distribution/{vote_session_id}", response_model=StandardResponse[TransactionResponse])
async def trigger_reward_distribution(
    vote_session_id: int,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
    # TODO: Add Auth dependency to ensure only authorized user can call this
):
    """Triggers the reward calculation process in the ParticipantRegistry contract."""
    try:
        logger.info(f"Attempting to trigger reward calculation for session {vote_session_id}")

        # 1. Get the ParticipantRegistry address for this session
        _, registry_addr = await blockchain_service.get_session_addresses(vote_session_id)
        if not registry_addr:
            raise ValueError(f"Could not find registry address for session ID {vote_session_id}")

        # 2. Get the registry contract instance
        registry_contract = blockchain_service.get_registry_contract(registry_addr)

        # 3. Call the calculateRewards function via send_transaction
        #    This function might be callable by owner or the session contract.
        #    The service's send_transaction uses the configured backend PRIVATE_KEY.
        #    Ensure this account has permission to call calculateRewards.
        tx_receipt = await blockchain_service.send_transaction(
            registry_contract, 
            "calculateRewards" 
            # No arguments needed based on ParticipantRegistry.sol: calculateRewards()
        )

        tx_hash = tx_receipt.transactionHash.hex()
        logger.info(f"Successfully triggered reward calculation for session {vote_session_id}. Tx Hash: {tx_hash}")

        # Optional: Parse RewardsCalculated event from receipt if needed
        # event_args = blockchain_service.parse_event(tx_receipt, registry_contract, "RewardsCalculated")
        # total_pool = event_args.totalRewardPoolCalculated if event_args else None

        return StandardResponse(
            success=True,
            message=f"Successfully triggered reward calculation for session {vote_session_id}",
            data=TransactionResponse(transaction_hash=tx_hash, session_id=vote_session_id)
        )

    except HTTPException as http_exc:
        raise http_exc
    except TimeoutError as e:
        logger.error(f"Timeout triggering reward calculation for session {vote_session_id}: {e}")
        raise HTTPException(status_code=504, detail=f"Blockchain transaction timed out: {e}")
    except Exception as e:
        error_detail = handle_blockchain_error(e)
        logger.error(f"Failed to trigger reward calculation for session {vote_session_id}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger reward calculation: {error_detail}")


@router.get("/session/{vote_session_id}/metadata", response_model=StandardResponse[VoteSessionMetadata])
async def get_vote_session_metadata(vote_session_id: int, db=Depends(get_db)):
    """Retrieve display hint and slider configuration metadata for a specific vote session."""
    try:
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

            # Prepare the final data, ensuring _id is removed
            final_metadata = {
                "vote_session_id": metadata_doc.get('vote_session_id'),
                "displayHint": metadata_doc.get('displayHint'),
                "sliderConfig": parsed_slider_config
            }

            # Pydantic will validate final_metadata against VoteSessionMetadata via StandardResponse
            return StandardResponse(
                success=True,
                message="Vote session metadata retrieved successfully",
                data=final_metadata 
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
                data=default_metadata.model_dump() 
            )
            
    except Exception as e:
        logger.error(f"Error retrieving metadata for vote session {vote_session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve metadata for vote session {vote_session_id}"
        )

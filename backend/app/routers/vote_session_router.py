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
    # Extract core data for contract interaction
    core_session_data = data.vote_session_data
    
    # Convert start and end dates from ISO format to Unix timestamps
    start_timestamp = int(datetime.fromisoformat(core_session_data.start_date.replace('Z', '+00:00')).timestamp())
    end_timestamp = int(datetime.fromisoformat(core_session_data.end_date.replace('Z', '+00:00')).timestamp())
    
    # Convert reward pool and required deposit from Ether to Wei
    required_deposit_wei = blockchain_service.w3.to_wei(core_session_data.required_deposit, 'ether')
    reward_pool_wei = blockchain_service.w3.to_wei(core_session_data.reward_pool, 'ether')

    # Call helper function with only core data
    # Pass metadata components and reward pool value to helper
    receipt = await create_vote_session_transaction(
        core_session_data,
        start_timestamp, 
        end_timestamp, 
        required_deposit_wei, 
        reward_pool_wei,       # Pass reward_pool_wei for msg.value
        blockchain_service
    )
    
    if receipt.status != 1:
         raise HTTPException(status_code=500, detail="Failed to create vote session on blockchain")

    # --- Store Metadata in DB --- 
    vote_session_id = None
    try:
        # --- Parse VoteSessionCreated event from logs --- 
        event_signature_hash = blockchain_service.w3.keccak(text="VoteSessionCreated(uint256,string)").hex()
        vote_session_id = None
        for log in receipt.logs:
            if log['topics'] and log['topics'][0].hex() == event_signature_hash:
                event_abi = next((item for item in blockchain_service.contract.abi if item.get('type') == 'event' and item.get('name') == 'VoteSessionCreated'), None)
                if event_abi:
                    try:
                        # Extract just the type strings from the ABI inputs
                        types_list = [inp['type'] for inp in event_abi['inputs']]
                        # Decode using the list of type strings
                        decoded_data = blockchain_service.w3.codec.decode(
                            types_list, 
                            log['data']
                        )
                        # Arguments are returned as a tuple in order (id, title)
                        vote_session_id = decoded_data[0] 
                        logger.info(f"Parsed vote session ID {vote_session_id} from VoteSessionCreated event.")
                        break # Found and parsed successfully
                    except Exception as decode_err:
                        # Log error specifically related to decoding
                        logger.error(f"Error decoding VoteSessionCreated event data: {decode_err}")
                        break # Stop trying if decoding fails
                else:
                    logger.error("Could not find VoteSessionCreated event ABI to decode logs.")
                    break
        
        if vote_session_id is None:
             logger.warning(f"Could not find or parse VoteSessionCreated event in transaction logs (tx: {receipt.transactionHash.hex()}). Metadata storage will be skipped.")

        if vote_session_id is not None and (data.displayHint or data.sliderConfig):
            slider_config_json = json.dumps(data.sliderConfig.model_dump()) if data.sliderConfig else None
            
            metadata_to_store = {
                "vote_session_id": vote_session_id,
                "displayHint": data.displayHint,
                "sliderConfig": slider_config_json
            }
            # Add debug log before DB call
            logger.debug(f"Attempting to store metadata: {metadata_to_store}") 
            
            await db.election_metadata.update_one(
                {"vote_session_id": vote_session_id},
                {"$set": metadata_to_store},
                upsert=True
            )
            logger.info(f"Stored/Updated metadata for vote session ID {vote_session_id}")
            
    except Exception as meta_err:
        # Simplify error logging
        logger.error(f"Exception occurred during metadata processing/storage for tx {receipt.transactionHash.hex()}. Error type: {type(meta_err).__name__}")
        # Optionally log the full traceback if needed for deeper debugging
        # logger.exception("Full traceback for metadata error:") 
    # --- End Metadata Storage --- 

    return StandardResponse(
        success=True,
        message="Successfully created vote session"
    )


@router.get("/all", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_all_vote_sessions(blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Get total number of votes from the smart contract
        sessions = []
        num_of_sessions = await blockchain_service.call_contract_function("voteSessionCount")

        # Iterate through each vote and retrieve its data
        for vote_session_id in range(num_of_sessions):

            # Retrieve election information from the blockchain
            session_info = await blockchain_service.call_contract_function("getVoteSession", vote_session_id)
            
            # Calculate the status of the session
            session_status = await get_vote_session_status(session_info[3], session_info[4])

            # --- Calculate counts using Contract Data --- 
            # Total Secret Holders
            total_secret_holders = await blockchain_service.call_contract_function("getNumHoldersByVoteSession", vote_session_id)
            
            # Required Keys (Threshold - assuming from first vote, might need better logic if votes vary)
            required_keys = 0
            try:
                submitted_votes = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
                if submitted_votes and len(submitted_votes) > 0:
                    required_keys = submitted_votes[0][6] # Index 6 is threshold
            except Exception as vote_err:
                 logger.warning(f"Could not retrieve encrypted votes for session {vote_session_id} to get threshold: {vote_err}")

            # Released Keys (Submitted Shares)
            released_keys = 0
            active_holders = await blockchain_service.call_contract_function("getHoldersByVoteSession", vote_session_id)
            # Use asyncio.gather for concurrent checks if list is large
            submission_checks = [blockchain_service.has_holder_submitted_share(vote_session_id, holder) for holder in active_holders]
            submission_results = await asyncio.gather(*submission_checks, return_exceptions=True)
            
            for result in submission_results:
                if isinstance(result, bool) and result is True:
                    released_keys += 1
                elif isinstance(result, Exception):
                    logger.error(f"Error checking submission status for a holder in session {vote_session_id}: {result}")
                    # Decide how to handle errors - skip count? 

            # Participant Count (Assuming only holders participate for now?)
            # If voters are distinct, different contract logic needed.
            participant_count = total_secret_holders 
            # --- End Contract Data Counts --- 

            # Fetch metadata (Requires DB)
            metadata = await db.election_metadata.find_one({"vote_session_id": vote_session_id})
            slider_config_parsed = None
            if metadata and metadata.get('sliderConfig'):
                try:
                    slider_config_parsed = json.loads(metadata.get('sliderConfig'))
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse sliderConfig JSON for session {vote_session_id}")

            sessions.append(await vote_session_information_response(
                session_info, 
                session_status, 
                participant_count, 
                required_keys, 
                released_keys, 
                total_secret_holders, 
                blockchain_service,
                metadata.get('displayHint') if metadata else None,
                slider_config_parsed
            ))

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved information for all vote sessions",
            data=sessions
        )
    except Exception as e:
        logger.error(f"Error in get_all_vote_sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to get all vote session information")


@router.get("/session/{vote_session_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_vote_session_information(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        session_info = await blockchain_service.call_contract_function("getVoteSession", vote_session_id)
        
        # logger.info("session_info: ", session_info)
        # logger.info("session_info[3]: ", session_info[3])
        # logger.info("session_info[4]: ", session_info[4])
        
        session_status = await get_vote_session_status(session_info[3], session_info[4])
        
        # --- Calculate counts using Contract Data --- 
        # Total Secret Holders
        total_secret_holders = await blockchain_service.call_contract_function("getNumHoldersByVoteSession", vote_session_id)

        # Required Keys (Threshold)
        required_keys = 0
        try:
            submitted_votes = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
            if submitted_votes and len(submitted_votes) > 0:
                required_keys = submitted_votes[0][6]
        except Exception as vote_err:
            logger.warning(f"Could not retrieve encrypted votes for session {vote_session_id} to get threshold: {vote_err}")

        # Released Keys (Submitted Shares)
        released_keys = 0
        active_holders = await blockchain_service.call_contract_function("getHoldersByVoteSession", vote_session_id)
        # Use asyncio.gather for concurrent checks
        submission_checks = [blockchain_service.has_holder_submitted_share(vote_session_id, holder) for holder in active_holders]
        submission_results = await asyncio.gather(*submission_checks, return_exceptions=True)
        
        for result in submission_results:
            if isinstance(result, bool) and result is True:
                released_keys += 1
            elif isinstance(result, Exception):
                logger.error(f"Error checking submission status for a holder in session {vote_session_id}: {result}")

        # Participant Count (Assuming only holders participate)
        participant_count = total_secret_holders
        # --- End Contract Data Counts --- 

        # Fetch metadata (Requires DB)
        metadata = await db.election_metadata.find_one({"vote_session_id": vote_session_id})
        slider_config_parsed = None
        if metadata and metadata.get('sliderConfig'):
            try:
                slider_config_parsed = json.loads(metadata.get('sliderConfig'))
            except json.JSONDecodeError:
                logger.error(f"Failed to parse sliderConfig JSON for session {vote_session_id}")

        # Call helper with metadata
        session_data = await vote_session_information_response(
            session_info, 
            session_status, 
            participant_count, 
            required_keys, 
            released_keys, 
            total_secret_holders,
            blockchain_service,
            metadata.get('displayHint') if metadata else None,
            slider_config_parsed
        )

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved information for vote session {vote_session_id}",
            data=session_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vote session information: {str(e)}")
        raise handle_blockchain_error("get vote session information", e)


@router.post("/trigger-reward-distribution/{vote_session_id}", response_model=StandardResponse[TransactionResponse])
async def trigger_reward_distribution(
    vote_session_id: int,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
    # TODO: Add Auth dependency to ensure only authorized user can call this
):
    """Triggers the on-chain reward distribution for a vote session."""
    # Basic check: Ensure session exists (getVoteSession will raise error if not)
    try:
        await blockchain_service.call_contract_function("getVoteSession", vote_session_id)
    except Exception:
         raise HTTPException(status_code=404, detail=f"Vote session {vote_session_id} not found.")

    try:
        # Build transaction to call distributeRewards
        # This needs to be sent by an authorized account (e.g., backend wallet)
        # that has gas. The contract handles the actual transfers.
        distribute_tx = blockchain_service.contract.functions.distributeRewards(vote_session_id).build_transaction({
            'from': WALLET_ADDRESS, # Use backend wallet
            'nonce': blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS),
            # Estimate gas dynamically if possible, otherwise set a reasonable limit
            # 'gas': estimated_gas,
            # 'gasPrice': blockchain_service.w3.eth.gas_price,
        })

        # Sign and send
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(distribute_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = await asyncio.to_thread(blockchain_service.w3.eth.wait_for_transaction_receipt, tx_hash, timeout=120) # Use await asyncio.to_thread for sync wait_for

        if receipt.status == 1:
            return StandardResponse(
                success=True,
                message=f"Reward distribution triggered successfully for vote session {vote_session_id}.",
                data=TransactionResponse(transaction_hash=receipt.transactionHash.hex())
            )
        else:
             logger.error(f"On-chain reward distribution failed for vote session {vote_session_id}. Tx: {receipt.transactionHash.hex()}")
             raise HTTPException(status_code=500, detail="Reward distribution transaction failed on-chain.")

    except Exception as e:
        logger.error(f"Error triggering reward distribution for vote session {vote_session_id}: {str(e)}")
        # Handle specific web3 errors if needed (e.g., gas estimation, revert reasons)
        raise HTTPException(status_code=500, detail="Failed to trigger reward distribution.")


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

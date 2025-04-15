"""
Election router for managing elections in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.dependencies import get_blockchain_service, get_db
from app.schemas import (
    StandardResponse,
    TransactionResponse,
    ExtendedElectionCreateRequest,
    SliderConfig,
    ElectionMetadata
)
from app.helpers.election_helper import get_election_status, election_information_response, create_election_transaction, check_winners_already_selected, check_winners, generate_winners
from app.services.blockchain import BlockchainService
import logging
import json
import asyncio

# Configure logging
logger = logging.getLogger(__name__)
error_logger = logging.getLogger(__name__)
error_logger.propagate = True

router = APIRouter(prefix="/elections", tags=["Elections"])


@router.post("/create-election", response_model=StandardResponse[TransactionResponse])
async def create_election(data: ExtendedElectionCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    # Extract core data for contract interaction
    core_data = data.election_data
    
    # Convert start and end dates from ISO format to Unix timestamps
    start_timestamp = int(datetime.fromisoformat(core_data.start_date.replace('Z', '+00:00')).timestamp())
    end_timestamp = int(datetime.fromisoformat(core_data.end_date.replace('Z', '+00:00')).timestamp())
    
    # Convert reward pool and required deposit from Ether to Wei
    reward_pool_wei = blockchain_service.w3.to_wei(core_data.reward_pool, 'ether')
    required_deposit_wei = blockchain_service.w3.to_wei(core_data.required_deposit, 'ether')

    # Call helper function with only core data
    receipt = await create_election_transaction(
        core_data,
        start_timestamp, 
        end_timestamp, 
        reward_pool_wei, 
        required_deposit_wei, 
        blockchain_service,
    )
    
    if receipt.status != 1:
         raise HTTPException(status_code=500, detail="Failed to create election on blockchain")

    # --- Store Metadata in DB --- 
    election_id = None
    try:
        # --- Parse ElectionCreated event from logs --- 
        event_signature_hash = blockchain_service.w3.keccak(text="ElectionCreated(uint256,string)").hex()
        election_id = None
        for log in receipt.logs:
            if log['topics'] and log['topics'][0].hex() == event_signature_hash:
                event_abi = next((item for item in blockchain_service.contract.abi if item.get('type') == 'event' and item.get('name') == 'ElectionCreated'), None)
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
                        election_id = decoded_data[0] 
                        logger.info(f"Parsed election ID {election_id} from ElectionCreated event.")
                        break # Found and parsed successfully
                    except Exception as decode_err:
                        # Log error specifically related to decoding
                        logger.error(f"Error decoding ElectionCreated event data: {decode_err}")
                        break # Stop trying if decoding fails
                else:
                    logger.error("Could not find ElectionCreated event ABI to decode logs.")
                    break
        
        if election_id is None:
             logger.warning(f"Could not find or parse ElectionCreated event in transaction logs (tx: {receipt.transactionHash.hex()}). Metadata storage will be skipped.")

        if election_id is not None and (data.displayHint or data.sliderConfig):
            slider_config_json = json.dumps(data.sliderConfig.model_dump()) if data.sliderConfig else None
            
            metadata_to_store = {
                "election_id": election_id,
                "displayHint": data.displayHint,
                "sliderConfig": slider_config_json
            }
            # Add debug log before DB call
            logger.debug(f"Attempting to store metadata: {metadata_to_store}") 
            
            await db.election_metadata.update_one(
                {"election_id": election_id},
                {"$set": metadata_to_store},
                upsert=True
            )
            logger.info(f"Stored/Updated metadata for election ID {election_id}")
            
    except Exception as meta_err:
        # Simplify error logging
        logger.error(f"Exception occurred during metadata processing/storage for tx {receipt.transactionHash.hex()}. Error type: {type(meta_err).__name__}")
        # Optionally log the full traceback if needed for deeper debugging
        # logger.exception("Full traceback for metadata error:") 
    # --- End Metadata Storage --- 

    return StandardResponse(
        success=True,
        message="Successfully created election"
    )


@router.get("/all-elections", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_all_elections(blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Get total number of votes from the smart contract
        elections = []
        num_of_elections = await blockchain_service.call_contract_function("electionCount")

        # Iterate through each vote and retrieve its data
        for election_id in range(num_of_elections):

            # Retrieve election information from the blockchain
            election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
            # Calculate the status of the election
            election_status = await get_election_status(election_info[3], election_info[4])

            # --- Calculate counts using Contract Data --- 
            # Total Secret Holders
            total_secret_holders = await blockchain_service.call_contract_function("getNumHoldersByElection", election_id)
            
            # Required Keys (Threshold - assuming from first vote, might need better logic if votes vary)
            required_keys = 0
            try:
                submitted_votes = await blockchain_service.call_contract_function("getVotes", election_id)
                if submitted_votes and len(submitted_votes) > 0:
                    required_keys = submitted_votes[0][6] # Index 6 is threshold
            except Exception as vote_err:
                 logger.warning(f"Could not retrieve votes for election {election_id} to get threshold: {vote_err}")

            # Released Keys (Submitted Shares)
            released_keys = 0
            active_holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)
            # Use asyncio.gather for concurrent checks if list is large
            submission_checks = [blockchain_service.has_holder_submitted(election_id, holder) for holder in active_holders]
            submission_results = await asyncio.gather(*submission_checks, return_exceptions=True)
            
            for result in submission_results:
                if isinstance(result, bool) and result is True:
                    released_keys += 1
                elif isinstance(result, Exception):
                    logger.error(f"Error checking submission status for a holder in election {election_id}: {result}")
                    # Decide how to handle errors - skip count? 

            # Participant Count (Assuming only holders participate for now?)
            # If voters are distinct, different contract logic needed.
            participant_count = total_secret_holders 
            # --- End Contract Data Counts --- 

            # Fetch metadata (Requires DB)
            metadata = await db.election_metadata.find_one({"election_id": election_id})
            slider_config_parsed = None
            if metadata and metadata.get('sliderConfig'):
                try:
                    slider_config_parsed = json.loads(metadata.get('sliderConfig'))
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse sliderConfig JSON for election {election_id}")

            elections.append(await election_information_response(
                election_info, 
                election_status, 
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
            message=f"Successfully retrieved election information for all elections",
            data=elections
        )
    except Exception as e:
        logger.error(f"Error in get_all_elections: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to get all election information")


@router.get("/election/{election_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_election_information(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        election_info = await blockchain_service.call_contract_function("getElection", election_id)
        
        # logger.info("election_info: ", election_info)
        # logger.info("election_info[3]: ", election_info[3])
        # logger.info("election_info[4]: ", election_info[4])
        
        election_status = await get_election_status(election_info[3], election_info[4])
        
        # --- Calculate counts using Contract Data --- 
        # Total Secret Holders
        total_secret_holders = await blockchain_service.call_contract_function("getNumHoldersByElection", election_id)

        # Required Keys (Threshold)
        required_keys = 0
        try:
            submitted_votes = await blockchain_service.call_contract_function("getVotes", election_id)
            if submitted_votes and len(submitted_votes) > 0:
                required_keys = submitted_votes[0][6]
        except Exception as vote_err:
            logger.warning(f"Could not retrieve votes for election {election_id} to get threshold: {vote_err}")

        # Released Keys (Submitted Shares)
        released_keys = 0
        active_holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)
        # Use asyncio.gather for concurrent checks
        submission_checks = [blockchain_service.has_holder_submitted(election_id, holder) for holder in active_holders]
        submission_results = await asyncio.gather(*submission_checks, return_exceptions=True)
        
        for result in submission_results:
            if isinstance(result, bool) and result is True:
                released_keys += 1
            elif isinstance(result, Exception):
                logger.error(f"Error checking submission status for a holder in election {election_id}: {result}")

        # Participant Count (Assuming only holders participate)
        participant_count = total_secret_holders
        # --- End Contract Data Counts --- 

        # Fetch metadata (Requires DB)
        metadata = await db.election_metadata.find_one({"election_id": election_id})
        slider_config_parsed = None
        if metadata and metadata.get('sliderConfig'):
            try:
                slider_config_parsed = json.loads(metadata.get('sliderConfig'))
            except json.JSONDecodeError:
                logger.error(f"Failed to parse sliderConfig JSON for election {election_id}")

        # Call helper with metadata
        election_data = await election_information_response(
            election_info, 
            election_status, 
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
            message=f"Successfully retrieved election information for election {election_id}",
            data=election_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise handle_blockchain_error("get election information", e)


@router.post("/trigger-reward-distribution/{election_id}", response_model=StandardResponse[TransactionResponse])
async def trigger_reward_distribution(
    election_id: int,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
    # TODO: Add Auth dependency to ensure only authorized user can call this
):
    """Triggers the on-chain reward distribution for an election."""
    # Basic check: Ensure election exists (getElection will raise error if not)
    try:
        await blockchain_service.call_contract_function("getElection", election_id)
    except Exception:
         raise HTTPException(status_code=404, detail=f"Election {election_id} not found.")

    try:
        # Build transaction to call distributeRewards
        # This needs to be sent by an authorized account (e.g., backend wallet)
        # that has gas. The contract handles the actual transfers.
        distribute_tx = blockchain_service.contract.functions.distributeRewards(election_id).build_transaction({
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
                message=f"Reward distribution triggered successfully for election {election_id}.",
                data=TransactionResponse(transaction_hash=receipt.transactionHash.hex())
            )
        else:
             logger.error(f"On-chain reward distribution failed for election {election_id}. Tx: {receipt.transactionHash.hex()}")
             raise HTTPException(status_code=500, detail="Reward distribution transaction failed on-chain.")

    except Exception as e:
        logger.error(f"Error triggering reward distribution for election {election_id}: {str(e)}")
        # Handle specific web3 errors if needed (e.g., gas estimation, revert reasons)
        raise HTTPException(status_code=500, detail="Failed to trigger reward distribution.")


@router.post("/submit-email/{election_id}")
async def submit_email(election_id: int, data: dict, db=Depends(get_db)):
    try:
        
        existing_entry = await db.winner_emails.find_one({"election_id": election_id, "winner_email": data["email"]})

        if existing_entry:
            return {"message": "Email already submitted."}
        
        result = await db.winner_emails.insert_one({"election_id": election_id, "winner_email": data["email"]})
        
        if not result.acknowledged:
            raise HTTPException(status_code=500, detail="Failed to store email in database.")
        
        return {"message": "Email submitted successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/election/{election_id}/metadata", response_model=StandardResponse[ElectionMetadata])
async def get_election_metadata(election_id: int, db=Depends(get_db)):
    """Retrieve display hint and slider configuration metadata for a specific election."""
    try:
        metadata_doc = await db.election_metadata.find_one({"election_id": election_id})
        
        if metadata_doc:
            # Parse sliderConfig from JSON string if it exists and is a string
            slider_config_data = metadata_doc.get('sliderConfig')
            parsed_slider_config = None
            if isinstance(slider_config_data, str):
                try:
                    parsed_slider_config = json.loads(slider_config_data)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse sliderConfig JSON for election {election_id}: {slider_config_data}")
                    # Keep it None or handle as error?
            elif isinstance(slider_config_data, dict): # Handle case where it might already be dict
                 parsed_slider_config = slider_config_data

            # Prepare the final data, ensuring _id is removed
            final_metadata = {
                "election_id": metadata_doc.get('election_id'),
                "displayHint": metadata_doc.get('displayHint'),
                "sliderConfig": parsed_slider_config
            }

            # Pydantic will validate final_metadata against ElectionMetadata via StandardResponse
            return StandardResponse(
                success=True,
                message="Election metadata retrieved successfully",
                data=final_metadata 
            )
        else:
            # Return default/empty metadata if none found in DB
            default_metadata = ElectionMetadata(
                election_id=election_id, 
                displayHint=None,
                sliderConfig=None
            )
            return StandardResponse(
                success=True,
                message="No specific metadata found for this election",
                data=default_metadata.model_dump() 
            )
            
    except Exception as e:
        logger.error(f"Error retrieving metadata for election {election_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve metadata for election {election_id}"
        )

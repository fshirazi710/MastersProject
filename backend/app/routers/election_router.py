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

# Configure logging
logger = logging.getLogger(__name__)

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

            # Calculate how many people are registered for an election
            participant_count = await db.public_keys.count_documents({"vote_id": election_id})
            
            # --- Fetch required_keys and released_keys (mirroring get_election_information) --- 
            required_keys = 0
            submitted_votes = await blockchain_service.call_contract_function("getVotes", election_id)
            if submitted_votes and len(submitted_votes) > 0:
                # Vote struct: publicKey[0], ciphertext[1], g1r[2], g2r[3], alpha[4], voter[5], threshold[6]
                required_keys = submitted_votes[0][6] # Index 6 is threshold
                
            released_keys = await db.public_keys.count_documents({
                "vote_id": election_id, 
                "is_secret_holder": True, 
                "reward_token": 5
            })
            # --- End fetch --- 
            
            # Add election information to an array, including new keys
            elections.append(await election_information_response(
                election_info, 
                election_status, 
                participant_count, 
                required_keys, # Pass required_keys
                released_keys, # Pass released_keys
                blockchain_service
            ))

        # Return response
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
        # Call the blockchain service to get the election data
        election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
        # Calculate the status of the election
        election_status = await get_election_status(election_info[3], election_info[4])
        
        # Calculate how many people are registered for an election
        participant_count = await db.public_keys.count_documents({"vote_id": election_id})
        
        # Get threshold (requiredKeys) from the first submitted vote (assuming constant threshold)
        required_keys = 0
        submitted_votes = await blockchain_service.call_contract_function("getVotes", election_id)
        if submitted_votes and len(submitted_votes) > 0:
            # Vote struct: publicKey[0], ciphertext[1], g1r[2], g2r[3], alpha[4], voter[5], threshold[6]
            required_keys = submitted_votes[0][6] # Index 6 is threshold
            
        # Get count of released keys (secret holders with reward_token = 5)
        released_keys = await db.public_keys.count_documents({
            "vote_id": election_id, 
            "is_secret_holder": True, 
            "reward_token": 5
        })

        # Form election information response, including the new counts
        data = await election_information_response(
            election_info,
            election_status, 
            participant_count, 
            required_keys,  # Pass required_keys
            released_keys,  # Pass released_keys
            blockchain_service
        )

        # Return response
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved election information for election {election_id}",
            data=data
        )
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to get election information")


@router.post("/get-winners/{election_id}")
async def get_winners(election_id: int, data: dict, db=Depends(get_db)):
    
    # Get the requester's public key from the request data using the correct key name
    requester_pk_hex = data.get("requesterPublicKey")
    if not requester_pk_hex or not isinstance(requester_pk_hex, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'requesterPublicKey' field.")
    
    # Ensure 0x prefix for consistency
    if not requester_pk_hex.startswith('0x'):
        requester_pk_hex = '0x' + requester_pk_hex

    try:
        # Check if winners have already been selected for this election
        already_selected = await check_winners_already_selected(election_id, db)
        if already_selected:
            results, winner_info = await check_winners(election_id, db)
            return StandardResponse(
                success=True,
                message="Winners already selected",
                data={"results": results, "winnerInfo": winner_info}
            )

        # Generate winners
        results, winner_info = await generate_winners(election_id, db)

        # Return response
        return StandardResponse(
            success=True,
            message="Successfully generated and retrieved winners",
            data={"results": results, "winnerInfo": winner_info}
        )
    except Exception as e:
        logger.error(f"Error getting or generating winners: {str(e)}")
        raise HTTPException(status_code=500, detail=f"failed to get or generate winners: {str(e)}")


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

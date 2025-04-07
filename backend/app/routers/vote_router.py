"""
Vote router for managing votes in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    VoteSubmitRequest, 
    PublicKeyRequest,
    KeyRequest,
    VoteResponse, 
    ShareStatusResponse,
    StandardResponse,
    TransactionResponse,
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/votes", tags=["Votes"])


@router.post("/create-election", response_model=StandardResponse[TransactionResponse])
async def create_election(data: VoteCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service), current_user = Depends(get_current_user)):
    try:
        logger.error(data)
        start_timestamp = int(datetime.fromisoformat(data.start_date).timestamp())
        end_timestamp = int(datetime.fromisoformat(data.end_date).timestamp())
        
        if end_timestamp <= start_timestamp:
            raise handle_validation_error("End date must be after start date")
            
        if len(data.options) < 2:
            raise handle_validation_error("At least two options are required")
            
        reward_pool_wei = blockchain_service.w3.to_wei(data.reward_pool, 'ether')
        required_deposit_wei = blockchain_service.w3.to_wei(data.required_deposit, 'ether')
        
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
        estimated_gas = blockchain_service.contract.functions.createElection(
            data.title,
            data.description,
            start_timestamp,
            end_timestamp,
            data.options,
            reward_pool_wei,
            required_deposit_wei
        ).estimate_gas({"from": WALLET_ADDRESS})
        
        create_election_tx = blockchain_service.contract.functions.createElection(
            data.title,
            data.description,
            start_timestamp,
            end_timestamp,
            data.options,
            reward_pool_wei,
            required_deposit_wei
        ).build_transaction({
            'from': WALLET_ADDRESS,
            'gas': estimated_gas,
            'gasPrice': blockchain_service.w3.eth.gas_price,
            'nonce': nonce,
        })
        
        # Sign and send transaction
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_election_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else blockchain_service.w3.to_hex(tx_hash)
        
        return StandardResponse(
            success=True,
            message="Successfully created election",
            data=TransactionResponse(
                success=True,
                message="Successfully created election",
                transaction_hash=tx_hash_hex
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating election: {str(e)}")
        raise handle_blockchain_error("create election", e)


@router.get("/all-elections")
async def get_all_elections(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Get total number of votes from the smart contract
        num_of_elections = await blockchain_service.call_contract_function("electionCount")
        elections = []
        
        # Get current timestamp
        current_timestamp = int(datetime.now().timestamp())

        # Iterate through each vote and retrieve its data
        for election_id in range(num_of_elections):
            election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
            # Get start and end timestamps
            start_timestamp = election_info[3]
            end_timestamp = election_info[4]
            
            # Determine status based on timestamps
            if current_timestamp < start_timestamp:
                status = "join"
            elif current_timestamp > end_timestamp:
                status = "ended"
            else:
                status = "active"

            elections.append(
                {
                    "id": election_info[0],
                    "title": election_info[1],
                    "description": election_info[2],
                    "start_date": datetime.fromtimestamp(election_info[3]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),
                    "end_date": datetime.fromtimestamp(election_info[4]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),
                    "status": status,
                    "participant_count": 0,
                    "secret_holder_count": 0,
                    "options": election_info[5],
                    "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
                    "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
                }
            )
        logger.info(elections)
        return elections
    except Exception as e:
        logger.error(f"Error in get_all_elections: {str(e)}")
        raise handle_blockchain_error("get all elections", e)


@router.get("/", response_model=StandardResponse[List[VoteResponse]])
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all votes from the blockchain.
    
    Returns:
        List of all votes
    """
    try:
        # Get the vote count from the contract using the helper method
        vote_count = await blockchain_service.call_contract_function("voteCount")
        votes = []
        
        for i in range(vote_count):
            # Get vote data for each vote using the helper method
            vote_data = await blockchain_service.call_contract_function("getVote", i)
            
            # Convert g2r integers to strings
            g2r_values = [str(val) for val in vote_data[3]] if vote_data[3] else []
            votes.append(VoteResponse(
                vote_id=i,  # Use vote_id instead of id
                ciphertext=vote_data[0].hex(),
                nonce=vote_data[1].hex(),
                decryption_time=vote_data[2],
                g2r=g2r_values
            ))
        
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {vote_count} votes",
            data=votes
        )
    except Exception as e:
        logger.error(f"Error getting votes: {str(e)}")
        raise handle_blockchain_error("get votes", e)


@router.post("/get-vote-information/{election_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_vote_information(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        all_votes = []
        votes = await blockchain_service.call_contract_function("getVotes", election_id)
        for index, vote in enumerate(votes):  # Add index tracking
            all_votes.append({
                "id": election_id,
                "vote_id": index,
                "ciphertext": vote[1],
                "g1r": vote[2],
                "g2r": vote[3],
                "alphas": vote[4],
                "voter": vote[5],
                "threshold": vote[6]
            })
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved vote information for election {election_id}",
            data=all_votes
        )
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise handle_blockchain_error("get election information", e)


@router.post("/store-public-key/{vote_id}", response_model=StandardResponse[TransactionResponse])
async def store_public_key(vote_id: int, data: PublicKeyRequest, db=Depends(get_db)):
    # The public key is already validated as a string by Pydantic
    public_key_input = data.public_key
    
    # Prepare the key for storage/query: remove the "0x" prefix if present
    public_key_processed = public_key_input
    if public_key_input.startswith('0x'):
        public_key_processed = public_key_input[2:] # Slice off the "0x"
    
    # Define the filter to find an existing document
    filter_query = {
        "vote_id": vote_id,
        "public_key": public_key_processed, 
    }

    # Define the data to be set on update or insert
    update_data = {
        "$set": {
            "reward_token": 0 if data.is_secret_holder else 1,
            "is_secret_holder": data.is_secret_holder,
            # Ensure vote_id and public_key are also set on insert
            "vote_id": vote_id, 
            "public_key": public_key_processed 
        }
    }

    # Use update_one with upsert=True
    # This will update if found, or insert if not found.
    result = await db.public_keys.update_one(filter_query, update_data, upsert=True)

    # Optional: Check result details if needed (e.g., result.matched_count, result.upserted_id)
    # logger.info(f"Upsert result for vote {vote_id}, key {public_key_processed}: Matched={result.matched_count}, UpsertedId={result.upserted_id}")

    return StandardResponse(
        success=True,
        # Adjust message slightly to reflect upsert logic
        message="Public key stored or updated successfully", 
    )


@router.post("/validate-public-key", response_model=StandardResponse[TransactionResponse])
async def validate_public_key(data: KeyRequest, db=Depends(get_db)):
    public_key_input = data.public_key
    
    # Prepare the key for DB query: remove the "0x" prefix if present
    public_key_to_query = public_key_input
    if public_key_input.startswith('0x'):
        public_key_to_query = public_key_input[2:] # Slice off the "0x"


    # Query the database using the raw hex string (without 0x)
    key = await db.public_keys.find_one({"public_key": public_key_to_query})
    
    if not key:
        # Log the key as received (with 0x for clarity if needed) but query uses raw hex
        logger.warning(f"Public key not found in DB during validation: {public_key_input}")
        raise HTTPException(status_code=404, detail="Invalid public key")
    else:
        return StandardResponse(
            success=True,
            message="Public key validated successfully",
        )


# Function to generate a unique alphanumeric token
def generate_voting_token(length=8):
    """Generate a random voting token."""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choices(characters, k=length))


@router.post("/submit-vote/{election_id}", response_model=StandardResponse[TransactionResponse])
async def submit_vote(election_id: int, request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    
    # --- Validate and process voter public key --- 
    voter_hex = request.get("voter")
    if not voter_hex or not isinstance(voter_hex, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'voter' field (string expected).")
    # Ensure '0x' prefix
    if not voter_hex.startswith('0x'):
        voter_hex = '0x' + voter_hex

    # --- Check if voter already voted --- 
    # Index [5] verified to be the 'voter' string based on the updated contract struct.
    votes_from_chain = await blockchain_service.call_contract_function("getVotes", election_id) 
    if (any(entry[5] == voter_hex for entry in votes_from_chain)):
        raise HTTPException(status_code=400, detail="public key has already cast a vote")
        
    # --- Validate and process list of holder public keys --- 
    public_keys_input = request.get("public_keys")
    if not public_keys_input or not isinstance(public_keys_input, list):
        raise HTTPException(status_code=422, detail="Missing or invalid 'public_keys' field (list expected).")
    
    public_keys_hex_list = []
    for key_str in public_keys_input:
        if not isinstance(key_str, str):
             raise HTTPException(status_code=422, detail=f"Invalid item type in 'public_keys' list (string expected, got {type(key_str)}). Item: {key_str}")
        pk_hex = key_str
        # Ensure '0x' prefix for each key in the list
        if not pk_hex.startswith('0x'):
            pk_hex = '0x' + pk_hex
        public_keys_hex_list.append(pk_hex)
    
    # --- Validate other required fields --- 
    required_fields = ["election_id", "ciphertext", "g1r", "g2r", "alpha", "threshold"]
    for field in required_fields:
        if field not in request:
            raise HTTPException(status_code=422, detail=f"Missing required field: {field}")
            
    # TODO: Add type validation for these fields if necessary (e.g., threshold is int)
    
    # --- Prepare Transaction --- 
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
    
    # Ensure election_id and threshold are integers
    try:
        election_id_int = int(request["election_id"])
        threshold_int = int(request["threshold"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="'election_id' and 'threshold' must be valid integers.")
        
    # Estimate Gas
    estimated_gas = blockchain_service.contract.functions.submitVote(
        election_id_int,
        public_keys_hex_list, # Use corrected list of hex strings
        request["ciphertext"],
        request["g1r"],
        request["g2r"],
        request["alpha"],
        voter_hex, # Use corrected voter hex string
        threshold_int 
    ).estimate_gas({"from": WALLET_ADDRESS})

    # Build Transaction
    create_vote_tx = blockchain_service.contract.functions.submitVote(
        election_id_int,
        public_keys_hex_list, # Use corrected list of hex strings
        request["ciphertext"],
        request["g1r"],
        request["g2r"],
        request["alpha"],
        voter_hex, # Use corrected voter hex string
        threshold_int
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully submitted vote"
        )
    else:
        raise HTTPException(status_code=500, detail="vote failed to be submitted")

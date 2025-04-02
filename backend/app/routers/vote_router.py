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
    
    # Prepare the key for storage: remove the "0x" prefix if present
    public_key_to_store = public_key_input
    if public_key_input.startswith('0x'):
        public_key_to_store = public_key_input[2:] # Slice off the "0x"
    
    public_key_data = {
        "vote_id": vote_id,
        "reward_token": 1,
        "public_key": public_key_to_store, # Store the raw hex string
        "is_secret_holder": data.is_secret_holder,
    }

    if data.is_secret_holder:
        public_key_data["reward_token"] = 0

    await db.public_keys.insert_one(public_key_data)

    return StandardResponse(
        success=True,
        message="Public key stored securely",
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

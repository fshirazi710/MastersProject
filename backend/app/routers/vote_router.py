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
async def store_public_key(vote_id: int, data: dict, db=Depends(get_db)):
    public_key_bytes = bytes(data["public_key"].values())
    public_key_hex = "0x" + public_key_bytes.hex()
    
    public_key_data = {
        "vote_id": vote_id,
        "reward_token": 1,
        "public_key": public_key_hex,
        "is_secret_holder": data["is_secret_holder"],
    }

    if data["is_secret_holder"]:
        public_key_data["reward_token"] = 0

    await db.public_keys.insert_one(public_key_data)

    return StandardResponse(
        success=True,
        message="Public key stored securely",
    )


@router.post("/validate-public-key", response_model=StandardResponse[TransactionResponse])
async def validate_public_key(data: dict, db=Depends(get_db)):
    public_key_bytes = bytes(data["public_key"].values())
    public_key_hex = "0x" + public_key_bytes.hex()
    key = await db.public_keys.find_one({"public_key": public_key_hex})
    if not key:
        logger.warning(f"Public key not found: {data.public_key}")
        raise handle_validation_error("Invalid public key")
    else:
        return StandardResponse(
            success=True,
            message="Public key validated successfully",
        )

@router.post("/submit-vote/{election_id}", response_model=StandardResponse[TransactionResponse])
async def submit_vote(election_id: int, request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    public_keys = []
    
    votes = await blockchain_service.call_contract_function("getVotes", election_id)
    voter_bytes = bytes(request["voter"].values())
    voter_hex = "0x" + voter_bytes.hex()
    
    if (any(entry[5] == voter_hex for entry in votes)):
        raise HTTPException(status_code=400, detail="public key has already cast a vote")
        
    for key in request["public_keys"]:
        public_key_bytes = bytes(key.values())
        public_key_hex = "0x" + public_key_bytes.hex()
        public_keys.append(public_key_hex)
    
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
    estimated_gas = blockchain_service.contract.functions.submitVote(
        int(request["election_id"]),
        public_keys,
        request["ciphertext"],
        request["g1r"],
        request["g2r"],
        request["alpha"],
        voter_hex,
        request["threshold"]
    ).estimate_gas({"from": WALLET_ADDRESS})

    create_election_tx = blockchain_service.contract.functions.submitVote(
        int(request["election_id"]),
        public_keys,
        request["ciphertext"],
        request["g1r"],
        request["g2r"],
        request["alpha"],
        voter_hex,
        request["threshold"]
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_election_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully submitted vote"
        )
    else:
        raise HTTPException(status_code=500, detail="vote failed to be submitted")

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
                "threshold": vote[5]
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


@router.post("", response_model=StandardResponse[TransactionResponse])
async def submit_vote(request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Submit an encrypted vote to the blockchain.
    
    Args:
        request: Vote submission request with vote data and decryption time
        
    Returns:
        Transaction response with transaction hash and vote ID
    """
    try:
        public_keys = []
        for key in request["public_keys"]:
            public_key_bytes = bytes(key.values())
            public_key_hex = "0x" + public_key_bytes.hex()
            public_keys.append(public_key_hex)
            
        logger.info(public_keys)
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

        estimated_gas = blockchain_service.contract.functions.submitVote(
            int(request["election_id"]),
            public_keys,
            request["ciphertext"],
            request["g1r"],
            request["g2r"],
            request["alpha"],
            request["threshold"]
        ).estimate_gas({"from": WALLET_ADDRESS})

        create_election_tx = blockchain_service.contract.functions.submitVote(
            int(request["election_id"]),
            public_keys,
            request["ciphertext"],
            request["g1r"],
            request["g2r"],
            request["alpha"],
            request["threshold"]
        ).build_transaction({
            'from': WALLET_ADDRESS,
            
            'gas': estimated_gas,
            'gasPrice': blockchain_service.w3.eth.gas_price,
            'nonce': nonce,
        })

        # Sign and send transaction
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_election_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else blockchain_service.w3.to_hex(tx_hash)

        return StandardResponse(
            success=True,
            message="Successfully submitted vote",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting vote: {str(e)}")
        raise handle_blockchain_error("submit vote", e)

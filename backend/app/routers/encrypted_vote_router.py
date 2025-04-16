"""
Encrypted Vote router for managing encrypted votes in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    StandardResponse,
    TransactionResponse,
)
from app.services.blockchain import BlockchainService

import logging
import asyncio

# Configure logging
logger = logging.getLogger(__name__)

# Update Router Prefix and Tag
router = APIRouter(prefix="/encrypted-votes", tags=["Encrypted Votes"])


@router.post("/info/{vote_session_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_encrypted_vote_info(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve all submitted encrypted vote data for a specific vote session."""
    try:
        all_votes_data = []
        votes_from_chain = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
        for index, vote_tuple in enumerate(votes_from_chain):
            all_votes_data.append({
                "id": vote_session_id,
                "vote_id": index,
                "ciphertext": vote_tuple[1],
                "g1r": vote_tuple[2],
                "g2r": vote_tuple[3],
                "alphas": vote_tuple[4],
                "voter": vote_tuple[5],
                "threshold": vote_tuple[6]
            })
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved encrypted vote information for session {vote_session_id}",
            data=all_votes_data
        )
    except Exception as e:
        logger.error(f"Error getting encrypted vote information for session {vote_session_id}: {str(e)}")
        raise handle_blockchain_error("get encrypted vote information", e)


@router.post("/submit/{vote_session_id}", response_model=StandardResponse[TransactionResponse])
async def submit_encrypted_vote(vote_session_id: int, request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Submits an encrypted vote to the specified vote session."""

    voter_address = request.get("voter")
    if not voter_address or not isinstance(voter_address, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'voter' field (string expected).")
    try:
        voter_address = blockchain_service.w3.to_checksum_address(voter_address)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voter address format.")

    votes_from_chain = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
    if (any(entry[5] == voter_address for entry in votes_from_chain)):
        raise HTTPException(status_code=400, detail="Voter has already cast a vote in this session")

    holder_addresses_input = request.get("holderAddresses")
    if not holder_addresses_input or not isinstance(holder_addresses_input, list):
        raise HTTPException(status_code=422, detail="Missing or invalid 'holderAddresses' field (list expected).")

    holder_addresses_checksummed = []
    for addr_str in holder_addresses_input:
        if not isinstance(addr_str, str):
             raise HTTPException(status_code=422, detail=f"Invalid item type in 'holderAddresses' list (string expected). Item: {addr_str}")
        try:
            checksummed_addr = blockchain_service.w3.to_checksum_address(addr_str)
            holder_addresses_checksummed.append(checksummed_addr)
        except ValueError:
             raise HTTPException(status_code=422, detail=f"Invalid holder address format in list: {addr_str}")

    required_fields = ["ciphertext", "g1r", "g2r", "alpha", "threshold"]
    for field in required_fields:
        if field not in request:
            raise HTTPException(status_code=422, detail=f"Missing required field: {field}")

    try:
        threshold_int = int(request["threshold"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="'threshold' must be a valid integer.")

    try:
        vote_session_id_int = int(vote_session_id)
    except (ValueError, TypeError):
         raise HTTPException(status_code=400, detail="Invalid vote_session_id format.")

    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

    args = [
        vote_session_id_int,
        holder_addresses_checksummed,
        request["ciphertext"],
        request["g1r"],
        request["g2r"],
        request["alpha"],
        threshold_int
    ]

    estimated_gas = blockchain_service.contract.functions.submitEncryptedVote(*args).estimate_gas({
        "from": WALLET_ADDRESS
    })

    create_vote_tx = blockchain_service.contract.functions.submitEncryptedVote(*args).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = await asyncio.to_thread(blockchain_service.w3.eth.wait_for_transaction_receipt, tx_hash, timeout=120)

    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully submitted encrypted vote",
            data=TransactionResponse(transaction_hash=receipt.transactionHash.hex())
        )
    else:
        revert_reason = "Encrypted vote submission transaction failed."
        try:
            tx = await asyncio.to_thread(blockchain_service.w3.eth.get_transaction, tx_hash)
            revert_data = await asyncio.to_thread(
                blockchain_service.w3.eth.call,
                {'to': tx['to'], 'from': tx['from'], 'value': tx['value'], 'data': tx['input']},
                tx['blockNumber'] - 1
            )
            if revert_data.startswith(b'\x08\xc3y\xa0'):
                 decoded_reason = await asyncio.to_thread(blockchain_service.w3.codec.decode, ['string'], revert_data[4:])
                 revert_reason += " Reason: " + decoded_reason[0]
        except Exception as e:
             logger.warning(f"Could not retrieve revert reason for encrypted vote tx {tx_hash.hex()}: {e}")

        raise HTTPException(status_code=500, detail=revert_reason)

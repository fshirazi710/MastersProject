"""
Vote Session helper for the vote session router
"""
from datetime import datetime
from fastapi import Depends
from app.services.blockchain import BlockchainService
from app.core.dependencies import get_blockchain_service, get_db
from app.core.config import WALLET_ADDRESS, PRIVATE_KEY
import logging
from typing import Optional
import asyncio

# Configure logging
logger = logging.getLogger(__name__)

async def get_vote_session_status(start_timestamp, end_timestamp):
    # Get current timestamp
    current_timestamp = int(datetime.now().timestamp())

    # Determine status based on timestamps
    if current_timestamp < start_timestamp:
        session_status = "join"
    elif current_timestamp > end_timestamp:
        session_status = "ended"
    else:
        session_status = "active"

    return session_status


async def vote_session_information_response(
    session_info, 
    session_status, 
    participant_count,
    required_keys,
    released_keys,
    total_secret_holders,
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
    displayHint: Optional[str] = None,
    sliderConfig: Optional[dict] = None
):
    # Constructs a response containing session information
    return {
        "id": session_info[0],
        "title": session_info[1],
        "description": session_info[2],
        "start_date": datetime.fromtimestamp(session_info[3]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "end_date": datetime.fromtimestamp(session_info[4]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "status": session_status,
        "participant_count": participant_count,
        "secret_holder_count": total_secret_holders,
        "options": session_info[5],
        "reward_pool": blockchain_service.w3.from_wei(session_info[6], 'ether') if len(session_info) > 6 else 0,
        "required_deposit": blockchain_service.w3.from_wei(session_info[7], 'ether') if len(session_info) > 7 else 0,
        "required_keys": required_keys,
        "released_keys": released_keys,
        "displayHint": displayHint,
        "sliderConfig": sliderConfig
    }


async def create_vote_session_transaction(
    core_session_data, # This is the core VoteSessionCreateRequest data 
    start_timestamp, 
    end_timestamp, 
    reward_pool_wei, 
    required_deposit_wei, 
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
):
    # Get the latest transaction nonce for the sender's wallet
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

    # Estimate gas required for the transaction execution
    estimated_gas = blockchain_service.contract.functions.createVoteSession(
        core_session_data.title,
        core_session_data.description,
        start_timestamp,
        end_timestamp,
        core_session_data.options, # Pass options directly from core data
        reward_pool_wei,
        required_deposit_wei
    ).estimate_gas({"from": WALLET_ADDRESS})
    
    # Build the vote session creation transaction
    create_vote_session_tx = blockchain_service.contract.functions.createVoteSession(
        core_session_data.title,
        core_session_data.description,
        start_timestamp,
        end_timestamp,
        core_session_data.options, # Pass options directly from core data
        reward_pool_wei,
        required_deposit_wei
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })
    
    # Sign and send transaction
    signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_session_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    
    # Use asyncio.to_thread for the blocking wait_for_transaction_receipt call
    receipt = await asyncio.to_thread(blockchain_service.w3.eth.wait_for_transaction_receipt, tx_hash, timeout=120)
    
    # Return response
    return receipt

"""
Election helper for the election router
"""
from datetime import datetime
from fastapi import Depends
from app.services.blockchain import BlockchainService
from app.core.dependencies import get_blockchain_service
from app.core.config import WALLET_ADDRESS, PRIVATE_KEY


async def get_election_status(start_timestamp, end_timestamp):
    # Get current timestamp
    current_timestamp = int(datetime.now().timestamp())

    # Determine status based on timestamps
    if current_timestamp < start_timestamp:
        election_status = "join"
    elif current_timestamp > end_timestamp:
        election_status = "ended"
    else:
        election_status = "active"

    return election_status


async def election_information_response(election_info, election_status, participant_count, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # Constructs a response containing election information
    return {
        "id": election_info[0],
        "title": election_info[1],
        "description": election_info[2],
        "start_date": datetime.fromtimestamp(election_info[3]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "end_date": datetime.fromtimestamp(election_info[4]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "status": election_status,
        "participant_count": participant_count,
        "secret_holder_count": 0,
        "options": election_info[5],
        "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
        "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
    }


async def create_election_transaction(data, start_timestamp, end_timestamp, reward_pool_wei, required_deposit_wei, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # Get the latest transaction nonce for the sender's wallet
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
    
    # Estimate gas required for the transaction execution
    estimated_gas = blockchain_service.contract.functions.createElection(
        data.title,
        data.description,
        start_timestamp,
        end_timestamp,
        data.options,
        reward_pool_wei,
        required_deposit_wei
    ).estimate_gas({"from": WALLET_ADDRESS})
    
    # Build the election creation transaction
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
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    # Return response
    return receipt
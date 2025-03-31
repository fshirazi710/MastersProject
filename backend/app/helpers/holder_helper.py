"""
Holder helper for the holder router
"""
from fastapi import Depends
from app.services.blockchain import BlockchainService
from app.core.dependencies import get_blockchain_service
from app.core.config import WALLET_ADDRESS, PRIVATE_KEY


async def join_as_holder_transaction(election_id, public_key_hex, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # Get the latest transaction nonce for the sender's wallet
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
    
    # Estimate gas required for the transaction execution
    estimated_gas = blockchain_service.contract.functions.joinAsHolder(
        election_id, public_key_hex
    ).estimate_gas({"from": WALLET_ADDRESS})

    # Build the election creation transaction
    join_as_holder_tx = blockchain_service.contract.functions.joinAsHolder(
        election_id, public_key_hex
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    # Sign and send transaction
    signed_tx = blockchain_service.w3.eth.account.sign_transaction(join_as_holder_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    # Return response
    return receipt
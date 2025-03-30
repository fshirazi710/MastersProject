"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.schemas import (
    JoinHolderRequest,
    StandardResponse,
    TransactionResponse,
    HolderCountResponse,
    HolderStatusResponse,
    RequiredDepositResponse,
    HolderResponse
)
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holders", tags=["Holders"])


@router.get("/{election_id}")
async def get_all_holders(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all registered secret holders.
    
    Returns:
        List of holder addresses with their public keys and status
    """
    try:
        # Call the blockchain service to get all holders using the helper method
        holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)

        return StandardResponse(
            success=True,
            message="Successfully retrieved all holders",
            data=holders
        )
    except Exception as e:
        logger.error(f"Error getting all holders: {str(e)}")
        raise handle_blockchain_error("get all holders", e)


@router.get("/count/{election_id}", response_model=StandardResponse[HolderCountResponse])
async def get_holder_count(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get the total number of registered holders.
    
    Returns:
        Count of registered holders
    """
    try:
        # Call the blockchain service to get the holder count using the helper method
        count = await blockchain_service.call_contract_function("getNumHoldersByElection", election_id)
        return StandardResponse(
            success=True,
            message="Successfully retrieved holder count",
            data=HolderCountResponse(count=count)
        )
    except Exception as e:
        logger.error(f"Error getting holder count: {str(e)}")
        raise handle_blockchain_error("get holder count", e)


@router.post("/join/{election_id}", response_model=StandardResponse[TransactionResponse])
async def join_as_holder(
    election_id: int,
    request: dict,
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
    db=Depends(get_db)
):
    public_key_bytes = bytes(request["public_key"].values())
    public_key_hex = "0x" + public_key_bytes.hex()
    
    secret_holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)
    if public_key_hex in secret_holders:
        raise HTTPException(status_code=400, detail="this public key has already been registered")
    
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
    estimated_gas = blockchain_service.contract.functions.joinAsHolder(
        election_id, public_key_hex
    ).estimate_gas({"from": WALLET_ADDRESS})

    join_as_holder_tx = blockchain_service.contract.functions.joinAsHolder(
        election_id, public_key_hex
    ).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = blockchain_service.w3.eth.account.sign_transaction(join_as_holder_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully joined as a secret holder"
        )
    else:
        raise HTTPException(status_code=500, detail="secret holder failed to be stored on the blockchain")

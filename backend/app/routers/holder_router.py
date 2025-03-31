"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_blockchain_service
from app.schemas import (
    StandardResponse,
    TransactionResponse,
    HolderCountResponse,
)
from app.helpers.holder_helper import join_as_holder_transaction
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holders", tags=["Holders"])


@router.get("/{election_id}")
async def get_all_holders(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Call the blockchain service to get all holders using the helper method
        holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)

        # Return response
        return StandardResponse(
            success=True,
            message="Successfully retrieved all holders",
            data=holders
        )
    except Exception as e:
        logger.error(f"Error getting all holders: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to retrieve list of all secret holders")


@router.get("/count/{election_id}", response_model=StandardResponse[HolderCountResponse])
async def get_holder_count(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Call the blockchain service to get the holder count using the helper method
        count = await blockchain_service.call_contract_function("getNumHoldersByElection", election_id)
        
        # Return response
        return StandardResponse(
            success=True,
            message="Successfully retrieved holder count",
            data=HolderCountResponse(count=count)
        )
    except Exception as e:
        logger.error(f"Error getting holder count: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to retrieve number of secret holders")


@router.post("/join/{election_id}", response_model=StandardResponse[TransactionResponse])
async def join_as_holder(
    election_id: int,
    request: dict,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    # Convert the public key to a hexadecimal string format
    public_key_bytes = bytes(request["public_key"].values())
    public_key_hex = "0x" + public_key_bytes.hex()
    
    # Retrieve the list of secret holders already registered for the given election
    secret_holders = await blockchain_service.call_contract_function("getHoldersByElection", election_id)
    
    # Check if the public key is already registered; if so, raise an error
    if public_key_hex in secret_holders:
        raise HTTPException(status_code=400, detail="this public key has already been registered")
    
    # Call helper function to execute the transaction for joining as a holder   
    receipt = await join_as_holder_transaction(election_id, public_key_hex, blockchain_service)
    
    # Check the transaction status and return response
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully joined as a secret holder"
        )
    else:
        raise HTTPException(status_code=500, detail="secret holder failed to be stored on the blockchain")

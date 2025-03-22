"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from app.core.dependencies import get_blockchain_service
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
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holders", tags=["Holders"])

@router.get("/", response_model=StandardResponse[List[HolderResponse]])
async def get_all_holders(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all registered secret holders.
    
    Returns:
        List of holder addresses with their public keys and status
    """
    try:
        # Call the blockchain service to get all holders using the helper method
        holders = await blockchain_service.call_contract_function("getHolders")
        holder_responses = []
        for holder in holders:
            # Get holder's public key using the helper method
            public_key = await blockchain_service.call_contract_function("getHolderPublicKey", holder)
            holder_responses.append(HolderResponse(
                address=holder,
                public_key=public_key,
                active=True  # We assume active if they're in the holders list
            ))
        return StandardResponse(
            success=True,
            message="Successfully retrieved all holders",
            data=holder_responses
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

@router.get("/status/{address}", response_model=StandardResponse[HolderStatusResponse])
async def check_holder_status(address: str, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Check if an address is a registered holder.
    
    Args:
        address: Ethereum address to check
        
    Returns:
        Boolean indicating if the address is a holder
    """
    try:
        # Call the blockchain service to check if the address is a holder using the helper method
        is_holder = await blockchain_service.call_contract_function("isHolder", address)
        return StandardResponse(
            success=True,
            message=f"Address is {'a holder' if is_holder else 'not a holder'}",
            data=HolderStatusResponse(is_holder=is_holder)
        )
    except Exception as e:
        logger.error(f"Error checking holder status: {str(e)}")
        raise handle_blockchain_error("check holder status", e)

@router.get("/deposit", response_model=StandardResponse[RequiredDepositResponse])
async def get_required_deposit(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get the required deposit amount to become a holder.
    
    Returns:
        Required deposit amount in ETH
    """
    try:
        # Call the blockchain service to get the required deposit using the helper method
        deposit_wei = await blockchain_service.call_contract_function("requiredDeposit")
        deposit_eth = blockchain_service.w3.from_wei(deposit_wei, 'ether')
        return StandardResponse(
            success=True,
            message="Successfully retrieved required deposit",
            data=RequiredDepositResponse(required_deposit=deposit_eth)
        )
    except Exception as e:
        logger.error(f"Error getting required deposit: {str(e)}")
        raise handle_blockchain_error("get required deposit", e)

@router.post("/join/{election_id}", response_model=StandardResponse[TransactionResponse])
async def join_as_holder(
    election_id: int,
    request: dict,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Join as a secret holder by staking a deposit.
    
    Args:
        request: Join request with public key and deposit amount
        
    Returns:
        Transaction response with transaction hash
    """
    try:
        # Validate public key format
        if not isinstance(request["public_key"], list) or len(request["public_key"]) != 2:
            raise handle_validation_error("Public key must be a list with exactly two components")
        
        # Convert public key strings to integers
        try:
            public_key = [int(x) for x in request["public_key"]]
        except ValueError:
            raise handle_validation_error("Public key components must be valid integers")
        
        # Call the blockchain service to join as holder
        result = await blockchain_service.join_as_holder(
            election_id=election_id,
            public_key=public_key
        )
        
        if not result.get("success", False):
            raise handle_blockchain_error("join as holder", Exception(result.get("error", "Unknown error")))
            
        return StandardResponse(
            success=True,
            message="Successfully joined as a secret holder",
            data=TransactionResponse(
                success=True,
                message="Successfully joined as holder",
                transaction_hash=result["transaction_hash"]
            )
        )
    except Exception as e:
        logger.error(f"Error joining as holder: {str(e)}")
        raise handle_blockchain_error("join as holder", e) 
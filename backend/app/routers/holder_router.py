"""
Secret holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.models.blockchain import JoinHolderRequest, HolderStatusResponse
from app.schemas.responses import StandardResponse, TransactionResponse
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holders", tags=["Secret Holders"])

@router.get("", response_model=StandardResponse[List[str]])
async def get_all_holders(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all registered secret holders.
    
    Returns:
        List of holder addresses
    """
    try:
        # Call the blockchain service to get all holders
        holders = blockchain_service.contract.functions.getHolders().call()
        return StandardResponse(
            success=True,
            message="Successfully retrieved holders",
            data=holders
        )
    except Exception as e:
        logger.error(f"Error getting holders: {str(e)}")
        raise handle_blockchain_error("get holders", e)

@router.get("/count", response_model=StandardResponse[dict])
async def get_holder_count(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get the number of registered secret holders.
    
    Returns:
        Count of holders
    """
    try:
        # Call the blockchain service to get the number of holders
        count = blockchain_service.contract.functions.getNumHolders().call()
        return StandardResponse(
            success=True,
            message="Successfully retrieved holder count",
            data={"count": count}
        )
    except Exception as e:
        logger.error(f"Error getting holder count: {str(e)}")
        raise handle_blockchain_error("get holder count", e)

@router.get("/{address}", response_model=StandardResponse[HolderStatusResponse])
async def check_holder_status(address: str, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Check if an address is a registered secret holder.
    
    Args:
        address: Ethereum address to check
        
    Returns:
        Holder status and public key if available
    """
    try:
        # Call the blockchain service to check if the address is a holder
        is_holder = blockchain_service.contract.functions.isHolder(address).call()
        
        response = {"is_holder": is_holder, "public_key": None}
        
        # If the address is a holder, get the public key
        if is_holder:
            public_key = blockchain_service.contract.functions.getHolderPublicKey(address).call()
            response["public_key"] = [int(public_key[0]), int(public_key[1])]
            
        return StandardResponse(
            success=True,
            message=f"Address {address} is {'a' if is_holder else 'not a'} holder",
            data=response
        )
    except Exception as e:
        logger.error(f"Error checking holder status: {str(e)}")
        raise handle_blockchain_error("check holder status", e)

@router.get("/deposit", response_model=StandardResponse[dict])
async def get_required_deposit(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get the required deposit amount to become a secret holder.
    
    Returns:
        Required deposit amount in ETH
    """
    try:
        # Get the required deposit
        deposit_wei = blockchain_service.contract.functions.requiredDeposit().call()
        deposit = blockchain_service.w3.from_wei(deposit_wei, 'ether')
        return StandardResponse(
            success=True,
            message="Successfully retrieved required deposit",
            data={"deposit_amount": float(deposit)}
        )
    except Exception as e:
        logger.error(f"Error getting required deposit: {str(e)}")
        raise handle_blockchain_error("get required deposit", e)

@router.post("/join", response_model=TransactionResponse)
async def join_as_holder(request: JoinHolderRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Join as a secret holder by staking a deposit.
    
    Args:
        request: Join holder request with deposit amount and public key
        
    Returns:
        Transaction response with transaction hash
    """
    try:
        # Validate the public key
        if len(request.public_key) != 2:
            raise handle_validation_error("Public key must have exactly 2 components [x, y]")
            
        # Call the blockchain service to join as a holder
        result = await blockchain_service.join_as_holder(request.deposit_amount)
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to join as holder"))
            
        return TransactionResponse(
            success=True,
            message="Successfully joined as a secret holder",
            transaction_hash=result["transaction_hash"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining as holder: {str(e)}")
        raise handle_blockchain_error("join as holder", e) 
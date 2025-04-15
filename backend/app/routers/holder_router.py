"""
Holder router for managing secret holders in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_blockchain_service
from app.schemas import (
    StandardResponse,
    TransactionResponse,
    HolderCountResponse,
    JoinHolderStringRequest,
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


# Updated endpoint: Checks eligibility, does not submit transaction
@router.post("/join/{election_id}", response_model=StandardResponse)
async def check_holder_join_eligibility(
    election_id: int,
    request: JoinHolderStringRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """Check if a public key is eligible to join an election as a holder."""
    public_key_hex = request.public_key

    # Ensure 0x prefix
    if not public_key_hex.startswith('0x'):
        public_key_hex = "0x" + public_key_hex

    try:
        # Use the new efficient check from BlockchainService
        is_active = await blockchain_service.is_holder_active(election_id, public_key_hex)

        # Check if the public key is already registered and active
        if is_active:
            # Raise 409 Conflict, as the state already exists
            raise HTTPException(status_code=409, detail="Public key is already registered as an active holder for this election")

        # If not active, the key is eligible to join via frontend transaction
        return StandardResponse(
            success=True,
            message="Public key is eligible to join as a holder for this election"
            # No transaction data to return
        )

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions (like the 409)
        raise http_exc
    except Exception as e:
        logger.error(f"Error checking holder eligibility for {public_key_hex} in election {election_id}: {str(e)}")
        # Generic server error for other issues
        raise HTTPException(status_code=500, detail="Failed to check holder eligibility")

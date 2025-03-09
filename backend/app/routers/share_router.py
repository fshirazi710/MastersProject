"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error, handle_not_found_error
from app.schemas import (
    ShareSubmitRequest, 
    ShareVerificationRequest, 
    ShareVerificationResponse,
    StandardResponse,
    TransactionResponse
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

@router.post("", response_model=StandardResponse[TransactionResponse])
async def submit_share(request: ShareSubmitRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Submit a share for a vote.
    
    Args:
        request: Share submission request with vote ID and share data
        
    Returns:
        Transaction response with transaction hash
    """
    try:
        # Call the blockchain service to submit the share
        result = await blockchain_service.submit_share(
            vote_id=request.vote_id,
            share=(request.share_index, request.share_value)
        )
        
        if not result.get("success", False):
            raise handle_blockchain_error("submit share", Exception(result.get("error", "Unknown error")))
            
        return StandardResponse(
            success=True,
            message="Share submitted successfully",
            data=TransactionResponse(
                success=True,
                message="Share submitted successfully",
                transaction_hash=result["transaction_hash"]
            )
        )
    except Exception as e:
        logger.error(f"Error submitting share: {str(e)}")
        raise handle_blockchain_error("submit share", e)

@router.post("/verify", response_model=StandardResponse[ShareVerificationResponse])
async def verify_share(
    request: ShareVerificationRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """Verify a share submission."""
    try:
        # Convert share tuple to list
        share_list = list(request.share)
        is_valid = await blockchain_service.verify_share_submission(
            vote_id=request.vote_id,
            holder_address=request.holder_address,
            share=share_list
        )
        
        return StandardResponse(
            success=True,
            message="Share verification successful" if is_valid else "Share verification failed",
            data=ShareVerificationResponse(
                valid=is_valid,
                holder_address=request.holder_address,
                vote_id=request.vote_id
            )
        )
    except Exception as e:
        logger.error(f"Error verifying share: {str(e)}")
        raise handle_blockchain_error("verify share", e)

@router.get("/by-vote/{vote_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_submitted_shares(vote_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all submitted shares for a vote.
    
    Args:
        vote_id: ID of the vote
        
    Returns:
        List of submitted shares with holder addresses
    """
    try:
        # Check if the vote exists
        try:
            await blockchain_service.contract.functions.getVote(vote_id).call()
        except Exception:
            # Use raise instead of return to ensure the exception is propagated
            raise handle_not_found_error("Vote", str(vote_id))
            
        # Call the blockchain service to get the submitted shares
        get_shares_func = blockchain_service.contract.functions.getSubmittedShares(vote_id)
        submitters, shares = await get_shares_func.call()
        
        # Format the response
        result = []
        for i in range(len(submitters)):
            result.append({
                "holder_address": submitters[i],
                "share_index": int(shares[i][0]),
                "share_value": int(shares[i][1])
            })
            
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {len(result)} submitted shares for vote {vote_id}",
            data={
                "vote_id": vote_id,
                "submitted_shares": result,
                "count": len(result)
            }
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like 404) directly
        raise
    except Exception as e:
        logger.error(f"Error getting submitted shares: {str(e)}")
        raise handle_blockchain_error("get submitted shares", e) 
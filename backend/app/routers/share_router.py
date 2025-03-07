"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.core.dependencies import get_blockchain_service
from app.core.error_handling import handle_blockchain_error, handle_not_found_error
from app.models.blockchain import ShareSubmitRequest, ShareVerificationRequest, ShareVerificationResponse
from app.schemas.responses import StandardResponse, TransactionResponse
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

@router.post("", response_model=TransactionResponse)
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
            
        return TransactionResponse(
            success=True,
            message="Share submitted successfully",
            transaction_hash=result["transaction_hash"]
        )
    except Exception as e:
        logger.error(f"Error submitting share: {str(e)}")
        raise handle_blockchain_error("submit share", e)

@router.post("/verify", response_model=StandardResponse[ShareVerificationResponse])
async def verify_share(request: ShareVerificationRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Verify if a share is valid.
    
    Args:
        request: Share verification request with vote ID, holder address, and share
        
    Returns:
        Verification result
    """
    try:
        # Call the blockchain service to verify the share
        is_valid = await blockchain_service.verify_share_submission(
            vote_id=request.vote_id,
            holder_address=request.holder_address,
            share=request.share
        )
        
        response = ShareVerificationResponse(
            valid=is_valid,
            holder_address=request.holder_address,
            vote_id=request.vote_id
        )
        
        return StandardResponse(
            success=True,
            message=f"Share verification {'successful' if is_valid else 'failed'}",
            data=response
        )
    except Exception as e:
        logger.error(f"Error verifying share: {str(e)}")
        raise handle_blockchain_error("verify share", e)

@router.get("/votes/{vote_id}", response_model=StandardResponse[Dict[str, Any]])
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
            blockchain_service.contract.functions.getVote(vote_id).call()
        except Exception:
            raise handle_not_found_error("Vote", str(vote_id))
            
        # Call the blockchain service to get the submitted shares
        submitters, shares = blockchain_service.contract.functions.getSubmittedShares(vote_id).call()
        
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
    except Exception as e:
        logger.error(f"Error getting submitted shares: {str(e)}")
        raise handle_blockchain_error("get submitted shares", e) 
"""
Vote router for managing votes in the system.
"""
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error, handle_not_found_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    VoteSubmitRequest, 
    VoteCreateRequest, 
    VoteResponse, 
    DecryptVoteRequest, 
    DecryptVoteResponse,
    VotingTokenRequest,
    VotingTokenResponse,
    TokenValidationRequest,
    ShareStatusResponse,
    StandardResponse,
    TransactionResponse,
    VoteStatusResponse
)
from app.services.blockchain import BlockchainService

import logging
import random
import string

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/votes", tags=["Votes"])

@router.get("/", response_model=StandardResponse[List[VoteResponse]])
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all votes from the blockchain.
    
    Returns:
        List of all votes
    """
    try:
        vote_count = await blockchain_service.contract.functions.voteCount().call()
        votes = []
        
        for i in range(vote_count):
            vote_data = await blockchain_service.contract.functions.getVote(i).call()
            votes.append(VoteResponse(
                id=i,
                ciphertext=vote_data[0].hex(),
                nonce=vote_data[1].hex(),
                decryption_time=vote_data[2],
                g2r=vote_data[3]
            ))
        
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {vote_count} votes",
            data=votes
        )
    except Exception as e:
        logger.error(f"Error getting votes: {str(e)}")
        raise handle_blockchain_error("get votes", e)

@router.get("/{vote_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_vote_data(vote_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get vote data by ID.
    
    Args:
        vote_id: ID of the vote
        
    Returns:
        Vote data including ciphertext, nonce, and decryption time
    """
    try:
        # Call the blockchain service to get the vote data
        vote_data = await blockchain_service.contract.functions.getVote(vote_id).call()
        
        # Convert the vote data to a readable format
        data = {
            "id": vote_id,
            "ciphertext": vote_data[0].hex() if vote_data[0] else None,
            "nonce": vote_data[1].hex() if vote_data[1] else None,
            "decryption_time": vote_data[2] if len(vote_data) > 2 else None,
            "g2r": [str(vote_data[3][0]), str(vote_data[3][1])] if len(vote_data) > 3 and vote_data[3] else None,
            "title": vote_data[4] if len(vote_data) > 4 else None,
            "description": vote_data[5] if len(vote_data) > 5 else None,
            "start_date": datetime.fromtimestamp(vote_data[6]).isoformat() if len(vote_data) > 6 else None,
            "end_date": datetime.fromtimestamp(vote_data[7]).isoformat() if len(vote_data) > 7 else None,
            "status": vote_data[8] if len(vote_data) > 8 else None,
            "participant_count": vote_data[9] if len(vote_data) > 9 else None,
            "options": vote_data[10] if len(vote_data) > 10 else None,
            "reward_pool": blockchain_service.w3.from_wei(vote_data[11], 'ether') if len(vote_data) > 11 else 0,
            "required_deposit": blockchain_service.w3.from_wei(vote_data[12], 'ether') if len(vote_data) > 12 else 0,
        }
        
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved vote data for vote {vote_id}",
            data=data
        )
    except Exception as e:
        logger.error(f"Error getting vote data: {str(e)}")
        raise handle_blockchain_error("get vote data", e)

@router.get("/status", response_model=StandardResponse[VoteStatusResponse])
async def get_vote_status(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get the status of all votes.
    
    Returns:
        Status information for all votes
    """
    try:
        total_votes = await blockchain_service.contract.functions.voteCount().call()
        active_votes = 0
        closed_votes = 0
        decrypted_votes = 0
        
        for i in range(total_votes):
            vote_data = await blockchain_service.contract.functions.getVote(i).call()
            status = vote_data[5] if len(vote_data) > 5 else None
            if status == "active":
                active_votes += 1
            elif status == "closed":
                closed_votes += 1
            elif status == "decrypted":
                decrypted_votes += 1
        
        return StandardResponse(
            success=True,
            message="Successfully retrieved vote status",
            data=VoteStatusResponse(
                total_votes=total_votes,
                active_votes=active_votes,
                closed_votes=closed_votes,
                decrypted_votes=decrypted_votes
            )
        )
    except Exception as e:
        logger.error(f"Error getting vote status: {str(e)}")
        raise handle_blockchain_error("get vote status", e)

@router.post("", response_model=TransactionResponse)
async def submit_vote(request: VoteSubmitRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Submit an encrypted vote to the blockchain.
    
    Args:
        request: Vote submission request with vote data and decryption time
        
    Returns:
        Transaction response with transaction hash and vote ID
    """
    try:
        # Validate the decryption time
        current_time = int(datetime.now(UTC).timestamp())
        if request.decryption_time <= current_time:
            raise handle_validation_error("Decryption time must be in the future")
            
        # Call the blockchain service to submit the vote
        result = await blockchain_service.submit_vote(
            vote_data=request.vote_data.encode('utf-8'),
            decryption_time=request.decryption_time,
            reward_amount=request.reward_amount,
            threshold=request.threshold
        )
        
        if not result.get("success", False):
            raise handle_blockchain_error("submit vote", Exception(result.get("error", "Unknown error")))
            
        return TransactionResponse(
            success=True,
            message="Vote submitted successfully",
            transaction_hash=result["transaction_hash"],
            vote_id=result.get("vote_id"),
            threshold=result.get("threshold")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting vote: {str(e)}")
        raise handle_blockchain_error("submit vote", e)

@router.post("/create", response_model=TransactionResponse)
async def create_vote(data: VoteCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Create a new vote on the blockchain.
    
    Args:
        data: Vote creation data
        
    Returns:
        Transaction response with transaction hash
    """
    try:
        # Convert datetime strings to Unix timestamps
        start_date = datetime.strptime(data.start_date, "%Y-%m-%dT%H:%M:%S")
        end_date = datetime.strptime(data.end_date, "%Y-%m-%dT%H:%M:%S")

        # Get the next nonce for the transaction
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS, "pending")

        # Estimate gas needed for the transaction
        estimated_gas = blockchain_service.contract.functions.createVote(
            data.title,
            data.description,
            int(start_date.timestamp()),
            int(end_date.timestamp()),
            "join",
            0,
            data.options,
            blockchain_service.w3.to_wei(data.reward_pool, 'ether'),
            blockchain_service.w3.to_wei(data.required_deposit, 'ether'),
        ).estimate_gas({"from": WALLET_ADDRESS})

        # Build the transaction
        transaction = blockchain_service.contract.functions.createVote(
            data.title,
            data.description,
            int(start_date.timestamp()),
            int(end_date.timestamp()),
            "join",
            0,
            data.options,
            blockchain_service.w3.to_wei(data.reward_pool, 'ether'),
            blockchain_service.w3.to_wei(data.required_deposit, 'ether'),
        ).build_transaction(
            {
                "chainId": 11155111,
                "gas": estimated_gas,
                "gasPrice": blockchain_service.w3.to_wei("40", "gwei"),
                "nonce": nonce,
            }
        )

        # Sign and send the transaction
        signed_txn = blockchain_service.w3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        return TransactionResponse(
            success=True,
            message="Vote created successfully",
            transaction_hash=tx_hash.hex()
        )
    except Exception as e:
        logger.error(f"Error creating vote: {str(e)}")
        raise handle_blockchain_error("create vote", e)

# Function to generate a unique alphanumeric token
def generate_voting_token(length=8):
    """Generate a random voting token."""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choices(characters, k=length))

@router.post("/tokens/{vote_id}", response_model=StandardResponse[VotingTokenResponse])
async def generate_token(vote_id: int, db=Depends(get_db)):
    """
    Generate a unique voting token for a vote.
    
    Args:
        vote_id: ID of the vote
        
    Returns:
        StandardResponse with generated token
    """
    try:
        # Generate a unique token
        max_attempts = 10  # Prevent infinite loops
        attempts = 0
        
        while attempts < max_attempts:
            token = generate_voting_token()
            
            # Check if the token already exists
            existing_token = await db.election_tokens.tokens.find_one({"token": token})
            if existing_token is None:
                # Create token object
                token_data = {
                    "vote_id": vote_id,
                    "token": token,
                    "created_at": datetime.now(UTC).isoformat()
                }
                
                # Save the token
                await db.election_tokens.tokens.insert_one(token_data)
                
                # Create response
                token_response = VotingTokenResponse(
                    token=token,
                    vote_id=vote_id
                )
                
                return StandardResponse(
                    success=True,
                    message="Token generated successfully",
                    data=token_response
                )
            
            attempts += 1
        
        # If we couldn't generate a unique token after max attempts
        raise handle_validation_error("Failed to generate unique token after maximum attempts")
        
    except Exception as e:
        logger.error(f"Error generating token: {str(e)}")
        raise handle_blockchain_error("generate token", e)

@router.get("/tokens/validate", response_model=StandardResponse[Dict[str, bool]])
async def validate_token(token: str, db=Depends(get_db)):
    """
    Validate a voting token.
    
    Args:
        token: Token to validate
        
    Returns:
        StandardResponse with validation result
    """
    try:
        # Check if the token exists
        existing_token = await db.election_tokens.tokens.find_one({"token": token})
        
        return StandardResponse(
            success=True,
            message=f"Token validation {'successful' if existing_token else 'failed'}",
            data={"valid": existing_token is not None}
        )
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        raise handle_blockchain_error("validate token", e)

@router.get("/{vote_id}/shares", response_model=StandardResponse[ShareStatusResponse])
async def get_share_status(
    vote_id: int,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Get the status of share submissions for a vote.
    
    Args:
        vote_id: ID of the vote
        
    Returns:
        Share status including total holders, submitted shares, and missing shares
    """
    try:
        # Call the blockchain service to get the share status
        status = await blockchain_service.get_share_status(vote_id)
        return StandardResponse(
            success=True,
            message="Successfully retrieved share status",
            data=ShareStatusResponse(
                total_holders=status["total_holders"],
                submitted_shares=status["submitted_shares"],
                missing_shares=status["missing_shares"],
                holders=status["holder_status"]
            )
        )
    except Exception as e:
        logger.error(f"Error getting share status: {str(e)}")
        raise handle_blockchain_error("get share status", e)

@router.post("/{vote_id}/decrypt", response_model=StandardResponse[DecryptVoteResponse])
async def decrypt_vote(
    vote_id: int,
    request: Optional[DecryptVoteRequest] = None,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """
    Decrypt a vote using submitted shares.
    
    Args:
        vote_id: ID of the vote
        request: Optional request with custom threshold
        
    Returns:
        Decrypted vote data
    """
    try:
        # Call the blockchain service to decrypt the vote
        threshold = request.threshold if request and hasattr(request, 'threshold') else None
        result = await blockchain_service.decrypt_vote(vote_id, threshold)
        
        if not result.get("success", False):
            raise handle_blockchain_error("decrypt vote", Exception(result.get("error", "Unknown error")))
            
        return StandardResponse(
            success=True,
            message="Vote decrypted successfully",
            data=DecryptVoteResponse(
                vote_id=vote_id,
                vote_data=result["data"]["vote_data"],
                decryption_time=result["data"]["decryption_time"],
                shares_used=result["data"]["shares_used"],
                threshold=result["data"]["threshold"]
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting vote: {str(e)}")
        raise handle_blockchain_error("decrypt vote", e)
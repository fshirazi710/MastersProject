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
from app.routers.auth_router import get_current_user

import logging
import random
import string

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/votes", tags=["Votes"])

# Endpoint to retrieve all votes
@router.get("/all-votes")
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Get total number of votes from the smart contract
        vote_count = await blockchain_service.call_contract_function("voteCount1")
        votes = []

        # Iterate through each vote and retrieve its data
        for vote_id in range(vote_count):
            vote_data = await blockchain_service.call_contract_function("getVote1", vote_id)
            votes.append(
                {
                    "id": vote_data[0],
                    "title": vote_data[1],
                    "description": vote_data[2],
                    "startDate": datetime.fromtimestamp(vote_data[3]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),  # Convert Unix timestamps to formatted datetime strings
                    "endDate": datetime.fromtimestamp(vote_data[4]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),  # Convert Unix timestamps to formatted datetime strings
                    "status": vote_data[5],
                    "participantCount": vote_data[6],
                    "options": vote_data[7],
                    "reward_pool": blockchain_service.w3.from_wei(vote_data[11], 'ether') if len(vote_data) > 11 else 0,
                    "required_deposit": blockchain_service.w3.from_wei(vote_data[12], 'ether') if len(vote_data) > 12 else 0,
                }
            )
        return {"data": votes}
    except Exception as e:
        logger.error(f"Error in get_all_votes: {str(e)}")
        return {"data": [], "error": str(e)}

@router.get("/", response_model=StandardResponse[List[VoteResponse]])
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all votes from the blockchain.
    
    Returns:
        List of all votes
    """
    try:
        # Get the vote count from the contract using the helper method
        vote_count = await blockchain_service.call_contract_function("voteCount1")
        votes = []
        
        for i in range(vote_count):
            # Get vote data for each vote using the helper method
            vote_data = await blockchain_service.call_contract_function("getVote1", i)
            
            # Convert g2r integers to strings
            g2r_values = [str(val) for val in vote_data[3]] if vote_data[3] else []
            votes.append(VoteResponse(
                vote_id=i,  # Use vote_id instead of id
                ciphertext=vote_data[0].hex(),
                nonce=vote_data[1].hex(),
                decryption_time=vote_data[2],
                g2r=g2r_values
            ))
        
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {vote_count} votes",
            data=votes
        )
    except Exception as e:
        logger.error(f"Error getting votes: {str(e)}")
        raise handle_blockchain_error("get votes", e)

@router.get("/summary", response_model=StandardResponse[VoteStatusResponse])
async def get_vote_summary(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get a summary of all votes.
    
    Returns:
        Status information for all votes
    """
    try:
        total_votes = await blockchain_service.call_contract_function("voteCount")
        active_votes = 0
        closed_votes = 0
        decrypted_votes = 0
        
        for i in range(total_votes):
            vote_data = await blockchain_service.call_contract_function("getVote", i)
            status = vote_data[8] if len(vote_data) > 8 else None
            if status == "active":
                active_votes += 1
            elif status == "closed":
                closed_votes += 1
            elif status == "decrypted":
                decrypted_votes += 1
        
        return StandardResponse(
            success=True,
            message="Successfully retrieved vote summary",
            data=VoteStatusResponse(
                total_votes=total_votes,
                active_votes=active_votes,
                closed_votes=closed_votes,
                decrypted_votes=decrypted_votes
            )
        )
    except Exception as e:
        logger.error(f"Error getting vote summary: {str(e)}")
        raise handle_blockchain_error("get vote summary", e)


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
        # Call the blockchain service to get the vote data using the helper method
        vote_data = await blockchain_service.call_contract_function("getVote1", vote_id)
        # Convert the vote data to a readable format
        data = {
            "id": vote_id,
            "title": vote_data[1] if len(vote_data) > 1 else None,
            "description": vote_data[2] if len(vote_data) > 2 else None,
            "start_date": datetime.fromtimestamp(vote_data[3]).isoformat() if len(vote_data) > 3 else None,
            "end_date": datetime.fromtimestamp(vote_data[4]).isoformat() if len(vote_data) > 4 else None,
            "status": vote_data[5] if len(vote_data) > 5 else None,
            "participant_count": vote_data[6] if len(vote_data) > 6 else None,
            "options": vote_data[7] if len(vote_data) > 7 else None,
            "reward_pool": blockchain_service.w3.from_wei(vote_data[8], 'ether') if len(vote_data) > 8 else 0,
            "required_deposit": blockchain_service.w3.from_wei(vote_data[9], 'ether') if len(vote_data) > 9 else 0,
        }
        logger.error(data)
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved vote data for vote {vote_id}",
            data=data
        )
    except Exception as e:
        logger.error(f"Error getting vote data: {str(e)}")
        raise handle_blockchain_error("get vote data", e)

@router.post("", response_model=StandardResponse[TransactionResponse])
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
            request.vote_data,
            request.decryption_time,
            request.reward_amount or 0.1,  # Default to 0.1 ETH if not provided
            request.threshold
        )
        
        if not result.get("success", False):
            raise handle_blockchain_error("submit vote", Exception(result.get("error", "Unknown error")))
            
        return StandardResponse(
            success=True,
            message="Successfully submitted vote",
            data=TransactionResponse(
                success=True,
                message="Successfully submitted vote",
                transaction_hash=result["transaction_hash"],
                vote_id=result.get("vote_id")
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting vote: {str(e)}")
        raise handle_blockchain_error("submit vote", e)

@router.post("/create", response_model=StandardResponse[TransactionResponse])
async def create_vote(
    data: VoteCreateRequest, 
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
    current_user = Depends(get_current_user)  # Only require authentication for vote creation
):
    """
    Create a new vote with options and parameters.
    
    Args:
        data: Vote creation data
        blockchain_service: Blockchain service
        current_user: Current authenticated user
        
    Returns:
        Transaction response with transaction hash
    """
    try:
        logger.error(data)
        # Validate dates
        start_timestamp = int(datetime.fromisoformat(data.start_date).timestamp())
        end_timestamp = int(datetime.fromisoformat(data.end_date).timestamp())
        
        if end_timestamp <= start_timestamp:
            raise handle_validation_error("End date must be after start date")
            
        if len(data.options) < 2:
            raise handle_validation_error("At least two options are required")
            
        # Convert ETH to Wei
        reward_pool_wei = blockchain_service.w3.to_wei(data.reward_pool, 'ether')
        required_deposit_wei = blockchain_service.w3.to_wei(data.required_deposit, 'ether')
        
        # Get transaction count for nonce
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
        estimated_gas = blockchain_service.contract.functions.createVote(
            data.title,
            data.description,
            start_timestamp,
            end_timestamp,
            data.options,
            reward_pool_wei,
            required_deposit_wei
        ).estimate_gas({"from": WALLET_ADDRESS})
         
        # Create vote transaction
        create_vote_tx = blockchain_service.contract.functions.createVote(
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
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else blockchain_service.w3.to_hex(tx_hash)
        
        return StandardResponse(
            success=True,
            message="Successfully created vote",
            data=TransactionResponse(
                success=True,
                message="Successfully created vote",
                transaction_hash=tx_hash_hex
            )
        )
    except HTTPException:
        raise
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
        token: The token to validate
        
    Returns:
        Validation result
    """
    try:
        # Check if the token exists in the database
        token_doc = await db.election_tokens.tokens.find_one({"token": token})
        
        if token_doc:
            return StandardResponse(
                success=True,
                message="Token is valid",
                data={"valid": True, "vote_id": token_doc["vote_id"]}
            )
        else:
            return StandardResponse(
                success=True,
                message="Token is invalid",
                data={"valid": False}
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
                holder_status=status["holder_status"]
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
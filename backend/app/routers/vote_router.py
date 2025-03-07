"""
Vote router for managing votes in the system.
"""
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import APIRouter, Depends, HTTPException
from web3 import Web3
from app.models.vote import votingToken
from app.core.mongodb import get_mongodb
from app.models.vote import voteData
from app.core.config import (
    CONTRACT_ADDRESS,
    WEB3_PROVIDER_URL,
    WALLET_ADDRESS,
    PRIVATE_KEY,
    CONTRACT_ABI,
)
import random
import string
import logging
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.services.blockchain import BlockchainService
from app.models.blockchain import VoteSubmitRequest, VoteResponse, ShareStatusResponse, DecryptVoteRequest, DecryptVoteResponse
from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.schemas.responses import StandardResponse, TransactionResponse

# Create a router instance for handling vote-related API endpoints
router = APIRouter(prefix="/votes", tags=["Votes"])

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize Web3 connection and contract instance
web3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
contract = web3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

# Dependency to get blockchain service
def get_blockchain_service():
    return BlockchainService()

# Request and response models
class VoteSubmitRequest(BaseModel):
    vote_data: str = Field(..., description="The vote data to encrypt and submit")
    decryption_time: int = Field(..., description="Unix timestamp when the vote can be decrypted")

class VoteResponse(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote")
    ciphertext: str = Field(..., description="The encrypted vote data")
    decryption_time: int = Field(..., description="Unix timestamp when the vote can be decrypted")
    submitted_at: int = Field(..., description="Unix timestamp when the vote was submitted")

class ShareStatusResponse(BaseModel):
    total_holders: int = Field(..., description="Total number of secret holders")
    submitted_shares: int = Field(..., description="Number of shares that have been submitted")
    missing_shares: int = Field(..., description="Number of shares that are still missing")
    holders: Dict[str, Any] = Field(..., description="Status of each holder's share submission")

# Endpoint to retrieve all votes
@router.get("", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all votes from the blockchain.
    
    Returns:
        List of all votes
    """
    try:
        # Get total number of votes from the smart contract
        vote_count = blockchain_service.contract.functions.voteCount().call()
        votes = []

        # Iterate through each vote and retrieve its data
        for vote_id in range(vote_count):
            try:
                vote_data = blockchain_service.contract.functions.getVote(vote_id).call()
                votes.append({
                    "id": vote_id,
                    "ciphertext": vote_data[0].hex() if vote_data[0] else None,
                    "nonce": vote_data[1].hex() if vote_data[1] else None,
                    "decryption_time": vote_data[2],
                    "g2r": [str(vote_data[3][0]), str(vote_data[3][1])] if vote_data[3] else None
                })
            except Exception as e:
                logger.warning(f"Error retrieving vote {vote_id}: {str(e)}")
                # Continue to next vote if one fails
                continue
                
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved {len(votes)} votes",
            data=votes
        )
    except Exception as e:
        logger.error(f"Error getting all votes: {str(e)}")
        raise handle_blockchain_error("get all votes", e)

# Endpoint to retrieve a specific vote by its ID
@router.get("/vote/{vote_id}")
async def get_vote(vote_id: int):
    # Get the vote data from the smart contract using the provided vote_id
    vote_data = contract.functions.getVote(vote_id).call()
    return {
        "data": {
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
            "rewardPool": web3.from_wei(vote_data[10], 'ether') if len(vote_data) > 10 else 0,
            "requiredDeposit": web3.from_wei(vote_data[9], 'ether') if len(vote_data) > 9 else 0,
        }
    }

# Endpoint to retrieve the status of votes (currently just returns a success message)
@router.get("/vote-status")
async def get_vote_status():
    return {"message": "Vote Status Retrieved"}

# Endpoint for creating a vote
@router.post("/create-vote")
async def create_vote(data: voteData):
    # Convert datetime strings to Unix timestamps
    start_date = datetime.strptime(data.startDate, "%Y-%m-%dT%H:%M")
    end_date = datetime.strptime(data.endDate, "%Y-%m-%dT%H:%M")

    # Get the next nonce for the transaction
    nonce = web3.eth.get_transaction_count(WALLET_ADDRESS, "pending")

    # Estimate gas needed for the transaction
    estimated_gas = contract.functions.createVote(
        data.title,
        data.description,
        int(start_date.timestamp()),
        int(end_date.timestamp()),
        "join",
        0,
        data.options,
        web3.to_wei(data.rewardPool, 'ether'),
        web3.to_wei(data.requiredDeposit, 'ether'),
    ).estimate_gas({"from": WALLET_ADDRESS})

    # Build the transaction
    transaction = contract.functions.createVote(
        data.title,
        data.description,
        int(start_date.timestamp()),
        int(end_date.timestamp()),
        "join",
        0,
        data.options,
        web3.to_wei(data.rewardPool, 'ether'),
        web3.to_wei(data.requiredDeposit, 'ether'),
    ).build_transaction(
        {
            "chainId": 11155111,
            "gas": estimated_gas,
            "gasPrice": web3.to_wei("40", "gwei"),
            "nonce": nonce,
        }
    )

    # Sign and send the transaction
    signed_txn = web3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)
    web3.eth.send_raw_transaction(signed_txn.raw_transaction)

    return {"message": "Vote Created "}

# Endpoint for casting a vote (currently just returns a success message)
@router.post("/cast-vote")
async def cast_vote():
    return {"message": "Vote Casted"}

# Function to generate a unique alphanumeric token
def generate_voting_token(length=8):
    characters = string.ascii_letters + string.digits  # Combine letters and digits
    return ''.join(random.choices(characters, k=length))  # Generate a random sequence

# Endpoint for generating a unique sequence
@router.post("/generate-token/{vote_id}")
async def generate_token(vote_id: int, db: AsyncIOMotorClient = Depends(get_mongodb)):
    # Retrieve all existing sequences from the database
    while True:  # Loop until a unique sequence is found
        token_object = votingToken(
            vote_id=vote_id,
            token=generate_voting_token(),
        )
        
        # Check if the sequence already exists in the database
        existing_sequence = await db.election_tokens.tokens.find_one({"voting_token": token_object.token})  # Use sequence.unique_sequence directly
        if existing_sequence is None:  # If it doesn't exist, save it
            await db.election_tokens.tokens.insert_one(token_object.dict())  # Save user to the database without _id
            return {"token": token_object.token}  # Return the generated sequence

# Endpoint for validating a voting token
@router.get("/validate-token")
async def validate_token(token: str, db: AsyncIOMotorClient = Depends(get_mongodb)):
    # Check if the token exists in the database
    existing_token = await db.election_tokens.tokens.find_one({"token": token})  # Query the database for the token

    if existing_token:  # If the token exists
        return {"valid": True}
    else:
        return {"valid": False}

# Endpoints
@router.post("/votes", response_model=dict, tags=["Votes"])
async def submit_vote(request: VoteSubmitRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Submit an encrypted vote to the blockchain"""
    try:
        # Validate the decryption time
        current_time = int(datetime.now().timestamp())
        if request.decryption_time <= current_time:
            raise HTTPException(status_code=400, detail="Decryption time must be in the future")
            
        # Call the blockchain service to submit the vote
        result = await blockchain_service.submit_vote(
            vote_data=request.vote_data.encode('utf-8'),
            decryption_time=request.decryption_time
        )
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to submit vote"))
            
        return {
            "success": True,
            "message": "Vote submitted successfully",
            "transaction_hash": result["transaction_hash"],
            "vote_id": result["vote_id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting vote: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit vote: {str(e)}")

@router.get("/votes/{vote_id}", tags=["Votes"])
async def get_vote_data(vote_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Get vote data by ID"""
    try:
        # Call the blockchain service to get the vote data (synchronous)
        vote_data = blockchain_service.contract.functions.getVote(vote_id).call()
        
        # Convert the vote data to a readable format
        return {
            "vote_id": vote_id,
            "ciphertext": vote_data[0].hex() if vote_data[0] else None,
            "nonce": vote_data[1].hex() if vote_data[1] else None,
            "decryption_time": vote_data[2],
            "g2r": [str(vote_data[3][0]), str(vote_data[3][1])] if vote_data[3] else None
        }
    except Exception as e:
        logger.error(f"Error getting vote data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get vote data: {str(e)}")

@router.get("/votes/{vote_id}/shares", response_model=ShareStatusResponse, tags=["Votes"])
async def get_share_status(vote_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Get the status of share submissions for a vote"""
    try:
        # Call the blockchain service to get the share status
        status = await blockchain_service.get_share_status(vote_id)
        return status
    except Exception as e:
        logger.error(f"Error getting share status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get share status: {str(e)}")

@router.post("/votes/{vote_id}/decrypt", response_model=DecryptVoteResponse, tags=["Votes"])
async def decrypt_vote(vote_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Decrypt a vote using submitted shares"""
    try:
        # Call the blockchain service to decrypt the vote (synchronous)
        result = blockchain_service.decrypt_vote(vote_id)
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to decrypt vote"))
            
        return {
            "vote_id": vote_id,
            "decrypted_data": result["decrypted_data"],
            "decryption_time": result["decryption_time"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting vote: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to decrypt vote: {str(e)}")
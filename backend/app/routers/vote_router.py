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
    PublicKeyRequest,
    KeyRequest,
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


@router.post("/create-election", response_model=StandardResponse[TransactionResponse])
async def create_election(data: VoteCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service), current_user = Depends(get_current_user)):
    try:
        logger.error(data)
        start_timestamp = int(datetime.fromisoformat(data.start_date).timestamp())
        end_timestamp = int(datetime.fromisoformat(data.end_date).timestamp())
        
        if end_timestamp <= start_timestamp:
            raise handle_validation_error("End date must be after start date")
            
        if len(data.options) < 2:
            raise handle_validation_error("At least two options are required")
            
        reward_pool_wei = blockchain_service.w3.to_wei(data.reward_pool, 'ether')
        required_deposit_wei = blockchain_service.w3.to_wei(data.required_deposit, 'ether')
        
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)
        estimated_gas = blockchain_service.contract.functions.createElection(
            data.title,
            data.description,
            start_timestamp,
            end_timestamp,
            data.options,
            reward_pool_wei,
            required_deposit_wei
        ).estimate_gas({"from": WALLET_ADDRESS})
         
        create_election_tx = blockchain_service.contract.functions.createElection(
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
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_election_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else blockchain_service.w3.to_hex(tx_hash)
        
        return StandardResponse(
            success=True,
            message="Successfully created election",
            data=TransactionResponse(
                success=True,
                message="Successfully created election",
                transaction_hash=tx_hash_hex
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating election: {str(e)}")
        raise handle_blockchain_error("create election", e)


@router.get("/all-elections")
async def get_all_elections(blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Get total number of votes from the smart contract
        num_of_elections = await blockchain_service.call_contract_function("electionCount")
        elections = []
        
        # Get current timestamp
        current_timestamp = int(datetime.now().timestamp())

        # Iterate through each vote and retrieve its data
        for election_id in range(num_of_elections):
            election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
            # Get start and end timestamps
            start_timestamp = election_info[3]
            end_timestamp = election_info[4]
            
            # Determine status based on timestamps
            if current_timestamp < start_timestamp:
                status = "join"
            elif current_timestamp > end_timestamp:
                status = "ended"
            else:
                status = "active"

            participant_count = await db.public_keys.count_documents({"vote_id": election_id})

            elections.append(
                {
                    "id": election_info[0],
                    "title": election_info[1],
                    "description": election_info[2],
                    "start_date": datetime.fromtimestamp(election_info[3]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),
                    "end_date": datetime.fromtimestamp(election_info[4]).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),
                    "status": status,
                    "participant_count": participant_count,
                    "secret_holder_count": 0,
                    "options": election_info[5],
                    "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
                    "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
                }
            )
        return elections
    except Exception as e:
        logger.error(f"Error in get_all_elections: {str(e)}")
        raise handle_blockchain_error("get all elections", e)


@router.get("/election/{election_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_election_information(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Call the blockchain service to get the vote data using the helper method
        election_info = await blockchain_service.call_contract_function("getElection", election_id)
        
        # Get current timestamp
        current_timestamp = int(datetime.now().timestamp())
        
        # Get start and end timestamps
        start_timestamp = election_info[3]
        end_timestamp = election_info[4]
        
        # Determine status based on timestamps
        if current_timestamp < start_timestamp:
            status = "join"
        elif current_timestamp > end_timestamp:
            status = "ended"
        else:
            status = "active"
        
        participant_count = await db.public_keys.count_documents({"vote_id": election_id})
        
        # Convert the vote data to a readable format
        data = {
            "id": election_id,
            "title": election_info[1] if len(election_info) > 1 else None,
            "description": election_info[2] if len(election_info) > 2 else None,
            "start_date": datetime.fromtimestamp(election_info[3]).isoformat() if len(election_info) > 3 else None,
            "end_date": datetime.fromtimestamp(election_info[4]).isoformat() if len(election_info) > 4 else None,
            "status": status,
            "participant_count": participant_count,
            "secret_holder_count": 0,
            "options": election_info[5] if len(election_info) > 7 else None,
            "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
            "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
        }

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved election information for election {election_id}",
            data=data
        )
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise handle_blockchain_error("get election information", e)


@router.post("/store-public-key/{vote_id}", response_model=StandardResponse[TransactionResponse])
async def store_public_key(vote_id: int, data: PublicKeyRequest, db=Depends(get_db)):
    public_key_data = {
        "vote_id": vote_id,
        "reward_token": 1,
        "public_key": data.public_key,
        "is_secret_holder": data.is_secret_holder,
    }

    if data.is_secret_holder:
        public_key_data["reward_token"] = 0

    await db.public_keys.insert_one(public_key_data)

    return StandardResponse(
        success=True,
        message="Public key stored securely",
    )


@router.post("/validate-public-key", response_model=StandardResponse[TransactionResponse])
async def validate_public_key(data: KeyRequest, db=Depends(get_db)):
    key = await db.public_keys.find_one({"public_key": data.public_key})
    if not key:
        logger.warning(f"Public key not found: {data.public_key}")
        raise handle_validation_error("Invalid public key")
    else:
        return StandardResponse(
            success=True,
            message="Public key validated successfully",
        )


@router.get("/", response_model=StandardResponse[List[VoteResponse]])
async def get_all_votes(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """
    Get all votes from the blockchain.
    
    Returns:
        List of all votes
    """
    try:
        # Get the vote count from the contract using the helper method
        vote_count = await blockchain_service.call_contract_function("voteCount")
        votes = []
        
        for i in range(vote_count):
            # Get vote data for each vote using the helper method
            vote_data = await blockchain_service.call_contract_function("getVote", i)
            
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
        vote_data = await blockchain_service.call_contract_function("getVote", vote_id)
        
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
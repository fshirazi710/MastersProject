"""
Election router for managing elections in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.dependencies import get_blockchain_service, get_db
from app.schemas import (
    ElectionCreateRequest,
    StandardResponse,
    TransactionResponse
)
from app.helpers.election_helper import get_election_status, election_information_response, create_election_transaction
from app.services.blockchain import BlockchainService
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/elections", tags=["Elections"])


@router.post("/create-election", response_model=StandardResponse[TransactionResponse])
async def create_election(data: ElectionCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    # Convert start and end dates from ISO format to Unix timestamps
    start_timestamp = int(datetime.fromisoformat(data.start_date).timestamp())
    end_timestamp = int(datetime.fromisoformat(data.end_date).timestamp())
    
    # Convert reward pool and required deposit from Ether to Wei (smallest Ethereum unit)
    reward_pool_wei = blockchain_service.w3.to_wei(data.reward_pool, 'ether')
    required_deposit_wei = blockchain_service.w3.to_wei(data.required_deposit, 'ether')
    
    # Call helper function to create the election transaction and get the receipt
    receipt = await create_election_transaction(data, start_timestamp, end_timestamp, reward_pool_wei, required_deposit_wei, blockchain_service)
    
    # Check the transaction status and return response
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully created election",
        )
    else:
        raise HTTPException(status_code=500, detail="failed to create election")


@router.get("/all-elections", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_all_elections(blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Get total number of votes from the smart contract
        elections = []
        num_of_elections = await blockchain_service.call_contract_function("electionCount")

        # Iterate through each vote and retrieve its data
        for election_id in range(num_of_elections):

            # Retrieve election information from the blockchain
            election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
            # Calculate the status of the election
            election_status = await get_election_status(election_info[3], election_info[4])

            # Calculate how many people are registered for an election
            participant_count = await db.public_keys.count_documents({"vote_id": election_id})

            # Add election information to an array
            elections.append(await election_information_response(election_info, election_status, participant_count, blockchain_service))

        # Return response
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved election information for all elections",
            data=elections
        )
    except Exception as e:
        logger.error(f"Error in get_all_elections: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to get all election information")


@router.get("/election/{election_id}", response_model=StandardResponse[Dict[str, Any]])
async def get_election_information(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    try:
        # Call the blockchain service to get the vote data using the helper method
        election_info = await blockchain_service.call_contract_function("getElection", election_id)
            
        # Calculate the status of the election
        election_status = await get_election_status(election_info[3], election_info[4])
        
        # Calculate how many people are registered for an election
        participant_count = await db.public_keys.count_documents({"vote_id": election_id})
        
        # Form election information
        data = await election_information_response(election_info, election_status, participant_count, blockchain_service)

        # Return response
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved election information for election {election_id}",
            data=data
        )
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise HTTPException(status_code=500, detail="failed to get election information")


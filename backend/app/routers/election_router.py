"""
Election router for managing elections in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    ElectionCreateRequest,
    StandardResponse,
    TransactionResponse
)
from app.services.blockchain import BlockchainService
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/elections", tags=["Elections"])


@router.post("/create-election", response_model=StandardResponse[TransactionResponse])
async def create_election(data: ElectionCreateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
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
    receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
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

        return StandardResponse(
            success=True,
            message=f"Successfully retrieved election information for all elections",
            data=elections
        )
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

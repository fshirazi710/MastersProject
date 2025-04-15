"""
Vote router for managing votes in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any

from app.routers.auth_router import get_current_user
from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    VoteSubmitRequest, 
    PublicKeyRequest,
    KeyRequest,
    VoteResponse, 
    ShareStatusResponse,
    StandardResponse,
    TransactionResponse,
)
from app.schemas.vote import VoteCreateRequest
from app.services.blockchain import BlockchainService

import logging

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
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
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
async def get_all_elections(blockchain_service: BlockchainService = Depends(get_blockchain_service)):
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
                    "participant_count": 0,
                    "secret_holder_count": 0,
                    "options": election_info[5],
                    "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
                    "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
                }
            )
        logger.info(elections)
        return elections
    except Exception as e:
        logger.error(f"Error in get_all_elections: {str(e)}")
        raise handle_blockchain_error("get all elections", e)


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


@router.post("/get-vote-information/{election_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_vote_information(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        all_votes = []
        votes = await blockchain_service.call_contract_function("getVotes", election_id)
        for index, vote in enumerate(votes):  # Add index tracking
            all_votes.append({
                "id": election_id,
                "vote_id": index,
                "ciphertext": vote[1],
                "g1r": vote[2],
                "g2r": vote[3],
                "alphas": vote[4],
                "voter": vote[5],
                "threshold": vote[6]
            })
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved vote information for election {election_id}",
            data=all_votes
        )
    except Exception as e:
        logger.error(f"Error getting election information: {str(e)}")
        raise handle_blockchain_error("get election information", e)


@router.post("/submit-vote/{election_id}", response_model=StandardResponse[TransactionResponse])
async def submit_vote(election_id: int, request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    
    # --- Validate and process voter address --- 
    voter_address = request.get("voter")
    if not voter_address or not isinstance(voter_address, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'voter' field (string expected).")
    # Ensure checksum address
    try:
        voter_address = blockchain_service.w3.to_checksum_address(voter_address)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voter address format.")

    # --- Check if voter already voted --- 
    votes_from_chain = await blockchain_service.call_contract_function("getVotes", election_id) 
    if (any(entry[5] == voter_address for entry in votes_from_chain)): # Index 5 is voter address in Vote struct
        raise HTTPException(status_code=400, detail="Voter has already cast a vote in this election")
        
    # --- Validate and process list of holder addresses --- 
    holder_addresses_input = request.get("holderAddresses") # Match Vote struct field name
    if not holder_addresses_input or not isinstance(holder_addresses_input, list):
        raise HTTPException(status_code=422, detail="Missing or invalid 'holderAddresses' field (list expected).")
    
    holder_addresses_checksummed = []
    for addr_str in holder_addresses_input:
        if not isinstance(addr_str, str):
             raise HTTPException(status_code=422, detail=f"Invalid item type in 'holderAddresses' list (string expected). Item: {addr_str}")
        try:
            checksummed_addr = blockchain_service.w3.to_checksum_address(addr_str)
            holder_addresses_checksummed.append(checksummed_addr)
        except ValueError:
             raise HTTPException(status_code=422, detail=f"Invalid holder address format in list: {addr_str}")
    
    # --- Validate other required fields --- 
    required_fields = ["ciphertext", "g1r", "g2r", "alpha", "threshold"]
    for field in required_fields:
        if field not in request:
            raise HTTPException(status_code=422, detail=f"Missing required field: {field}")
            
    # Ensure threshold is integer
    try:
        threshold_int = int(request["threshold"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="'threshold' must be a valid integer.")

    # --- Prepare Transaction --- 
    # Ensure election_id is int
    try:
        election_id_int = int(election_id)
    except (ValueError, TypeError):
         raise HTTPException(status_code=400, detail="Invalid election_id format.") # Should be caught by path param validation, but good practice

    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

    # Arguments for submitVote contract function
    args = [
        election_id_int,              # uint256 electionId
        holder_addresses_checksummed, # address[] memory _holderAddresses
        request["ciphertext"],       # string memory ciphertext
        request["g1r"],               # string memory g1r
        request["g2r"],               # string memory g2r
        request["alpha"],             # string[] memory alpha
        threshold_int                 # uint256 threshold
        # Note: 'voter' (msg.sender) is implicit in the contract call
    ]
    
    # Estimate Gas
    estimated_gas = blockchain_service.contract.functions.submitVote(*args).estimate_gas({
        "from": WALLET_ADDRESS # This tx must be sent from the backend wallet
    })

    # Build Transaction
    create_vote_tx = blockchain_service.contract.functions.submitVote(*args).build_transaction({
        'from': WALLET_ADDRESS,
        'gas': estimated_gas,
        'gasPrice': blockchain_service.w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_tx, PRIVATE_KEY)
    tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = await blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt.status == 1:
        return StandardResponse(
            success=True,
            message="Successfully submitted vote"
        )
    else:
        # Attempt to get revert reason (optional, may fail)
        revert_reason = "Vote submission transaction failed."
        try:
            tx = await blockchain_service.w3.eth.get_transaction(tx_hash)
            revert_data = await blockchain_service.w3.eth.call({'to': tx['to'], 'from': tx['from'], 'value': tx['value'], 'data': tx['input']}, tx['blockNumber'] - 1)
            # Decode revert reason (requires knowing the error ABI, often just Error(string))
            # This is a simplified example, actual decoding can be complex
            if revert_data.startswith(b'\x08\xc3y\xa0'): # Error(string) selector
                 revert_reason += " Reason: " + blockchain_service.w3.codec.decode(['string'], revert_data[4:])[0]
        except Exception as e:
             logger.warning(f"Could not retrieve revert reason for tx {tx_hash.hex()}: {e}")

        raise HTTPException(status_code=500, detail=revert_reason)

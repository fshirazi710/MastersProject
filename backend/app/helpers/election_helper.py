"""
Election helper for the election router
"""
from datetime import datetime
from fastapi import Depends
from app.services.blockchain import BlockchainService
from app.core.dependencies import get_blockchain_service, get_db
from app.core.config import WALLET_ADDRESS, PRIVATE_KEY
import logging
import random
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

async def get_election_status(start_timestamp, end_timestamp):
    # Get current timestamp
    start_timestamp_utc = start_timestamp - 3600
    end_timestamp_utc = end_timestamp - 3600

    current_timestamp = int(datetime.now().timestamp())

    # Determine status based on timestamps
    if current_timestamp < start_timestamp_utc:
        election_status = "join"
    elif current_timestamp > end_timestamp_utc:
        election_status = "ended"
    else:
        election_status = "active"

    return election_status



async def election_information_response(
    election_info, 
    election_status, 
    participant_count, 
    required_keys,
    released_keys,
    total_secret_holders,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    # Constructs a response containing election information
    return {
        "id": election_info[0],
        "title": election_info[1],
        "description": election_info[2],
        "start_date": datetime.fromtimestamp(election_info[3]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "end_date": datetime.fromtimestamp(election_info[4]).strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "status": election_status,
        "participant_count": participant_count,
        "secret_holder_count": 0,
        "totalSecretHolders": total_secret_holders,
        "options": election_info[5],
        "reward_pool": blockchain_service.w3.from_wei(election_info[6], 'ether') if len(election_info) > 6 else 0,
        "required_deposit": blockchain_service.w3.from_wei(election_info[7], 'ether') if len(election_info) > 7 else 0,
        "required_keys": required_keys,
        "released_keys": released_keys,
    }


async def create_election_transaction(
    data, # This is now the core ElectionCreateRequest data 
    start_timestamp, 
    end_timestamp, 
    reward_pool_wei, 
    required_deposit_wei, 
    blockchain_service: BlockchainService = Depends(get_blockchain_service),
    # --- REMOVED questionType and sliderConfig params --- 
):
    # Get the latest transaction nonce for the sender's wallet
    nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

    # --- REMOVED logging and options_to_send logic --- 
    
    # Estimate gas required for the transaction execution
    estimated_gas = blockchain_service.contract.functions.createElection(
        data.title,
        data.description,
        start_timestamp,
        end_timestamp,
        data.options, # Pass options directly from core data
        reward_pool_wei,
        required_deposit_wei
    ).estimate_gas({"from": WALLET_ADDRESS})
    
    # Build the election creation transaction
    create_election_tx = blockchain_service.contract.functions.createElection(
        data.title,
        data.description,
        start_timestamp,
        end_timestamp,
        data.options, # Pass options directly from core data
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
    
    # Return response
    return receipt


async def generate_winners(election_id, db=Depends(get_db)):
    """Generates winners based on reward tokens and stores them.
    Returns a tuple: (list_of_winner_public_keys, status_message)
    """
    # Retrieve the list of users who voted in the given election
    users = await db.public_keys.find({"vote_id": election_id}).to_list(None)

    # Check if there are no users
    if not users:
        logger.warning(f"No users found for election {election_id}")
        return [], "No participants found for this election." # Return empty list and message
    
    # Initialize an empty list to hold the raffle entries    
    raffle = []
    for user in users:
        public_key = user["public_key"] # Assuming this is the raw hex string
        # Get reward token directly from DB (defaults to 0 if missing)
        reward_token = user.get("reward_token", 0)
        
        # REMOVED check for released_secret - rely solely on reward_token value
        
        # Add public key to the raffle based on reward tokens
        # Ensure reward_token is an integer
        try:
            num_entries = int(reward_token)
        except (ValueError, TypeError):
            logger.warning(f"Invalid reward_token '{reward_token}' for user {public_key}, skipping entries.")
            num_entries = 0
            
        if num_entries > 0:
            raffle.extend([public_key] * num_entries)

    # If no valid entries in the raffle, print a message and return
    if not raffle:
        logger.warning(f"No valid raffle entries for election {election_id}, no winners selected.")
        return [], "No participants eligible for rewards." # Return empty list and message

    # Randomly select up to 5 winners from the raffle
    winners = []
    while len(winners) < 5 and raffle:
        winner = random.choice(raffle)
        winners.append(winner)
        # Remove all instances of the winner from the raffle
        raffle = [entry for entry in raffle if entry != winner]

    # Store the winners in the database
    await db.winners.insert_one({"election_id": election_id, "winners": winners})
    logger.info(f"Generated {len(winners)} winners for election {election_id}: {winners}")
    
    # Return the list of winners and a success message
    return winners, f"Successfully generated {len(winners)} winners."


async def check_winners_already_selected(election_id: int, db=Depends(get_db)):
    # Checks if winners have already been selected
    return bool(await db.winners.find_one({"election_id": election_id}))


async def check_winners(election_id, db=Depends(get_db)):
    """Gets previously selected winners and returns them.
    Returns a tuple: (list_of_winner_public_keys, status_message)
    """
    winner_doc = await db.winners.find_one({"election_id": election_id})
    if winner_doc and "winners" in winner_doc:
        winners = winner_doc["winners"]
        return winners, f"Retrieved {len(winners)} previously selected winners."
    else:
        return [], "No winners previously selected or found."

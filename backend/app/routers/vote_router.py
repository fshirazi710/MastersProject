from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import APIRouter, Depends
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

# Create a router instance for handling vote-related API endpoints
router = APIRouter()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize Web3 connection and contract instance
web3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
contract = web3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)


# Endpoint to retrieve all votes
@router.get("/all-votes")
async def get_all_votes():
    # Get total number of votes from the smart contract
    vote_count = contract.functions.voteCount().call()
    votes = []

    # Iterate through each vote and retrieve its data
    for vote_id in range(vote_count):
        vote_data = contract.functions.getVote(vote_id).call()
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
            }
        )
    return {"data": votes}


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
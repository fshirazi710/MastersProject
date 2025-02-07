from fastapi import APIRouter
from app.models.vote import voteData
import json
import os

# Create a router instance for handling vote-related API endpoints
router = APIRouter()

# TEMPORARY: Load the votes data from a JSON file
file_path = os.path.join(os.path.dirname(__file__), "../data/votes.json")
with open(file_path, "r") as file:
    votes = json.load(file)

# Endpoint to retrieve all votes
@router.get("/all-votes")
async def get_all_votes():
    return {"data": votes}

# Endpoint to retrieve the status of votes (currently just returns a success message)
@router.get("/vote-status")
async def get_vote_status():
    return {"message": "Vote Status Retrieved"}

# Endpoint for creating a vote (currently just returns a success message)
@router.post("/create-vote")
async def create_vote(data: voteData):
    return {"message": "Vote Created "}

# Endpoint for casting a vote (currently just returns a success message)
@router.post("/cast-vote")
async def cast_vote():
    return {"message": "Vote Casted"}

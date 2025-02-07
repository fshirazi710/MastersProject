from fastapi import APIRouter
from app.models.vote import voteData

router = APIRouter()

@router.get("/all-votes")
async def get_all_votes():
    return {"message": "Retrieving All Votes"}

@router.get("/vote-status")
async def get_vote_status():
    return {"message": "Vote Status Retrieved"}

@router.post("/create-vote")
async def create_vote(data: voteData):
    return {"message": "Vote Created "}

@router.post("/cast-vote")
async def cast_vote():
    return {"message": "Vote Casted"}

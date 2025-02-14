from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.secret_holder import JoinSessionRequest
from typing import List
import random

router = APIRouter()

@router.get("/secret-holder-positions")
async def get_available_positions():
    # TODO: Implement actual database query
    # This is mock data for now
    mock_sessions = [
        {
            "id": 1,
            "title": "Community Guidelines Vote",
            "description": "Vote on the new community guidelines and governance structure",
            "requiredDeposit": 0.5,
            "currentHolders": 2,
            "requiredHolders": 5,
            "startDate": "2024-04-01",
            "endDate": "2024-04-15"
        },
        # Add more mock sessions...
    ]
    
    return {"sessions": mock_sessions}

@router.post("/secret-holders/join")
async def join_as_holder(request: JoinSessionRequest):
    try:
        # TODO: Implement actual deposit logic and key generation
        # This is a placeholder that just validates the deposit amount
        if request.depositAmount < 0.1:
            raise HTTPException(status_code=400, message="Deposit must be at least 0.1 ETH")
            
        # Generate a mock secret key (this should be replaced with actual key generation)
        mock_secret_key = "sk_" + "".join(random.choices("0123456789abcdef", k=32))
        
        return {
            "message": "Successfully registered as secret holder",
            "secretKey": mock_secret_key
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 
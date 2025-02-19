from fastapi import APIRouter, Depends
from app.models.authentication import registerData, loginData
import logging

# Create a router instance for handling vote-related API endpoints
router = APIRouter()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Endpoint for secret holders and vote organisers to login (currently just returns a success message)
@router.post("/login")
async def login(data: loginData):
    logger.info(data)
    return {"message": "Successfully Logged In"}


# Endpoint for secret holders and vote organisers to register (currently just returns a success message)
@router.post("/register")
async def register(data: registerData):
    logger.info(data)
    return {"message": "Successfully Registered"}
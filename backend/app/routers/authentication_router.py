from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from app.models.authentication import registerData, loginData
from app.models.user import User
from app.core.mongodb import get_mongodb
from app.core.config import JWT_SECRET_KEY, ALGORITHM
import logging
import jwt
import bcrypt

router = APIRouter()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Function to create a JWT token with an expiration time
def create_jwt_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()  # Copy the data to encode
    expire = datetime.utcnow() + expires_delta  # Set expiration time
    to_encode.update({"exp": expire})  # Add expiration to the token data
    return jwt.encode(
        to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM
    )  # Encode the token


@router.post("/register")
async def register(data: registerData, db: AsyncIOMotorClient = Depends(get_mongodb)):
    try:
        # Check if user already exists
        existing_user = await db.auth_db.users.find_one({"email": data.email})
        if existing_user:
            raise HTTPException(
                status_code=400, detail="Email already registered"
            )  # Raise error if user exists

        # Hash the password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(data.password.encode('utf-8'), salt).decode('utf-8')

        # Create new user document
        user = User(
            name=data.name,
            email=data.email,
            password=hashed_password,
            role=data.role,
            created_at=datetime.utcnow().isoformat(),  # Set creation time
        )

        # Insert into MongoDB
        await db.auth_db.users.insert_one(user.dict())  # Save user to the database

        return {"message": "User Successfully Registered"}  # Return success message
    except Exception as error:
        logger.error(f"Registration error: {str(error)}")  # Log registration error
        raise HTTPException(status_code=500, detail=str(error))  # Raise server error


@router.post("/login")
async def login(data: loginData, db: AsyncIOMotorClient = Depends(get_mongodb)):
    try:
        # Find user in database
        user = await db.auth_db.users.find_one({"email": data.email})

        if not user:
            raise HTTPException(
                status_code=401, detail="Invalid credentials"
            )  # Raise error if user not found

        # Check if the provided password matches the stored password
        if not bcrypt.checkpw(
            data.password.encode("utf-8"), user["password"].encode("utf-8")
        ):
            raise HTTPException(
                status_code=401, detail="Invalid credentials"
            )  # Raise error if password is incorrect

        # Create JWT token
        token = create_jwt_token(
            {"email": user["email"]}, timedelta(minutes=30)
        )  # Generate token with 30 min expiry

        return {
            "message": "Successfully Logged In",
            "token": token,
        }  # Return success message and token
    except Exception as error:
        logger.error(f"Login error: {str(error)}")  # Log login error
        raise HTTPException(status_code=500, detail=str(error))  # Raise server error

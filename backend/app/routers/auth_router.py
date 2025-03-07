"""
Authentication router for user registration and login.
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
import jwt
import bcrypt
import logging

from app.models.authentication import registerData, loginData
from app.models.user import User
from app.core.dependencies import get_db
from app.core.config import JWT_SECRET_KEY, ALGORITHM
from app.schemas.responses import StandardResponse

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Function to create a JWT token with an expiration time
def create_jwt_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()  # Copy the data to encode
    expire = datetime.utcnow() + expires_delta  # Set expiration time
    to_encode.update({"exp": expire})  # Add expiration to the token data
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)  # Encode the token

@router.post("/register", response_model=StandardResponse)
async def register(data: registerData, db=Depends(get_db)):
    """
    Register a new user.
    
    Args:
        data: User registration data
        db: Database connection
        
    Returns:
        StandardResponse with success message
    """
    try:
        # Check if user already exists
        existing_user = await db.auth_db.users.find_one({"email": data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Hash the password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(data.password.encode('utf-8'), salt).decode('utf-8')

        # Create new user document
        user = User(
            name=data.name,
            email=data.email,
            password=hashed_password,
            role=data.role,
            created_at=datetime.utcnow().isoformat(),
        )

        # Insert into MongoDB
        await db.auth_db.users.insert_one(user.dict())

        return StandardResponse(
            success=True,
            message="User successfully registered",
            data={"email": data.email}
        )
    except HTTPException as e:
        logger.warning(f"Registration error: {e.detail}")
        raise
    except Exception as error:
        logger.error(f"Registration error: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))

@router.post("/login", response_model=StandardResponse)
async def login(data: loginData, db=Depends(get_db)):
    """
    Authenticate a user and return a JWT token.
    
    Args:
        data: User login data
        db: Database connection
        
    Returns:
        StandardResponse with JWT token
    """
    try:
        # Find user in database
        user = await db.auth_db.users.find_one({"email": data.email})

        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Check if the provided password matches the stored password
        if not bcrypt.checkpw(data.password.encode("utf-8"), user["password"].encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Create JWT token
        token = create_jwt_token({"email": user["email"]}, timedelta(minutes=30))

        return StandardResponse(
            success=True,
            message="Successfully logged in",
            data={"token": token, "user": {"email": user["email"], "name": user["name"], "role": user["role"]}}
        )
    except HTTPException as e:
        logger.warning(f"Login error: {e.detail}")
        raise
    except Exception as error:
        logger.error(f"Login error: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error)) 
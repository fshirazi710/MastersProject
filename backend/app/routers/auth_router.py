"""
Authentication router for managing user authentication.
"""
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional
import jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.dependencies import get_db
from app.core.error_handling import handle_validation_error, handle_database_error
from app.core.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.schemas import (
    RegisterRequest,
    UserResponse,
    TokenResponse,
    TokenData,
    StandardResponse
)
from app.models.user_model import User

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncIOMotorClient = Depends(get_db)) -> User:
    """Get the current user from the token."""
    credentials_exception = handle_validation_error("Could not validate credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    user = await db.users.find_one({"email": token_data.email})
    if user is None:
        raise credentials_exception
    return User(**user)

@router.post("/register", response_model=StandardResponse[UserResponse])
async def register_user(
    request: RegisterRequest,
    db: AsyncIOMotorClient = Depends(get_db)
):
    """
    Register a new user.
    
    Args:
        user: User creation data
        db: Database connection
        
    Returns:
        Created user data
    """
    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": request.email})
        if existing_user:
            raise handle_validation_error("Email already registered")
            
        # Hash password
        hashed_password = pwd_context.hash(request.password)
        
        # Create user document
        user = {
            "email": request.email,
            "hashed_password": hashed_password,
            "created_at": datetime.now(UTC).isoformat()
        }
        
        # Insert user into database
        result = await db.users.insert_one(user)
        user["id"] = str(result.inserted_id)
        
        return StandardResponse(
            success=True,
            message="User registered successfully",
            data=UserResponse(**user)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        raise handle_database_error("register user", e)

@router.post("/login", response_model=StandardResponse[TokenResponse])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorClient = Depends(get_db)
):
    """
    Login user and return access token.
    
    Args:
        form_data: Login form data
        db: Database connection
        
    Returns:
        Access token
    """
    try:
        # Find user by email
        user = await db.users.find_one({"email": form_data.username})
        if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
            raise handle_validation_error("Invalid credentials")
            
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"]},
            expires_delta=access_token_expires
        )
        
        return StandardResponse(
            success=True,
            message="Login successful",
            data=TokenResponse(
                access_token=access_token,
                token_type="bearer"
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in: {str(e)}")
        raise handle_database_error("login user", e) 
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
from jwt.exceptions import PyJWTError

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
import warnings

# Configure logging
logger = logging.getLogger(__name__)

# Silence the bcrypt version warning
warnings.filterwarnings("ignore", ".*bcrypt version.*")

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing configuration with security checks
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Work factor
    truncate_error=True  # Raise error if password is too long
)

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        # Check for NUL characters
        if '\0' in plain_password:
            logger.warning("Password contains NUL character")
            return False
            
        # Check password length (bcrypt limit is 72 bytes)
        if len(plain_password.encode('utf-8')) > 72:
            logger.warning("Password exceeds bcrypt's 72 byte limit")
            return False
            
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    try:
        # Check for NUL characters
        if '\0' in password:
            raise ValueError("Password contains NUL character")
            
        # Check password length (bcrypt limit is 72 bytes)
        if len(password.encode('utf-8')) > 72:
            raise ValueError("Password exceeds bcrypt's 72 byte limit")
            
        return pwd_context.hash(password)
    except Exception as e:
        logger.error(f"Error hashing password: {str(e)}")
        raise ValueError("Error creating password hash")

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

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db = Depends(get_db)
):
    """
    Get the current user from the JWT token.
    
    Args:
        token: JWT token
        db: Database connection
        
    Returns:
        Current user
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except PyJWTError:
        raise credentials_exception
        
    users_collection = db.users
    user = await users_collection.find_one({"email": token_data.email})
    if user is None:
        raise credentials_exception
    return User(**user)

@router.post("/register", response_model=StandardResponse[UserResponse])
async def register_user(
    request: RegisterRequest,
    db = Depends(get_db)
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
        users_collection = db.users
        existing_user = await users_collection.find_one({"email": request.email})
        if existing_user:
            logger.warning(f"Registration attempt failed: Email {request.email} already exists")
            raise handle_validation_error("Email already registered")
            
        try:
            # Hash password with improved error handling
            hashed_password = get_password_hash(request.password)
        except ValueError as e:
            logger.error(f"Password hashing failed during registration: {str(e)}")
            raise handle_validation_error("Error processing password")
        
        # Create user document
        user = {
            "email": request.email,
            "name": request.name,
            "role": request.role,
            "password": hashed_password,  # Store in 'password' field
            "created_at": datetime.now(UTC).isoformat()
        }
        
        # Insert user into database
        result = await users_collection.insert_one(user)
        user["id"] = str(result.inserted_id)
        
        logger.info(f"User {request.email} registered successfully")
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
    db = Depends(get_db)
):
    """
    Authenticate a user and return a JWT token.
    
    Args:
        form_data: OAuth2 form data with username and password
        db: Database connection
        
    Returns:
        JWT token and expiration time
    """
    try:
        # Get user from database
        users_collection = db.users
        user = await users_collection.find_one({"email": form_data.username})
        if not user:
            logger.warning(f"Login attempt failed: User not found for email {form_data.username}")
            raise handle_validation_error("Invalid email or password")
            
        # Log the stored password hash for debugging
        logger.debug(f"Stored password hash: {user.get('password', 'No password found')}")
        
        try:
            # Verify password using the 'password' field
            is_valid = pwd_context.verify(form_data.password, user["password"])
            if not is_valid:
                logger.warning(f"Login attempt failed: Invalid password for user {form_data.username}")
                raise handle_validation_error("Invalid email or password")
        except Exception as verify_error:
            logger.error(f"Password verification error: {str(verify_error)}")
            raise handle_validation_error("Error verifying password")
            
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"]},
            expires_delta=access_token_expires
        )
        
        # Calculate expiration time
        expires_at = datetime.now(UTC) + access_token_expires
        
        logger.info(f"User {form_data.username} logged in successfully")
        return StandardResponse(
            success=True,
            message="Login successful",
            data=TokenResponse(
                token=access_token,
                expires_at=expires_at.isoformat()
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in: {str(e)}")
        raise handle_database_error("login", e) 
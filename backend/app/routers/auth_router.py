"""
Authentication router for managing user authentication.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.db.mongodb_utils import get_mongo_db
from app.core.error_handling import handle_validation_error, handle_database_error
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.schemas import (
    RegisterRequest,
    UserResponse,
    TokenResponse,
    StandardResponse
)
from app.models.user_model import User

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    pwd_context
)

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=StandardResponse[UserResponse])
async def register_user(
    request: RegisterRequest,
    db = Depends(get_mongo_db)
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
        users_collection = db.users
        existing_user = await users_collection.find_one({"email": request.email})
        if existing_user:
            logger.warning(f"Registration attempt failed: Email {request.email} already exists")
            raise handle_validation_error("Email already registered")
            
        try:
            hashed_password = get_password_hash(request.password)
        except ValueError as e:
            logger.error(f"Password hashing failed during registration: {str(e)}")
            raise handle_validation_error("Error processing password")
        
        user_data = {
            "email": request.email,
            "name": request.name,
            "role": request.role,
            "password": hashed_password,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await users_collection.insert_one(user_data)
        user_response_data = UserResponse(**user_data, id=str(result.inserted_id))
        
        logger.info(f"User {request.email} registered successfully")
        return StandardResponse(
            success=True,
            message="User registered successfully",
            data=user_response_data
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        raise handle_database_error("register user", e)

@router.post("/login", response_model=StandardResponse[TokenResponse])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db = Depends(get_mongo_db)
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
        users_collection = db.users
        user = await users_collection.find_one({"email": form_data.username})
        if not user:
            logger.warning(f"Login attempt failed: User not found for email {form_data.username}")
            raise handle_validation_error("Invalid email or password")
            
        if not pwd_context.verify(form_data.password, user["password"]):
            logger.warning(f"Login attempt failed: Invalid password for user {form_data.username}")
            raise handle_validation_error("Invalid email or password")
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"]},
            expires_delta=access_token_expires
        )
        
        expires_at = datetime.now(timezone.utc) + access_token_expires
        
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
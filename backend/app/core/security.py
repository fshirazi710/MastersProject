"""
Core security utilities: password hashing, JWT handling, user retrieval.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from jwt.exceptions import PyJWTError
import warnings
import logging

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.schemas import TokenData
# Assuming User model is defined elsewhere (e.g., app.models.user_model)
# We might need to import it or use a dictionary representation
# from app.models.user_model import User 
from app.db.mongodb_utils import get_mongo_db # Import the correct DB dependency

logger = logging.getLogger(__name__)

# Silence the bcrypt version warning
warnings.filterwarnings("ignore", ".*bcrypt version.*")

# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
    truncate_error=True
)

# OAuth2 scheme (tokenUrl points to the login endpoint in auth_router)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # Ensure prefix matches main.py

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash, including length and NUL checks."""
    try:
        if '\0' in plain_password:
            logger.warning("Password contains NUL character")
            return False
        if len(plain_password.encode('utf-8')) > 72:
            logger.warning("Password exceeds bcrypt's 72 byte limit")
            return False
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    """Generate password hash, including length and NUL checks."""
    try:
        if '\0' in password:
            raise ValueError("Password contains NUL character")
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
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Use configured expiration time
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_mongo_db)
) -> dict:
    """
    Decode JWT token, validate, and retrieve user from DB.
    Returns the user document as a dictionary.
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
            logger.warning("Token missing 'sub' (email) claim.")
            raise credentials_exception
        # Optionally validate token expiration ('exp' claim), though jwt.decode usually does
        token_data = TokenData(email=email) # Using schema for validation potentially
    except PyJWTError as e:
        logger.warning(f"JWT decoding/validation error: {e}")
        raise credentials_exception
        
    # Fetch user from MongoDB users collection
    user = await db.users.find_one({"email": token_data.email})
    if user is None:
        logger.warning(f"User not found in DB for email: {token_data.email}")
        raise credentials_exception
        
    # Return user as dict (adjust if a User model/schema is preferred)
    return user 

async def get_current_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to ensure the current user is an admin.
    Relies on get_current_user to fetch the user data.
    Assumes user document has a 'role' field.
    """
    # Check the 'role' field in the user dictionary fetched from DB
    # Adapt this check based on how roles are actually stored (e.g., string, enum)
    if current_user.get("role") != "admin": # Example: Check if role is 'admin'
        logger.warning(f"Admin access denied for user: {current_user.get('email')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="User does not have admin privileges"
        )
    logger.info(f"Admin access granted for user: {current_user.get('email')}")
    return current_user 
"""
API schemas package.
This package contains Pydantic models for API requests and responses.
"""
# Add necessary imports for base schemas
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List # Add List

# --- Base Schemas Definition --- 
DataType = TypeVar('DataType')

# Fix Pydantic warning: Inherit from BaseModel first
class StandardResponse(BaseModel, Generic[DataType]):
    """Standard API response format."""
    success: bool = True
    message: Optional[str] = None
    data: Optional[DataType] = None

class ErrorDetail(BaseModel):
    """Detail structure for error responses."""
    message: str
    type: Optional[str] = None
# --- End Base Schemas --- 

# Auth schemas
from app.schemas.auth import (
    # Import only schemas defined in auth.py
    RegisterRequest,
    # LoginRequest, # Remove if LoginRequest is not defined/used
    UserResponse,
    TokenResponse,
    TokenData,
)

# Vote Session schemas
from app.schemas.vote_session import (
    SliderConfig, 
    VoteSessionMetadata,
)

# Participant schemas (from participant.py, assuming holder.py was deleted)
from app.schemas.participant import (
    ParticipantCacheModel, 
    ParticipantListItem,
    ParticipantDetail,
)

# Encrypted Vote schemas
from app.schemas.encrypted_vote import (
    PublicKeyValidateRequest, # Used by validate-public-key
)

# Share schemas - Update imports
from app.schemas.share import (
    ShareListSubmitRequest, # Used by refactored endpoint
    ShareItem # Used by ShareListSubmitRequest
)

# Import models if necessary (e.g., User if used in auth response directly)
from app.models.user_model import User

__all__ = [
    # Base
    "StandardResponse",
    "ErrorDetail",
    
    # Vote Session
    "SliderConfig",
    "VoteSessionMetadata",
    
    # Share - Update exports
    "ShareItem",
    "ShareListSubmitRequest",
    
    # Participant - Add exports
    "ParticipantCacheModel",
    "ParticipantListItem",
    "ParticipantDetail",

    # Encrypted Vote - Add exports
    "PublicKeyValidateRequest",
    
    # Auth
    "RegisterRequest",
    # "LoginRequest", # Remove if not defined/used
    "UserResponse",
    "TokenResponse",
    "TokenData",

    # Models (if exposed)
    "User",
] 
"""
API schemas package.
This package contains Pydantic models for API requests and responses.
"""
# Auth schemas
from app.schemas.auth import (
    # Import only schemas defined in auth.py
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    TokenData,
)

# Vote Session schemas (renamed from election)
from app.schemas.vote_session import (
    # Removed ElectionCreateRequest, ExtendedElectionCreateRequest, ElectionMetadata
    SliderConfig, 
    VoteSessionCreateRequest,
    ExtendedVoteSessionCreateRequest,
    VoteSessionMetadata,
)

# Encrypted Vote schemas (renamed from vote, but potentially empty/deleted)
# Remove import block if encrypted_vote.py was deleted or is empty
# from app.schemas.encrypted_vote import (
#     VoteSubmitRequest, # Removed
#     VoteResponse, # Removed
#     PublicKeyRequest, # Removed
#     KeyRequest # Removed
# )

# Holder schemas
from app.schemas.holder import (
    # Removed JoinHolderStringRequest
    HolderResponse, # Keep for now, used by unrefactored endpoints
    HolderStatusResponse, # Keep for now
    HolderListResponse, # Keep for now
    HolderCountResponse, # Used by refactored endpoint
    RequiredDepositResponse, # Keep for now
    HolderJoinRequest, # Used by refactored endpoint
)

# Share schemas
from app.schemas.share import (
    # Removed ShareSubmitRequest
    ShareListSubmitRequest, # Used by refactored endpoint
    ShareVerificationRequest, # Used by existing endpoint
    ShareVerificationResponse, # Used by existing endpoint
    ShareStatusResponse, # Keep for now, used by unrefactored endpoint
    SubmittedSharesResponse, # Keep for now, used by unrefactored endpoint
    ShareItem # Used by ShareListSubmitRequest
)

# Response schemas
from app.schemas.responses import (
    StandardResponse,
    # ErrorResponse, # Assuming unused?
    TransactionResponse,
    # PaginatedResponse, # Assuming unused?
)

# Secret Holder schemas
from app.schemas.secret_holder import SecretHolderResponse


__all__ = [
    "StandardResponse",
    "TransactionResponse",
    
    # Vote Session
    "SliderConfig",
    "VoteSessionCreateRequest",
    "ExtendedVoteSessionCreateRequest",
    "VoteSessionMetadata",
    
    # Encrypted Vote (Remove if file/schemas deleted)
    # "VoteSubmitRequest",
    # "PublicKeyRequest",
    # "KeyRequest",
    # "VoteResponse",
    
    # Share
    "ShareItem", # Add ShareItem used by ShareListSubmitRequest
    "ShareListSubmitRequest",
    "ShareVerificationRequest",
    "ShareVerificationResponse",
    "ShareStatusResponse", # Keep for now
    "SubmittedSharesResponse", # Keep for now
    
    # Holder
    "HolderJoinRequest",
    "HolderCountResponse",
    "HolderResponse", # Keep for now
    "HolderStatusResponse", # Keep for now
    "HolderListResponse", # Keep for now
    "RequiredDepositResponse", # Keep for now
    
    # Secret Holder
    "SecretHolderResponse",
    
    # Auth (Update __all__ based on actual imports)
    "RegisterRequest",
    "LoginRequest",
    "UserResponse",
    "TokenResponse",
    "TokenData",
] 
"""
API schemas package.
This package contains Pydantic models for API requests and responses.
"""
# Auth schemas
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    TokenData,
)

# Elections schemas
from app.schemas.election import (
    ElectionCreateRequest,
)

# Vote schemas
from app.schemas.vote import (
    VoteSubmitRequest,
    VoteResponse,
    PublicKeyRequest,
    KeyRequest
)

# Holder schemas
from app.schemas.holder import (
    # JoinHolderRequest,
    JoinHolderStringRequest,
    HolderResponse,
    HolderStatusResponse,
    HolderListResponse,
    HolderCountResponse,
    RequiredDepositResponse,
)

# Share schemas
from app.schemas.share import (
    ShareSubmitRequest,
    ShareListSubmitRequest,
    ShareVerificationRequest,
    ShareVerificationResponse,
    ShareStatusResponse,
    SubmittedSharesResponse,
)

# Response schemas
from app.schemas.responses import (
    StandardResponse,
    ErrorResponse,
    TransactionResponse,
    PaginatedResponse,
) 
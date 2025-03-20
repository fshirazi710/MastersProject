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

# Vote schemas
from app.schemas.vote import (
    VoteSubmitRequest,
    VoteCreateRequest,
    VoteResponse,
    DecryptVoteRequest,
    DecryptVoteResponse,
    VotingTokenRequest,
    VotingTokenResponse,
    TokenValidationRequest,
    VoteStatusResponse,
    PublicKeyRequest,
    KeyRequest
)

# Holder schemas
from app.schemas.holder import (
    JoinHolderRequest,
    HolderResponse,
    HolderStatusResponse,
    HolderListResponse,
    HolderCountResponse,
    RequiredDepositResponse,
)

# Share schemas
from app.schemas.share import (
    ShareSubmitRequest,
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
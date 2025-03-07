from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Tuple

# Secret Holder Models
class JoinHolderRequest(BaseModel):
    public_key: List[int] = Field(..., description="BLS12-381 public key components [x, y]")
    deposit_amount: float = Field(..., description="Amount of ETH to deposit")

class HolderResponse(BaseModel):
    address: str = Field(..., description="Ethereum address of the holder")
    public_key: List[int] = Field(..., description="BLS12-381 public key components")
    active: bool = Field(..., description="Whether the holder is active")

class HolderStatusResponse(BaseModel):
    is_holder: bool = Field(..., description="Whether the address is a registered holder")
    public_key: Optional[List[int]] = Field(None, description="BLS12-381 public key if holder")

# Vote Models
class VoteSubmitRequest(BaseModel):
    vote_data: str = Field(..., description="The vote data to encrypt and submit")
    decryption_time: int = Field(..., description="Unix timestamp when the vote can be decrypted")

class VoteResponse(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote")
    ciphertext: str = Field(..., description="The encrypted vote data")
    decryption_time: int = Field(..., description="Unix timestamp when the vote can be decrypted")
    submitted_at: int = Field(..., description="Unix timestamp when the vote was submitted")

class ShareStatusResponse(BaseModel):
    total_holders: int = Field(..., description="Total number of secret holders")
    submitted_shares: int = Field(..., description="Number of shares that have been submitted")
    missing_shares: int = Field(..., description="Number of shares that are still missing")
    holders: Dict[str, Any] = Field(..., description="Status of each holder's share submission")

class DecryptVoteRequest(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote to decrypt")

class DecryptVoteResponse(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote")
    decrypted_data: str = Field(..., description="The decrypted vote data")
    decryption_time: int = Field(..., description="Unix timestamp when the vote was decrypted")

# Share Models
class ShareSubmitRequest(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote")
    share_index: int = Field(..., description="The index of the share")
    share_value: int = Field(..., description="The value of the share")

class ShareVerificationRequest(BaseModel):
    vote_id: int = Field(..., description="The ID of the vote")
    holder_address: str = Field(..., description="The address of the holder")
    share: Tuple[int, int] = Field(..., description="The share to verify (index, value)")

class ShareVerificationResponse(BaseModel):
    valid: bool = Field(..., description="Whether the share is valid")
    holder_address: str = Field(..., description="The address of the holder")
    vote_id: int = Field(..., description="The ID of the vote") 
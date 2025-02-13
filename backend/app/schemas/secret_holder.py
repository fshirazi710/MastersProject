from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class HolderStatus(str, Enum):
    """Match the model's status enum"""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SLASHED = "slashed"

class SecretHolderBase(BaseModel):
    """Base schema with common attributes"""
    address: str = Field(..., description="Ethereum address of the holder")
    public_key: str = Field(..., description="BLS public key for encryption")

class SecretHolderCreate(SecretHolderBase):
    """Schema for creating a new secret holder"""
    deposit_amount: float = Field(..., description="Amount of ETH to deposit")
    election_id: int = Field(..., description="ID of the election to join")

class SecretHolderResponse(SecretHolderBase):
    """Schema for secret holder responses"""
    id: int
    status: HolderStatus
    deposit_amount: float
    transaction_hash: str
    last_seen: Optional[datetime]
    
    class Config:
        from_attributes = True 
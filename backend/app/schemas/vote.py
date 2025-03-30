"""
Vote schemas for the API.
This module contains Pydantic models for vote-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.error_handling import handle_validation_error

class VoteSubmitRequest(BaseModel):
    """Schema for submitting an encrypted vote."""
    vote_data: str = Field(
        ..., 
        description="The vote data to encrypt and submit",
        min_length=1,
        examples=["This is a secret ballot"]
    )
    decryption_time: int = Field(
        ..., 
        description="Unix timestamp when the vote can be decrypted",
        examples=[1714521600]  # Example: April 1, 2024
    )
    reward_amount: float = Field(
        0.1,
        description="Amount of ETH to reward secret holders",
        ge=0,
        examples=[0.1, 0.5, 1.0]
    )
    threshold: Optional[int] = Field(
        None,
        description="Minimum number of shares needed to reconstruct the secret (default: 2/3 of holders)",
        ge=2,
        examples=[3, 5]
    )
    
    @field_validator('decryption_time')
    @classmethod
    def validate_decryption_time(cls, v):
        """Validate that the decryption time is in the future."""
        current_time = int(datetime.now().timestamp())
        if v <= current_time:
            raise handle_validation_error("Decryption time must be in the future")
        return v

class PublicKeyRequest(BaseModel):
    """Schema for storing public key."""
    public_key: str = Field(
        ..., 
        description="Title of the vote",
        examples=["Presidential Election 2024"]
    )
    is_secret_holder: bool = Field(
        ...,
        description="Description of the vote",
        examples=["Vote for the next president of the United States"]
    )
    
class KeyRequest(BaseModel):
    """Schema for storing public key."""
    public_key: str = Field(
        ..., 
        description="Title of the vote",
        examples=["Presidential Election 2024"]
    )

class VoteResponse(BaseModel):
    """Schema for vote data."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        examples=[1]
    )
    ciphertext: Optional[str] = Field(
        None, 
        description="The encrypted vote data (hex encoded)",
        examples=["0a1b2c3d4e5f"]
    )
    nonce: Optional[str] = Field(
        None, 
        description="The encryption nonce (hex encoded)",
        examples=["f5e4d3c2b1a0"]
    )
    decryption_time: int = Field(
        ..., 
        description="Unix timestamp when the vote can be decrypted",
        examples=[1714521600]
    )
    g2r: Optional[List[str]] = Field(
        None, 
        description="G2R point components",
        examples=[["123456789", "987654321"]]
    )

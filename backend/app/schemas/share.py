"""
Share schemas for the API.
This module contains Pydantic models for share-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Tuple, Optional

class ShareSubmitRequest(BaseModel):
    """Schema for submitting a share for a vote."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        ge=0,
        examples=[1]
    )
    share_index: int = Field(
        ..., 
        description="The index of the share",
        gt=0,
        examples=[1]
    )
    share_value: int = Field(
        ..., 
        description="The value of the share",
        examples=[123456789]
    )
    
    @field_validator('vote_id')
    @classmethod
    def validate_vote_id(cls, v):
        """Validate that the vote ID is non-negative."""
        if v < 0:
            raise ValueError("Vote ID must be non-negative")
        return v
    
    @field_validator('share_index')
    @classmethod
    def validate_share_index(cls, v):
        """Validate that the share index is positive."""
        if v <= 0:
            raise ValueError("Share index must be positive")
        return v

class ShareVerificationRequest(BaseModel):
    """Schema for verifying a share."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        ge=0,
        examples=[1]
    )
    holder_address: str = Field(
        ..., 
        description="The address of the holder",
        pattern=r'^0x[a-fA-F0-9]{40}$',
        examples=["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
    )
    share: Tuple[int, int] = Field(
        ..., 
        description="The share to verify (index, value)",
        examples=[[1, 123456789]]
    )

class ShareVerificationResponse(BaseModel):
    """Schema for share verification result."""
    valid: bool = Field(
        ..., 
        description="Whether the share is valid",
        examples=[True]
    )
    holder_address: str = Field(
        ..., 
        description="The address of the holder",
        examples=["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
    )
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        examples=[1]
    )

class ShareStatusResponse(BaseModel):
    """Schema for share submission status."""
    total_holders: int = Field(
        ..., 
        description="Total number of secret holders",
        ge=0,
        examples=[3]
    )
    submitted_shares: int = Field(
        ..., 
        description="Number of shares that have been submitted",
        ge=0,
        examples=[2]
    )
    missing_shares: int = Field(
        ..., 
        description="Number of shares that are still missing",
        ge=0,
        examples=[1]
    )
    holder_status: Dict[str, Any] = Field(
        ..., 
        description="Status of each holder's share submission",
        examples=[{
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": {
                "submitted": True,
                "valid": True
            },
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": {
                "submitted": False,
                "valid": False
            }
        }]
    )

class SubmittedSharesResponse(BaseModel):
    """Schema for submitted shares for a vote."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        examples=[1]
    )
    submitted_shares: List[Dict[str, Any]] = Field(
        ..., 
        description="List of submitted shares with holder addresses",
        examples=[[
            {
                "holder_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "share_index": 1,
                "share_value": 123456789
            },
            {
                "holder_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "share_index": 2,
                "share_value": 987654321
            }
        ]]
    )
    count: int = Field(
        ..., 
        description="Number of submitted shares",
        examples=[2]
    ) 

# Schema for the request body sent by the frontend
class ShareItem(BaseModel):
    """Represents a single item in the shares list."""
    vote_id: int
    share: str # Assuming generateShares returns a hex string

class ShareListSubmitRequest(BaseModel):
    """Schema for submitting a list of shares and the holder's public key."""
    shares: List[ShareItem]
    public_key: str = Field(
        ...,
        description="Holder's public key hex string"
    )
    signature: str = Field(
        ...,
        description="Signature from the holder proving ownership of the public key and intent to submit these shares"
    ) 
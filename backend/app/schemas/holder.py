"""
Secret holder schemas for the API.
This module contains Pydantic models for secret holder-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import re

class JoinHolderRequest(BaseModel):
    """Schema for joining as a secret holder."""
    public_key: List[int] = Field(
        ..., 
        description="BLS12-381 public key components [x, y]",
        min_length=2,
        max_length=2,
        examples=[[123456789, 987654321]]
    )
    deposit_amount: float = Field(
        ..., 
        description="Amount of ETH to deposit",
        gt=0,
        examples=[1.0]
    )
    
    @field_validator('public_key')
    @classmethod
    def validate_public_key(cls, v):
        """Validate that the public key has exactly two components."""
        if len(v) != 2:
            raise ValueError("Public key must have exactly 2 components [x, y]")
        return v
    
    @field_validator('deposit_amount')
    @classmethod
    def validate_deposit(cls, v):
        """Validate that the deposit amount is positive."""
        if v <= 0:
            raise ValueError("Deposit amount must be greater than 0")
        return v

class HolderResponse(BaseModel):
    """Schema for secret holder data."""
    address: str = Field(
        ..., 
        description="Ethereum address of the holder",
        pattern=r'^0x[a-fA-F0-9]{40}$',
        examples=["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
    )
    public_key: List[int] = Field(
        ..., 
        description="BLS12-381 public key components",
        examples=[[123456789, 987654321]]
    )
    active: bool = Field(
        ..., 
        description="Whether the holder is active",
        examples=[True]
    )

class HolderStatusResponse(BaseModel):
    """Schema for checking if an address is a registered holder."""
    is_holder: bool = Field(
        ..., 
        description="Whether the address is a registered holder",
        examples=[True]
    )
    public_key: Optional[List[int]] = Field(
        None, 
        description="BLS12-381 public key if holder",
        examples=[[123456789, 987654321]]
    )

class HolderListResponse(BaseModel):
    """Schema for list of holders."""
    holders: List[HolderResponse] = Field(
        ..., 
        description="List of secret holders",
        examples=[[{
            "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "public_key": [123456789, 987654321],
            "active": True
        }]]
    )
    count: int = Field(
        ..., 
        description="Total number of holders",
        examples=[1]
    )

class HolderCountResponse(BaseModel):
    """Schema for holder count response."""
    count: int = Field(
        ..., 
        description="Total number of holders",
        examples=[5]
    )

class RequiredDepositResponse(BaseModel):
    """Schema for required deposit response."""
    required_deposit: float = Field(
        ..., 
        description="Required deposit amount in ETH",
        gt=0,
        examples=[0.1]
    ) 
"""
Vote schemas for the API.
This module contains Pydantic models for vote-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime

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
    
    @field_validator('decryption_time')
    @classmethod
    def validate_decryption_time(cls, v):
        """Validate that the decryption time is in the future."""
        current_time = int(datetime.now().timestamp())
        if v <= current_time:
            raise ValueError("Decryption time must be in the future")
        return v

class VoteCreateRequest(BaseModel):
    """Schema for creating a new vote."""
    title: str = Field(
        ..., 
        description="Title of the vote",
        min_length=3,
        max_length=100,
        examples=["Presidential Election 2024"]
    )
    description: str = Field(
        ..., 
        description="Description of the vote",
        min_length=10,
        max_length=1000,
        examples=["Vote for the next president of the United States"]
    )
    start_date: str = Field(
        ..., 
        description="Start date and time of the vote (ISO format)",
        examples=["2024-03-01T12:00:00"]
    )
    end_date: str = Field(
        ..., 
        description="End date and time of the vote (ISO format)",
        examples=["2024-03-15T12:00:00"]
    )
    options: List[str] = Field(
        ..., 
        description="List of voting options",
        min_length=2,
        examples=[["Candidate A", "Candidate B", "Candidate C"]]
    )
    reward_pool: float = Field(
        ..., 
        description="Reward pool amount in ETH",
        ge=0,
        examples=[1.0]
    )
    required_deposit: float = Field(
        ..., 
        description="Required deposit amount in ETH",
        ge=0,
        examples=[0.1]
    )
    
    @field_validator('start_date', 'end_date')
    @classmethod
    def validate_date_format(cls, v):
        """Validate date format."""
        try:
            datetime.strptime(v, "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            raise ValueError("Date must be in ISO format (YYYY-MM-DDTHH:MM:SS)")
        return v
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end date is after start date."""
        if 'start_date' in info.data:
            start = datetime.strptime(info.data['start_date'], "%Y-%m-%dT%H:%M:%S")
            end = datetime.strptime(v, "%Y-%m-%dT%H:%M:%S")
            if end <= start:
                raise ValueError("End date must be after start date")
        return v
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v):
        """Validate that there are at least two options."""
        if len(v) < 2:
            raise ValueError("At least two options are required")
        return v

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

class DecryptVoteRequest(BaseModel):
    """Schema for decrypting a vote."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote to decrypt",
        ge=0,
        examples=[1]
    )

class DecryptVoteResponse(BaseModel):
    """Schema for decrypted vote data."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        examples=[1]
    )
    vote_data: str = Field(
        ..., 
        description="The decrypted vote data",
        examples=["This is a secret ballot"]
    )
    decryption_time: int = Field(
        ..., 
        description="Unix timestamp when the vote was decrypted",
        examples=[1714521600]
    )
    shares_used: int = Field(
        ...,
        description="Number of shares used for decryption",
        examples=[3]
    )

class VotingTokenRequest(BaseModel):
    """Schema for generating a voting token."""
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        ge=0,
        examples=[1]
    )

class VotingTokenResponse(BaseModel):
    """Schema for voting token."""
    token: str = Field(
        ..., 
        description="Unique voting token",
        examples=["A1B2C3D4"]
    )
    vote_id: int = Field(
        ..., 
        description="The ID of the vote",
        examples=[1]
    )

class TokenValidationRequest(BaseModel):
    """Schema for validating a voting token."""
    token: str = Field(
        ..., 
        description="Voting token to validate",
        min_length=8,
        max_length=8,
        examples=["A1B2C3D4"]
    )

class VoteStatusResponse(BaseModel):
    """Response model for vote status."""
    total_votes: int = Field(
        ..., 
        description="Total number of votes",
        examples=[5]
    )
    active_votes: int = Field(
        ..., 
        description="Number of active votes",
        examples=[3]
    )
    closed_votes: int = Field(
        ..., 
        description="Number of closed votes",
        examples=[2]
    )
    decrypted_votes: int = Field(
        ..., 
        description="Number of decrypted votes",
        examples=[1]
    ) 
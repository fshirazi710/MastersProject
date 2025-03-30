"""
Election schemas for the API.
This module contains Pydantic models for election-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List
from datetime import datetime

class ElectionCreateRequest(BaseModel):
    """Schema for creating a new election."""
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
            # Remove milliseconds and timezone indicator if present
            if '.' in v:
                v = v.split('.')[0]
            if v.endswith('Z'):
                v = v[:-1]
            datetime.strptime(v, "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            raise ValueError("Date must be in ISO format (YYYY-MM-DDTHH:MM:SS)")
        return v
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end date is after start date."""
        if 'start_date' in info.data:
            # Clean up both dates before comparison
            start_date = info.data['start_date']
            if '.' in start_date:
                start_date = start_date.split('.')[0]
            if start_date.endswith('Z'):
                start_date = start_date[:-1]
                
            end_date = v
            if '.' in end_date:
                end_date = end_date.split('.')[0]
            if end_date.endswith('Z'):
                end_date = end_date[:-1]
                
            start = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%S")
            end = datetime.strptime(end_date, "%Y-%m-%dT%H:%M:%S")
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
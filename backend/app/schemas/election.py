"""
Election schemas for the API.
This module contains Pydantic models for election-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime

# Schema for slider configuration (keep this)
class SliderConfig(BaseModel):
    min: int = Field(..., description="Minimum value of the slider")
    max: int = Field(..., description="Maximum value of the slider")
    step: int = Field(..., description="Step increment of the slider", ge=1)

    @field_validator('max')
    @classmethod
    def validate_max_greater_than_min(cls, v, info):
        if 'min' in info.data and v <= info.data['min']:
            raise ValueError("Maximum value must be greater than minimum value")
        return v

# Reverted ElectionCreateRequest - This represents the data primarily for the contract
class ElectionCreateRequest(BaseModel):
    """Schema for creating a new election (core data)."""
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
    # Options list is mandatory again - will contain generated steps for sliders
    options: List[str] = Field(
        ..., 
        description="List of voting options (generated for sliders)",
        min_length=2,
        examples=[["Candidate A", "Candidate B"], ["1", "3", "5"]]
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
    
    # --- REMOVED questionType and sliderConfig fields --- 
    
    # --- Reverted options validator --- 
    @field_validator('options')
    @classmethod
    def validate_options(cls, v):
        if not v or len(v) < 2:
             raise ValueError("At least two options are required")
        # Add check for empty strings within the list
        if any(not opt or not opt.strip() for opt in v):
             raise ValueError("Options cannot be empty or contain only whitespace")
        return v

    # --- REMOVED conditional validators for sliderConfig --- 
    
    # --- Keep date validators --- 
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
            # Allow just date-time, no seconds needed if not provided by input
            datetime.strptime(v, "%Y-%m-%dT%H:%M") 
        except ValueError:
            # Try with seconds if the first format failed
            try:
                 datetime.strptime(v, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                 raise ValueError("Date must be in ISO format (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS)")
        return v
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end date is after start date."""
        if 'start_date' in info.data:
            start_date_str = info.data['start_date']
            end_date_str = v

            # Function to parse potentially different formats
            def parse_datetime(date_str):
                if '.' in date_str:
                    date_str = date_str.split('.')[0]
                if date_str.endswith('Z'):
                    date_str = date_str[:-1]
                try:
                    return datetime.strptime(date_str, "%Y-%m-%dT%H:%M")
                except ValueError:
                    return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")

            try:
                start = parse_datetime(start_date_str)
                end = parse_datetime(end_date_str)
                if end <= start:
                    raise ValueError("End date must be after start date")
            except ValueError as e:
                # Re-raise original parse error or the end <= start error
                raise ValueError(str(e))
        return v

# New Wrapper Schema for the entire request body from frontend
class ExtendedElectionCreateRequest(BaseModel):
    election_data: ElectionCreateRequest = Field(..., description="Core election data for the contract")
    displayHint: Optional[str] = Field(default=None, description="Hint for frontend rendering (e.g., 'slider')")
    sliderConfig: Optional[SliderConfig] = Field(default=None, description="Slider configuration details (if displayHint is 'slider')")

    # Add validation: if displayHint is 'slider', sliderConfig must be present
    @field_validator('sliderConfig')
    @classmethod
    def check_slider_config_present(cls, v, info):
        if info.data.get('displayHint') == 'slider' and v is None:
            raise ValueError("sliderConfig is required when displayHint is 'slider'")
        return v

# (Optional but good practice) Define schema for DB metadata storage
class ElectionMetadata(BaseModel):
    election_id: int # Assuming we get this after contract interaction
    displayHint: Optional[str] = None
    sliderConfig: Optional[SliderConfig] = None
    # Add other fields if needed later, e.g., creation_timestamp
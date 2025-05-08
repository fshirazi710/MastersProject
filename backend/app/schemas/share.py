"""
Share schemas for the API.
This module contains Pydantic models for share-related requests and responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Tuple, Optional

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
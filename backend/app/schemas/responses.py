"""
Standardized response models for the API.
This module provides consistent response structures across all endpoints.
"""
from typing import Generic, TypeVar, Optional, Any, Dict, List
from pydantic import BaseModel, Field

# Generic type for response data
T = TypeVar('T')

class StandardResponse(BaseModel, Generic[T]):
    """Standard response format for all API endpoints."""
    success: bool = Field(..., description="Whether the request was successful")
    message: str = Field(..., description="Human-readable message about the response")
    data: Optional[T] = Field(None, description="Response data")
    
class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    message: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code for client reference")
    
class TransactionResponse(BaseModel):
    """Response format for blockchain transactions."""
    success: bool = Field(..., description="Whether the transaction was successful")
    message: str = Field(..., description="Human-readable message about the transaction")
    transaction_hash: Optional[str] = Field(None, description="Hash of the transaction")
    
class PaginatedResponse(BaseModel, Generic[T]):
    """Response format for paginated results."""
    success: bool = True
    message: str = Field(..., description="Human-readable message about the response")
    data: List[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages") 
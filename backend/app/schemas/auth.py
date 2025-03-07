"""
Authentication schemas for the API.
This module contains Pydantic models for authentication-related requests and responses.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re

class TokenData(BaseModel):
    """Schema for token data."""
    email: Optional[str] = None

class RegisterRequest(BaseModel):
    """Schema for user registration request."""
    name: str = Field(..., 
                     description="User's full name",
                     min_length=2, 
                     max_length=100,
                     examples=["John Doe"])
    email: EmailStr = Field(..., 
                           description="User's email address",
                           examples=["john.doe@example.com"])
    password: str = Field(..., 
                         description="User's password",
                         min_length=8,
                         examples=["SecureP@ssw0rd"])
    role: str = Field(..., 
                     description="User's role in the system",
                     examples=["voter"])
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        """Validate password strength."""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('role')
    @classmethod
    def valid_role(cls, v):
        """Validate user role."""
        valid_roles = ['admin', 'voter', 'holder']
        if v.lower() not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v.lower()

class LoginRequest(BaseModel):
    """Schema for user login request."""
    email: EmailStr = Field(..., 
                           description="User's email address",
                           examples=["john.doe@example.com"])
    password: str = Field(..., 
                         description="User's password",
                         examples=["SecureP@ssw0rd"])

class UserResponse(BaseModel):
    """Schema for user data in responses."""
    name: str = Field(..., description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    role: str = Field(..., description="User's role in the system")
    created_at: Optional[str] = Field(None, description="Timestamp when the user was created")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "John Doe",
                    "email": "john.doe@example.com",
                    "role": "voter",
                    "created_at": "2023-03-01T12:00:00"
                }
            ]
        }
    }

class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    token: str = Field(..., description="JWT authentication token")
    expires_at: Optional[str] = Field(None, description="Token expiration timestamp")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "expires_at": "2023-03-01T13:00:00"
                }
            ]
        }
    } 
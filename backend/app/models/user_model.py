"""
User database model.
This module contains the Pydantic model for users in MongoDB.
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import enum

class UserRole(str, enum.Enum):
    """Enum for user roles."""
    ADMIN = "admin"
    VOTER = "voter"
    HOLDER = "holder"
    ORGANISER = "vote-organiser"

class User(BaseModel):
    """
    Database model for users.
    Stores user authentication and profile information.
    """
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.VOTER
    created_at: Optional[str] = None

    class Config:
        """Pydantic config."""
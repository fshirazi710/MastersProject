"""
Vote database model.
This module contains the Pydantic model for votes and related entities.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import enum

class VoteStatus(str, enum.Enum):
    """Enum for vote status."""
    PENDING = "pending"      # Created but not yet active
    ACTIVE = "active"        # Voting is open
    CLOSED = "closed"        # Voting is closed, awaiting decryption
    DECRYPTED = "decrypted"  # Vote has been decrypted
    CANCELLED = "cancelled"  # Vote was cancelled

class VotingToken(BaseModel):
    """
    Database model for voting tokens.
    Tokens are used for anonymous voting.
    """
    token: str
    used: int = 0  # 0 = unused, 1 = used
    vote_id: int
    created_at: Optional[str] = None

    class Config:
        """Pydantic config."""
        from_attributes = True

class Vote(BaseModel):
    """
    Database model for votes.
    Stores vote metadata and encrypted vote data.
    """
    title: str
    description: str
    start_date: str  # ISO format datetime string
    end_date: str    # ISO format datetime string
    
    # Blockchain-related fields
    blockchain_vote_id: Optional[int] = None
    ciphertext: Optional[str] = None  # Hex string
    nonce: Optional[str] = None       # Hex string
    decryption_time: Optional[int] = None  # Unix timestamp
    g2r_point: Optional[str] = None    # Serialized G2 point
    
    # Vote configuration
    required_deposit: float = 0
    reward_pool: float = 0
    options: List[str]
    
    # Status
    status: VoteStatus = VoteStatus.PENDING
    
    # Relationships
    tokens: List[VotingToken] = []
    shares: List[dict] = []  # List of share documents
    
    created_at: Optional[str] = None

    class Config:
        """Pydantic config."""
        from_attributes = True 
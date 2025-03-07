"""
Secret holder database model.
This module contains the Pydantic model for secret holders and shares.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import enum

class HolderStatus(str, enum.Enum):
    """Enum for secret holder status."""
    PENDING = "pending"      # Joined but not confirmed
    ACTIVE = "active"        # Confirmed and participating
    INACTIVE = "inactive"    # No longer participating
    SLASHED = "slashed"      # Penalized for misbehavior

class Share(BaseModel):
    """
    Database model for secret shares.
    Shares are submitted by secret holders for vote decryption.
    """
    index: int
    value: str  # Large integer stored as string
    verified: int = 0  # 0 = unverified, 1 = verified
    transaction_hash: Optional[str] = None
    vote_id: int
    created_at: Optional[str] = None

    class Config:
        """Pydantic config."""
        from_attributes = True

class SecretHolder(BaseModel):
    """
    Database model for secret holders.
    Secret holders participate in the time-lock encryption protocol.
    """
    address: str
    public_key: str
    deposit_amount: float
    transaction_hash: str
    status: HolderStatus = HolderStatus.PENDING
    last_seen: Optional[str] = None
    shares: List[Share] = []
    created_at: Optional[str] = None

    class Config:
        """Pydantic config."""
        from_attributes = True 
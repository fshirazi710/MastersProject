from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.db.base import BaseModel
import enum

class HolderStatus(str, enum.Enum):
    """Enum for secret holder status"""
    PENDING = "pending"      # Joined but not confirmed
    ACTIVE = "active"       # Confirmed and participating
    INACTIVE = "inactive"   # No longer participating
    SLASHED = "slashed"     # Penalized for misbehavior

class SecretHolder(BaseModel):
    """
    Model for secret holders who participate in the time-lock encryption.
    Integrates with the blockchain contract's holder management.
    """
    __tablename__ = "secret_holders"

    # Blockchain related fields
    address = Column(String(42), unique=True, nullable=False, index=True)
    public_key = Column(String(132), nullable=False)
    deposit_amount = Column(Float, nullable=False)
    transaction_hash = Column(String(66), nullable=False)
    
    # Status management
    status = Column(Enum(HolderStatus), default=HolderStatus.PENDING)
    last_seen = Column(DateTime)
    
    # Relationships
    election_id = Column(Integer, ForeignKey("elections.id"))
    election = relationship("Election", back_populates="secret_holders")
    shares = relationship("Share", back_populates="holder") 
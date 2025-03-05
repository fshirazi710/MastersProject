from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Election(Base):
    __tablename__ = "elections"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    required_deposit = Column(Float)
    required_holders = Column(Integer)
    status = Column(String)  # active, upcoming, completed
    
    # Relationships
    secret_holders = relationship("SecretHolder", back_populates="election")
    votes = relationship("Vote", back_populates="election") 
"""
Pydantic models related to vote sessions.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any # Added Dict, Any
from datetime import datetime # Added datetime

# Define SliderConfig schema
class SliderConfig(BaseModel):
    min: int
    max: int
    step: int
    initialValue: Optional[int] = None # Made optional
    marks: Optional[Dict[int, str]] = None # Made optional

# Keep VoteSessionMetadata as it's used by /metadata endpoint
class VoteSessionMetadata(BaseModel):
    """Schema for storing frontend-specific display metadata."""
    vote_session_id: int | str # Changed type hint slightly
    displayHint: Optional[str] = None
    sliderConfig: Optional[SliderConfig] = None # Use the SliderConfig model



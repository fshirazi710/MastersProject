from pydantic import BaseModel
from typing import List

class voteData(BaseModel):
    title: str
    description: str
    startDate: str
    endDate: str
    options: List[str]
    participantCount: int

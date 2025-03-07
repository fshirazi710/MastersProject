from pydantic import BaseModel
from typing import List

class voteData(BaseModel):
    title: str
    description: str
    startDate: str
    endDate: str
    options: List[str]
    rewardPool: float
    requiredDeposit: float

class votingToken(BaseModel):
    vote_id: int
    token: str
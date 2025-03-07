from typing import Optional
from pydantic import BaseModel, EmailStr


class User(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    created_at: Optional[str] = None

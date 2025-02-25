from pydantic import BaseModel

class registerData(BaseModel):
    name: str
    email: str
    password: str
    role: str

class loginData(BaseModel):
    email: str
    password: str

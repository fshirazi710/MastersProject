from typing import Union

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Users(BaseModel):
    email: str
    password: str

@app.get("/")
def read_root():
    return {"Hello": "World"}


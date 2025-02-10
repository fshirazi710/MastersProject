from fastapi import FastAPI
from app.routers.vote_router import router as vote_router
from starlette.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"], # Allow all HTTP methods (GET, POST, etc...)
    allow_headers=["*"], # Allow all headers
)

# Include routers
app.include_router(vote_router)

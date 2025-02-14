from fastapi import FastAPI
from app.routers.vote_router import router as vote_router
from app.routers.secret_holder_router import router as secret_holder_router
from app.routers.election_router import router as election_router
from app.routers.health_router import router as health_router
from starlette.middleware.cors import CORSMiddleware
from app.constants import CORS_ALLOWED_ORIGINS

app = FastAPI()

# Allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"], # Allow all HTTP methods (GET, POST, etc...)
    allow_headers=["*"], # Allow all headers
)

# Include routers
app.include_router(vote_router)
app.include_router(secret_holder_router)
app.include_router(election_router)
app.include_router(health_router)
from fastapi import FastAPI
from app.routers.vote_router import router as vote_router
from app.routers.secret_holder_router import router as secret_holder_router
from app.routers.election_router import router as election_router
from app.routers.health_router import router as health_router
from app.routers.authentication_router import router as authentication_router
from starlette.middleware.cors import CORSMiddleware
from app.core.config import CORS_ALLOWED_ORIGINS
from app.core.mongodb import connect_to_mongo, close_mongo_connection

# ... other imports

app = FastAPI()


# Event handlers for MongoDB connection
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()


@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()


# Allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc...)
    allow_headers=["*"],  # Allow all headers
)

# Include routers
app.include_router(vote_router)
app.include_router(secret_holder_router)
app.include_router(election_router)
app.include_router(health_router)
app.include_router(authentication_router)

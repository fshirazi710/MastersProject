from fastapi import FastAPI
from app.routers.vote_router import router as vote_router
from app.routers.election_router import router as election_router
from app.routers.holder_router import router as holder_router
from app.routers.auth_router import router as auth_router
from app.routers.share_router import router as share_router
from starlette.middleware.cors import CORSMiddleware
from app.core.config import CORS_ALLOWED_ORIGINS
from app.core.mongodb import connect_to_mongo, close_mongo_connection
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import logging
import sys


app = FastAPI(
    title="Timed Release Crypto System API",
    description="API for the Timed Release Crypto System",
    version="1.0.0"
)

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
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(vote_router, prefix="/api")
app.include_router(election_router, prefix="/api")
app.include_router(holder_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(auth_router, prefix="/api")

from fastapi import FastAPI
from app.routers.vote_router import router as vote_router
from app.routers.election_router import router as election_router
from app.routers.holder_router import router as holder_router
from app.routers.auth_router import router as auth_router
from app.routers.share_router import router as share_router
from starlette.middleware.cors import CORSMiddleware
from app.services.blockchain import BlockchainService
from app.core.config import CORS_ALLOWED_ORIGINS
from app.core.mongodb import connect_to_mongo, close_mongo_connection
import logging
import asyncio

# Configure logging
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Timed Release Crypto System API",
    description="API for the Timed Release Crypto System",
    version="1.0.0"
)

RUNNING = True

# Global blockchain service instance
blockchain_service: BlockchainService

# async def monitor_smart_contract():
#     """Periodically queries the smart contract for updates."""
#     global blockchain_service  # Use the global blockchain service instance

#     while RUNNING:
#         try:
#             logger.info("Checking smart contract state...")

#             # Replace with actual function that checks your contract
#             result = await blockchain_service.call_contract_function("getShares", 0)

#             await asyncio.sleep(600)  # Wait for 5 minutes (300 seconds)

#         except Exception as e:
#             logger.error(f"Error while querying the smart contract: {e}")
#             await asyncio.sleep(60)  # If error, wait 1 min before retrying


# Event handlers for MongoDB connection
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

# @app.on_event("startup")
# async def startup_event():
#     """Starts the background monitoring task when FastAPI starts."""
#     global blockchain_service
#     # Initialize BlockchainService here instead of using Depends
#     blockchain_service = BlockchainService()  # Initialize the blockchain service

#     # Start the background task to monitor the smart contract
#     asyncio.create_task(monitor_smart_contract())

# @app.on_event("shutdown")
# async def shutdown_event():
#     """Stops the monitoring loop gracefully when FastAPI shuts down."""
#     global RUNNING
#     RUNNING = False

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

from fastapi import FastAPI
from contextlib import asynccontextmanager # Import for lifespan
import logging # Import logging

from app.routers.encrypted_vote_router import router as encrypted_vote_router
from app.routers.vote_session_router import router as vote_session_router
from app.routers.holder_router import router as holder_router
from app.routers.auth_router import router as auth_router
from app.routers.share_router import router as share_router
from starlette.middleware.cors import CORSMiddleware
from app.core.config import CORS_ALLOWED_ORIGINS
# Import the new admin router
from app.routers.admin_router import router as admin_router

# Import new MongoDB utils
from app.db.mongodb_utils import startup_db_client as mongo_startup, shutdown_db_client as mongo_shutdown, get_mongo_db
# Import new Cache Service utils
from app.services.cache_service import startup_cache_service, CacheService # Import startup_cache_service
# Import Blockchain Service (needed to instantiate for cache service)
from app.services.blockchain import BlockchainService

logger = logging.getLogger(__name__)

# --- Lifespan Context Manager --- 
# This replaces the old @app.on_event("startup/shutdown") decorators

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Application startup...")
    # Connect DB
    await mongo_startup()
    
    # Initialize services needed for background tasks
    # Note: Direct instantiation might be okay for singletons, 
    # or use a proper dependency injection container if complexity grows.
    try:
        db = await get_mongo_db() # Get DB instance after connection
        blockchain_service = BlockchainService() # Instantiate blockchain service
        # Start cache listener and store instance (e.g., on app state)
        app.state.cache_service = await startup_cache_service(blockchain_service, db) # Use new startup function
        logger.info("Cache service listener and poller started.")
    except Exception as e:
        logger.error(f"Failed to start background services during startup: {e}", exc_info=True)
        # Depending on severity, might want to prevent app from fully starting
        # For now, log the error and continue startup
        app.state.cache_service = None 
        
    yield # Application runs here
    
    # Shutdown logic
    logger.info("Application shutdown...")
    # Stop cache listener
    if hasattr(app.state, 'cache_service') and app.state.cache_service is not None:
         if isinstance(app.state.cache_service, CacheService):
              app.state.cache_service.stop() # Use the stop method
              # Give it a moment to stop gracefully if needed (optional)
              # await asyncio.sleep(1)
         else:
             logger.error("app.state.cache_service is not a CacheService instance, cannot stop.")
    else:
        logger.warning("Cache service instance not found on app state during shutdown.")
        
    # Close DB connection
    await mongo_shutdown()
    logger.info("Application shutdown complete.")

# --- App Initialization --- 
app = FastAPI(
    title="Timed Release Crypto System API",
    description="API for the Timed Release Crypto System",
    version="1.0.0",
    lifespan=lifespan # Register lifespan context manager
)

# --- Middleware --- 
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers --- 
app.include_router(encrypted_vote_router, prefix="/api")
app.include_router(vote_session_router, prefix="/api")
app.include_router(holder_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
# Include the admin router
app.include_router(admin_router, prefix="/api") # Apply the /api prefix here as well

# Remove old event handlers
# @app.on_event("startup")
# async def startup_db_client():
#     await mongo_startup()
# 
# @app.on_event("shutdown")
# async def shutdown_db_client():
#     await mongo_shutdown()

"""
Admin router for administrative tasks.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
import logging
from typing import Optional # Import Optional
import asyncio

# from app.core.dependencies import get_blockchain_service # May not be needed directly
# from app.db.mongodb_utils import get_mongo_db # May not be needed directly for these routes
from app.services.cache_service import CacheService # Need CacheService type
from app.schemas import StandardResponse
# Import the actual admin auth dependency
from app.core.security import get_current_admin_user

logger = logging.getLogger(__name__)

# Placeholder for auth dependency - REMOVE
# async def get_current_admin_user_placeholder():
#     logger.warning("Using placeholder authentication for admin endpoint.")
#     return {"username": "admin_placeholder", "role": "admin"}

router = APIRouter(
    prefix="/admin", 
    tags=["Admin"], 
    dependencies=[Depends(get_current_admin_user)] # Apply REAL admin auth to all routes
)


@router.post("/cache/refresh", response_model=StandardResponse)
async def trigger_full_cache_refresh(request: Request):
    """
    Triggers a full refresh of the MongoDB cache by re-populating sessions 
    and participant data from the blockchain.
    Requires admin privileges (enforced by router dependency).
    """
    logger.info("Admin request received: Trigger full cache refresh.")
    
    cache_service: Optional[CacheService] = request.app.state.cache_service
    
    if not cache_service or not isinstance(cache_service, CacheService):
        logger.error("CacheService not found or is not the correct type in application state.")
        raise HTTPException(status_code=500, detail="Cache service is not available.")
        
    try:
        logger.info("Initiating cache population tasks...")
        # For a full refresh, we want to re-populate sessions and then participants
        await cache_service.populate_initial_cache() # Refreshes session cache
        
        # To ensure participants are also fully refreshed for all sessions:
        # We need a method in CacheService to trigger a full participant refresh for all sessions.
        # Let's assume populate_initial_cache() handles sessions and CacheService.start() would have started
        # the participant poller. For an explicit full refresh here, we might want to call
        # the core logic of the participant poller. 
        # The most straightforward is to call the methods that are called by the poller.
        
        # Get all session IDs from the now potentially refreshed sessions cache
        db_sessions_cursor = cache_service.db.sessions.find({}, projection={"session_id": 1, "_id": 0})
        session_ids = [doc['session_id'] async for doc in db_sessions_cursor]
        
        if session_ids:
            logger.info(f"Triggering participant data refresh for {len(session_ids)} sessions.")
            for sid in session_ids:
                await cache_service.poll_participants_for_session(sid)
                await asyncio.sleep(0.1) # Small delay to yield control if many sessions
        
        logger.info("Cache refresh tasks for sessions and their participants initiated.")
        return StandardResponse(success=True, message="Full cache refresh initiated successfully.")

    except Exception as e:
        logger.exception(f"Error initiating cache refresh: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate cache refresh: {str(e)}")

# Example of a new method that could be added to CacheService for a more direct full refresh:
# async def force_full_participant_refresh(self):
# logger.info("Forcing full participant data refresh for all cached sessions...")
# cached_sessions_cursor = self.db.sessions.find({}, projection={"session_id": 1, "_id": 0})
# session_ids = [doc['session_id'] async for doc in cached_sessions_cursor]
# for sid in session_ids:
# await self.poll_participants_for_session(sid)
# logger.info("Full participant data refresh complete.")


# TODO: Add endpoint to refresh a single session? 
# POST /cache/refresh/session/{session_id} 
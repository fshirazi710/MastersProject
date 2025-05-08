"""
Centralized dependencies for FastAPI routes.
This module provides dependency injection functions for services used across the application.
"""
from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.orm import Session

from app.services.blockchain import BlockchainService
from app.db.mongodb_utils import get_mongo_db
import logging

logger = logging.getLogger(__name__)

# Singleton instances
_blockchain_service = None

def get_blockchain_service() -> BlockchainService:
    """
    Dependency for getting a BlockchainService instance.
    Returns a singleton instance to avoid creating multiple connections.
    
    This service interacts with the TimedReleaseVoting smart contract and provides
    methods for all contract functions including:
    - Joining as a secret holder
    - Submitting votes with rewards
    - Submitting shares
    - Triggering reward distribution
    - Claiming rewards
    - Exiting as a holder
    - Forcing exit of non-compliant holders
    """
    global _blockchain_service
    if _blockchain_service is None:
        try:
            _blockchain_service = BlockchainService()
            logger.info("BlockchainService initialized successfully")
        except ConnectionError as e:
            logger.error(f"Failed to initialize BlockchainService: Connection error: {e}")
            raise HTTPException(status_code=503, detail=f"Blockchain service unavailable: {e}")
        except ImportError as e:
            logger.error(f"Failed to initialize BlockchainService: Configuration error: {e}")
            raise HTTPException(status_code=500, detail=f"Blockchain service configuration error: {e}")
        except AttributeError as e:
            logger.error(f"Failed to initialize BlockchainService: Missing config: {e}")
            raise HTTPException(status_code=500, detail=f"Blockchain service configuration error: {e}")
        except Exception as e:
            logger.error(f"Failed to initialize BlockchainService: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize blockchain service: {e}")
    return _blockchain_service

async def get_db() -> AsyncIOMotorClient:
    """
    Dependency for getting a database connection.
    Simply wraps the get_mongo_db function for consistency.
    
    Used for storing:
    - User information
    - Vote metadata
    - Share submissions
    - Reward distribution records
    """
    db = await get_mongo_db()
    return db 
"""
Centralized dependencies for FastAPI routes.
This module provides dependency injection functions for services used across the application.
"""
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient

from app.services.blockchain import BlockchainService
from app.core.mongodb import get_mongodb
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
        except Exception as e:
            logger.error(f"Failed to initialize BlockchainService: {e}")
            raise
    return _blockchain_service

async def get_db() -> AsyncIOMotorClient:
    """
    Dependency for getting a database connection.
    Simply wraps the get_mongodb function for consistency.
    
    Used for storing:
    - User information
    - Vote metadata
    - Share submissions
    - Reward distribution records
    """
    db = await get_mongodb()
    return db 
"""
Centralized dependencies for FastAPI routes.
This module provides dependency injection functions for services used across the application.
"""
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient

from app.services.blockchain import BlockchainService
from app.services.crypto import CryptoService
from app.core.mongodb import get_mongodb
import logging

logger = logging.getLogger(__name__)

# Singleton instances
_blockchain_service = None
_crypto_service = None

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

def get_crypto_service() -> CryptoService:
    """
    Dependency for getting a CryptoService instance.
    Returns a singleton instance for efficiency.
    
    This service provides cryptographic operations for the timed-release system:
    - BLS12-381 curve operations
    - Secret sharing using Lagrange interpolation
    - AES-GCM encryption/decryption
    - Share verification using pairings
    """
    global _crypto_service
    if _crypto_service is None:
        try:
            _crypto_service = CryptoService()
            logger.info("CryptoService initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize CryptoService: {e}")
            raise
    return _crypto_service

def get_db() -> AsyncIOMotorClient:
    """
    Dependency for getting a database connection.
    Simply wraps the get_mongodb function for consistency.
    
    Used for storing:
    - User information
    - Vote metadata
    - Share submissions
    - Reward distribution records
    """
    return get_mongodb() 
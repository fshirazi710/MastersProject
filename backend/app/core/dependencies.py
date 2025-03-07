"""
Centralized dependencies for FastAPI routes.
This module provides dependency injection functions for services used across the application.
"""
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient

from app.services.blockchain import BlockchainService
from app.services.crypto import CryptoService
from app.core.mongodb import get_mongodb

# Singleton instances
_blockchain_service = None
_crypto_service = None

def get_blockchain_service() -> BlockchainService:
    """
    Dependency for getting a BlockchainService instance.
    Returns a singleton instance to avoid creating multiple connections.
    """
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service

def get_crypto_service() -> CryptoService:
    """
    Dependency for getting a CryptoService instance.
    Returns a singleton instance for efficiency.
    """
    global _crypto_service
    if _crypto_service is None:
        _crypto_service = CryptoService()
    return _crypto_service

def get_db() -> AsyncIOMotorClient:
    """
    Dependency for getting a database connection.
    Simply wraps the get_mongodb function for consistency.
    """
    return get_mongodb() 
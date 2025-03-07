"""
Standardized error handling for the application.
This module provides consistent error handling functions and classes.
"""
from fastapi import HTTPException
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class APIError(Exception):
    """Base exception class for API errors."""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.detail)

def handle_blockchain_error(operation: str, error: Exception) -> HTTPException:
    """
    Handle blockchain-related errors consistently.
    
    Args:
        operation: Description of the operation that failed
        error: The exception that was raised
        
    Returns:
        HTTPException with appropriate status code and detail
    """
    error_message = f"Failed to {operation}: {str(error)}"
    logger.error(error_message)
    return HTTPException(status_code=500, detail=error_message)

def handle_database_error(operation: str, error: Exception) -> HTTPException:
    """
    Handle database-related errors consistently.
    
    Args:
        operation: Description of the operation that failed
        error: The exception that was raised
        
    Returns:
        HTTPException with appropriate status code and detail
    """
    error_message = f"Failed to {operation}: {str(error)}"
    logger.error(error_message)
    return HTTPException(status_code=500, detail=error_message)

def handle_validation_error(message: str) -> HTTPException:
    """
    Handle validation errors consistently.
    
    Args:
        message: Description of the validation error
        
    Returns:
        HTTPException with 400 status code
    """
    logger.warning(f"Validation error: {message}")
    return HTTPException(status_code=400, detail=message)

def handle_not_found_error(resource_type: str, resource_id: str) -> HTTPException:
    """
    Handle not found errors consistently.
    
    Args:
        resource_type: Type of resource that wasn't found (e.g., "vote", "holder")
        resource_id: ID of the resource
        
    Returns:
        HTTPException with 404 status code
    """
    message = f"{resource_type} with ID {resource_id} not found"
    logger.warning(message)
    return HTTPException(status_code=404, detail=message) 
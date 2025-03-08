import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Import after path setup
from app.services.blockchain import BlockchainService
from app.services.crypto import CryptoService
from app.core.dependencies import get_blockchain_service, get_crypto_service, get_db
from main import app

# Mock services
@pytest.fixture
def mock_blockchain_service():
    """Mock blockchain service."""
    mock = AsyncMock()
    
    # Setup async mocks
    mock.get_holders = AsyncMock(return_value=["0x123", "0x456"])
    mock.get_holder_count = AsyncMock(return_value=2)
    mock.is_holder = AsyncMock(return_value=True)
    mock.get_holder_public_key = AsyncMock(return_value=[123456789, 987654321])
    mock.get_required_deposit = AsyncMock(return_value=1000000000000000000)  # 1 ETH in Wei
    mock.join_as_holder = AsyncMock(return_value={
        "success": True,
        "message": "Successfully joined as holder",
        "transaction_hash": "0x1234567890abcdef",
        "holder_address": "0x123",
        "public_key": [123456789, 987654321]
    })
    mock.get_vote = AsyncMock(return_value=[
        bytes.fromhex("0a1b2c3d4e5f"),
        bytes.fromhex("f5e4d3c2b1a0"),
        int(datetime.now().timestamp()) + 3600,
        [123456789, 987654321]
    ])
    mock.vote_count = AsyncMock(return_value=2)
    mock.decrypt_vote = AsyncMock(return_value={
        "success": True,
        "message": "Successfully decrypted vote",
        "data": {
            "vote_data": "test_vote_data",
            "decryption_time": int(datetime.now().timestamp()) + 3600,
            "shares_used": 3
        }
    })
    mock.submit_vote = AsyncMock(return_value={
        "success": True,
        "message": "Successfully submitted vote",
        "transaction_hash": "0x1234567890abcdef",
        "vote_id": 1
    })
    mock.submit_share = AsyncMock(return_value={
        "success": True,
        "message": "Successfully submitted share",
        "transaction_hash": "0x1234567890abcdef"
    })
    mock.verify_share_submission = AsyncMock(return_value=True)
    mock.get_share_status = AsyncMock(return_value={
        "success": True,
        "message": "Successfully retrieved share status",
        "data": {
            "total_holders": 3,
            "submitted_shares": 2,
            "missing_shares": 1,
            "holder_status": {
                "0x123": {"submitted": True, "valid": True},
                "0x456": {"submitted": True, "valid": False},
                "0x789": {"submitted": False, "valid": False}
            }
        }
    })
    
    # Setup contract function mocks
    mock.contract = AsyncMock()
    mock.contract.functions = AsyncMock()
    
    # Setup web3 mock
    mock.w3 = MagicMock()
    mock.w3.from_wei.return_value = 1.0
    mock.w3.eth.get_transaction_count.return_value = 1
    mock.w3.eth.send_raw_transaction.return_value = bytes.fromhex("1234567890abcdef")
    
    return mock

@pytest.fixture
def mock_crypto_service():
    """Create a mock crypto service for testing."""
    service = MagicMock(spec=CryptoService)
    
    # Mock common methods
    service.generate_keypair = MagicMock()
    service.encrypt_vote = MagicMock()
    service.decrypt_vote = MagicMock()
    service.generate_shares = MagicMock()
    service.reconstruct_secret = MagicMock()
    service.verify_share = MagicMock()
    service.hash_to_scalar = MagicMock()
    
    return service

@pytest.fixture
def mock_db():
    """Create a mock database client for testing."""
    client = MagicMock(spec=AsyncIOMotorClient)
    
    # Mock users collection directly
    client.users = MagicMock()
    client.users.find_one = AsyncMock()
    client.users.insert_one = AsyncMock()
    
    # Mock tokens collection
    client.election_tokens = MagicMock()
    client.election_tokens.tokens = MagicMock()
    client.election_tokens.tokens.find_one = AsyncMock()
    client.election_tokens.tokens.insert_one = AsyncMock()
    
    return client

# Override dependencies for testing
@pytest.fixture
def client(mock_blockchain_service, mock_crypto_service, mock_db):
    """Create a test client with mocked dependencies."""
    
    # Override dependencies
    app.dependency_overrides[get_blockchain_service] = lambda: mock_blockchain_service
    app.dependency_overrides[get_crypto_service] = lambda: mock_crypto_service
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # Create test client
    test_client = TestClient(app)
    
    yield test_client
    
    # Reset overrides after test
    app.dependency_overrides = {} 
"""
Tests for the secret holder router.
"""
import pytest
from fastapi import status
from unittest.mock import AsyncMock, MagicMock, patch

# Test data
test_holder_address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
test_public_key = [123456789, 987654321]
test_deposit_amount = 1.0

# Tests for the /holders endpoint
class TestGetHolders:
    
    @pytest.mark.asyncio
    async def test_get_all_holders_success(self, client, mock_blockchain_service):
        """Test getting all holders successfully."""
        # Setup mock for getHolders
        mock_holders = [test_holder_address, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=mock_holders)
        mock_blockchain_service.contract.functions.getHolders = MagicMock(return_value=mock_func)
        
        # Setup mock for getHolderPublicKey
        mock_pk_func = AsyncMock()
        mock_pk_func.call = AsyncMock(return_value=test_public_key)
        mock_blockchain_service.contract.functions.getHolderPublicKey = MagicMock(return_value=mock_pk_func)
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved" in data["message"]
        assert len(data["data"]) == 2
        # Check first holder
        assert data["data"][0]["address"] == test_holder_address
        assert data["data"][0]["public_key"] == test_public_key
        assert data["data"][0]["active"] is True
        # Check second holder
        assert data["data"][1]["address"] == "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
        assert data["data"][1]["public_key"] == test_public_key
        assert data["data"][1]["active"] is True
    
    @pytest.mark.asyncio
    async def test_get_all_holders_empty(self, client, mock_blockchain_service):
        """Test getting all holders when there are none."""
        # Setup mock
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=[])
        mock_blockchain_service.contract.functions.getHolders = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 0
    
    @pytest.mark.asyncio
    async def test_get_all_holders_error(self, client, mock_blockchain_service):
        """Test error handling when getting all holders."""
        # Setup mock to raise an exception
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(side_effect=Exception("Blockchain error"))
        mock_blockchain_service.contract.functions.getHolders = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]

# Tests for the /holders/count endpoint
class TestGetHolderCount:
    
    @pytest.mark.asyncio
    async def test_get_holder_count_success(self, client, mock_blockchain_service):
        """Test getting holder count successfully."""
        # Setup mock
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=3)
        mock_blockchain_service.contract.functions.holderCount = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get("/api/holders/count")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved" in data["message"]
        assert data["data"]["count"] == 3

# Tests for the /holders/{address} endpoint
class TestCheckHolderStatus:
    
    @pytest.mark.asyncio
    async def test_check_holder_status_is_holder(self, client, mock_blockchain_service):
        """Test checking status of an address that is a holder."""
        # Setup mocks
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=True)
        mock_blockchain_service.contract.functions.isHolder = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get(f"/api/holders/status/{test_holder_address}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "is a holder" in data["message"]
        assert data["data"]["is_holder"] is True
    
    @pytest.mark.asyncio
    async def test_check_holder_status_not_holder(self, client, mock_blockchain_service):
        """Test checking status of an address that is not a holder."""
        # Setup mock
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=False)
        mock_blockchain_service.contract.functions.isHolder = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get(f"/api/holders/status/{test_holder_address}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "not a holder" in data["message"]
        assert data["data"]["is_holder"] is False

# Tests for the /holders/deposit endpoint
class TestGetRequiredDeposit:
    
    @pytest.mark.asyncio
    async def test_get_required_deposit_success(self, client, mock_blockchain_service):
        """Test getting required deposit amount successfully."""
        # Setup mocks
        deposit_wei = 1000000000000000000  # 1 ETH in Wei
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(return_value=deposit_wei)
        mock_blockchain_service.contract.functions.requiredDeposit = MagicMock(return_value=mock_func)
        
        # Mock Web3 conversion
        mock_blockchain_service.w3.from_wei = MagicMock(return_value=1.0)
        
        # Make request
        response = client.get("/api/holders/deposit")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved" in data["message"]
        assert data["data"]["required_deposit"] == 1.0
    
    @pytest.mark.asyncio
    async def test_get_required_deposit_error(self, client, mock_blockchain_service):
        """Test error handling when getting required deposit."""
        # Setup mock to raise an exception
        mock_func = AsyncMock()
        mock_func.call = AsyncMock(side_effect=Exception("Blockchain error"))
        mock_blockchain_service.contract.functions.requiredDeposit = MagicMock(return_value=mock_func)
        
        # Make request
        response = client.get("/api/holders/deposit")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]

# Tests for the /holders/join endpoint
class TestJoinAsHolder:
    
    @pytest.mark.asyncio
    async def test_join_as_holder_success(self, client, mock_blockchain_service):
        """Test joining as a holder successfully."""
        # Setup mock
        mock_blockchain_service.join_as_holder = AsyncMock(return_value={
            "success": True,
            "message": "Successfully joined as holder",
            "transaction_hash": "0x1234567890abcdef"
        })
        
        # Request data
        request_data = {
            "public_key": test_public_key,
            "deposit_amount": test_deposit_amount
        }
        
        # Make request
        response = client.post("/api/holders/join", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully joined" in data["message"]
        assert data["data"]["success"] is True
        assert "Successfully joined" in data["data"]["message"]
        assert data["data"]["transaction_hash"] == "0x1234567890abcdef"
    
    @pytest.mark.asyncio
    async def test_join_as_holder_invalid_public_key(self, client):
        """Test joining with an invalid public key."""
        # Request data with invalid public key
        request_data = {
            "public_key": [123456789],  # Missing second component
            "deposit_amount": test_deposit_amount
        }
        
        # Make request
        response = client.post("/api/holders/join", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        # Print the actual error message for debugging
        print("Validation error:", data["detail"])
        assert any("too_short" in str(error["type"]).lower() for error in data["detail"])
    
    @pytest.mark.asyncio
    async def test_join_as_holder_blockchain_error(self, client, mock_blockchain_service):
        """Test error handling when joining as a holder."""
        # Setup mock to return an error
        mock_blockchain_service.join_as_holder = AsyncMock(side_effect=Exception("Transaction failed"))
        
        # Request data
        request_data = {
            "public_key": test_public_key,
            "deposit_amount": test_deposit_amount
        }
        
        # Make request
        response = client.post("/api/holders/join", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Transaction failed" in data["detail"]
"""
Tests for the secret holder router.
"""
import pytest
from fastapi import status
import json

# Test data
test_holder_address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
test_public_key = [123456789, 987654321]
test_deposit_amount = 1.0

# Tests for the /holders endpoint
class TestGetHolders:
    
    @pytest.mark.asyncio
    async def test_get_all_holders_success(self, client, mock_blockchain_service):
        """Test getting all holders successfully."""
        # Setup mock
        mock_holders = [test_holder_address, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
        mock_blockchain_service.get_holders.return_value = mock_holders
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved holders" in data["message"]
        assert data["data"] == mock_holders
        
        # Verify mock calls
        mock_blockchain_service.get_holders.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_all_holders_empty(self, client, mock_blockchain_service):
        """Test getting all holders when there are none."""
        # Setup mock
        mock_blockchain_service.get_holders.return_value = []
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"] == []
        
        # Verify mock calls
        mock_blockchain_service.get_holders.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_all_holders_error(self, client, mock_blockchain_service):
        """Test error handling when getting all holders."""
        # Setup mock to raise an exception
        mock_blockchain_service.get_holders.side_effect = Exception("Blockchain error")
        
        # Make request
        response = client.get("/api/holders")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get holders: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.get_holders.assert_called_once()

# Tests for the /holders/count endpoint
class TestGetHolderCount:
    
    async def test_get_holder_count_success(self, client, mock_blockchain_service):
        """Test getting holder count successfully."""
        # Setup mock
        mock_blockchain_service.contract.functions.holderCount().return_value.call.return_value = 3
        
        # Make request
        response = client.get("/api/holders/count")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved holder count" in data["message"]
        assert data["data"]["count"] == 3
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.holderCount.assert_called_once()

# Tests for the /holders/{address} endpoint
class TestCheckHolderStatus:
    
    async def test_check_holder_status_is_holder(self, client, mock_blockchain_service):
        """Test checking status of an address that is a holder."""
        # Setup mocks
        mock_blockchain_service.contract.functions.isHolder().return_value.call.return_value = True
        mock_blockchain_service.contract.functions.getHolderPublicKey().return_value.call.return_value = test_public_key
        
        # Make request
        response = client.get(f"/api/holders/status/{test_holder_address}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert f"Address {test_holder_address} is a holder" in data["message"]
        assert data["data"]["is_holder"] is True
        assert data["data"]["public_key"] == test_public_key
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.isHolder.assert_called_once()
        mock_blockchain_service.contract.functions.getHolderPublicKey.assert_called_once()
    
    async def test_check_holder_status_not_holder(self, client, mock_blockchain_service):
        """Test checking status of an address that is not a holder."""
        # Setup mock
        mock_blockchain_service.contract.functions.isHolder().return_value.call.return_value = False
        
        # Make request
        response = client.get(f"/api/holders/status/{test_holder_address}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert f"Address {test_holder_address} is not a holder" in data["message"]
        assert data["data"]["is_holder"] is False
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.isHolder.assert_called_once_with(test_holder_address)

# Tests for the /holders/deposit endpoint
class TestGetRequiredDeposit:
    
    async def test_get_required_deposit_success(self, client, mock_blockchain_service):
        """Test getting required deposit amount successfully."""
        # Setup mocks
        deposit_wei = 1000000000000000000  # 1 ETH in Wei
        mock_blockchain_service.contract.functions.requiredDeposit().return_value.call.return_value = deposit_wei
        mock_blockchain_service.w3.from_wei.return_value = 1.0
        
        # Make request
        response = client.get("/api/holders/deposit")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved required deposit" in data["message"]
        assert data["data"]["deposit_amount"] == 1.0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.requiredDeposit.assert_called_once()
        mock_blockchain_service.w3.from_wei.assert_called_once_with(deposit_wei, 'ether')
    
    async def test_get_required_deposit_error(self, client, mock_blockchain_service):
        """Test error handling when getting required deposit."""
        # Setup mock to raise an exception
        mock_blockchain_service.contract.functions.requiredDeposit().return_value.call.side_effect = Exception("Blockchain error")
        
        # Make request
        response = client.get("/api/holders/deposit")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get required deposit: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.requiredDeposit.assert_called_once()

# Tests for the /holders/join endpoint
class TestJoinAsHolder:
    
    async def test_join_as_holder_success(self, client, mock_blockchain_service):
        """Test joining as a holder successfully."""
        # Setup mock
        mock_blockchain_service.join_as_holder.return_value = {
            "success": True,
            "transaction_hash": "0x1234567890abcdef",
            "holder_address": test_holder_address,
            "public_key": test_public_key
        }
        
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
        assert "Successfully joined as a secret holder" in data["message"]
        assert data["data"]["transaction_hash"] == "0x1234567890abcdef"
        assert data["data"]["holder_address"] == test_holder_address
        assert data["data"]["public_key"] == test_public_key
        
        # Verify mock calls
        mock_blockchain_service.join_as_holder.assert_called_once_with(
            public_key=test_public_key,
            deposit_amount=test_deposit_amount
        )
    
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
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Validation error: Public key must have exactly 2 components [x, y]"
    
    async def test_join_as_holder_blockchain_error(self, client, mock_blockchain_service):
        """Test error handling when joining as a holder."""
        # Setup mock to return an error
        mock_blockchain_service.join_as_holder.return_value = {
            "success": False,
            "error": "Transaction failed"
        }
        
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
        assert data["detail"] == "Failed to join as holder: Transaction failed"
        
        # Verify mock calls
        mock_blockchain_service.join_as_holder.assert_called_once_with(
            public_key=test_public_key,
            deposit_amount=test_deposit_amount
        )
"""
Tests for the share router.
"""
import pytest
from fastapi import status
import json
from unittest.mock import AsyncMock, MagicMock

# Test data
test_vote_id = 1
test_share_index = 2
test_share_value = 123456789
test_holder_address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

# Tests for the /shares endpoint (submit share)
class TestSubmitShare:
    
    async def test_submit_share_success(self, client, mock_blockchain_service):
        """Test submitting a share successfully."""
        # Setup mock
        mock_blockchain_service.submit_share = AsyncMock(return_value={
            "success": True,
            "transaction_hash": "0x1234567890abcdef"
        })
        
        # Request data
        request_data = {
            "vote_id": test_vote_id,
            "share_index": test_share_index,
            "share_value": test_share_value
        }
        
        # Make request
        response = client.post("/api/shares", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Share submitted successfully" in data["message"]
        assert data["data"]["transaction_hash"] == "0x1234567890abcdef"
        
        # Verify mock calls
        mock_blockchain_service.submit_share.assert_called_once_with(
            vote_id=test_vote_id,
            share=(test_share_index, test_share_value)
        )
    
    async def test_submit_share_error(self, client, mock_blockchain_service):
        """Test error handling when submitting a share."""
        # Setup mock to return an error
        mock_blockchain_service.submit_share = AsyncMock(return_value={
            "success": False,
            "error": "Transaction failed"
        })
        
        # Request data
        request_data = {
            "vote_id": test_vote_id,
            "share_index": test_share_index,
            "share_value": test_share_value
        }
        
        # Make request
        response = client.post("/api/shares", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Transaction failed" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.submit_share.assert_called_once_with(
            vote_id=test_vote_id,
            share=(test_share_index, test_share_value)
        )
    
    async def test_submit_share_invalid_data(self, client):
        """Test submitting a share with invalid data."""
        # Test with missing fields
        response = client.post("/api/shares", json={"vote_id": test_vote_id})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with negative vote_id
        invalid_data = {
            "vote_id": -1,
            "share_index": test_share_index,
            "share_value": test_share_value
        }
        response = client.post("/api/shares", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with zero share_index
        invalid_data = {
            "vote_id": test_vote_id,
            "share_index": 0,
            "share_value": test_share_value
        }
        response = client.post("/api/shares", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

# Tests for the /shares/verify endpoint
class TestVerifyShare:
    
    async def test_verify_share_valid(self, client, mock_blockchain_service):
        """Test verifying a valid share."""
        # Setup mock
        mock_blockchain_service.verify_share_submission = AsyncMock(return_value=True)
        
        # Request data
        request_data = {
            "vote_id": test_vote_id,
            "holder_address": test_holder_address,
            "share": [test_share_index, test_share_value]
        }
        
        # Make request
        response = client.post("/api/shares/verify", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Share verification successful" in data["message"]
        assert data["data"]["valid"] is True
        assert data["data"]["holder_address"] == test_holder_address
        assert data["data"]["vote_id"] == test_vote_id
        
        # Verify mock calls
        mock_blockchain_service.verify_share_submission.assert_called_once_with(
            vote_id=test_vote_id,
            holder_address=test_holder_address,
            share=[test_share_index, test_share_value]
        )
    
    async def test_verify_share_invalid(self, client, mock_blockchain_service):
        """Test verifying an invalid share."""
        # Setup mock
        mock_blockchain_service.verify_share_submission = AsyncMock(return_value=False)
        
        # Request data
        request_data = {
            "vote_id": test_vote_id,
            "holder_address": test_holder_address,
            "share": [test_share_index, test_share_value]
        }
        
        # Make request
        response = client.post("/api/shares/verify", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Share verification failed" in data["message"]
        assert data["data"]["valid"] is False
        assert data["data"]["holder_address"] == test_holder_address
        assert data["data"]["vote_id"] == test_vote_id
        
        # Verify mock calls
        mock_blockchain_service.verify_share_submission.assert_called_once_with(
            vote_id=test_vote_id,
            holder_address=test_holder_address,
            share=[test_share_index, test_share_value]
        )
    
    async def test_verify_share_error(self, client, mock_blockchain_service):
        """Test error handling when verifying a share."""
        # Setup mock to raise an exception
        mock_blockchain_service.verify_share_submission = AsyncMock(side_effect=Exception("Verification error"))
        
        # Request data
        request_data = {
            "vote_id": test_vote_id,
            "holder_address": test_holder_address,
            "share": [test_share_index, test_share_value]
        }
        
        # Make request
        response = client.post("/api/shares/verify", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Verification error" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.verify_share_submission.assert_called_once_with(
            vote_id=test_vote_id,
            holder_address=test_holder_address,
            share=[test_share_index, test_share_value]
        )

# Tests for the /shares/by-vote/{vote_id} endpoint
class TestGetSubmittedShares:
    
    async def test_get_submitted_shares_success(self, client, mock_blockchain_service):
        """Test getting submitted shares successfully."""
        # Setup mocks for contract functions
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(return_value=["vote_data"])
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        submitters = [test_holder_address, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
        shares = [
            [1, 123456789],
            [2, 987654321]
        ]
        
        get_shares_mock = AsyncMock()
        get_shares_mock.call = AsyncMock(return_value=(submitters, shares))
        mock_blockchain_service.contract.functions.getSubmittedShares = MagicMock(return_value=get_shares_mock)
        
        # Make request
        response = client.get(f"/api/shares/by-vote/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert f"Successfully retrieved 2 submitted shares for vote {test_vote_id}" in data["message"]
        assert data["data"]["vote_id"] == test_vote_id
        assert len(data["data"]["submitted_shares"]) == 2
        assert data["data"]["count"] == 2
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()
        mock_blockchain_service.contract.functions.getSubmittedShares.assert_called_once()
    
    async def test_get_submitted_shares_vote_not_found(self, client, mock_blockchain_service):
        """Test getting submitted shares for a non-existent vote."""
        # Setup mock to raise an exception
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(side_effect=Exception("Vote not found"))
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        # Make request
        response = client.get(f"/api/shares/by-vote/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == f"Vote with ID {test_vote_id} not found"
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()
        mock_blockchain_service.contract.functions.getSubmittedShares.assert_not_called()
    
    async def test_get_submitted_shares_empty(self, client, mock_blockchain_service):
        """Test getting submitted shares when there are none."""
        # Setup mocks
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(return_value=["vote_data"])
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        get_shares_mock = AsyncMock()
        get_shares_mock.call = AsyncMock(return_value=([], []))
        mock_blockchain_service.contract.functions.getSubmittedShares = MagicMock(return_value=get_shares_mock)
        
        # Make request
        response = client.get(f"/api/shares/by-vote/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert f"Successfully retrieved 0 submitted shares for vote {test_vote_id}" in data["message"]
        assert data["data"]["vote_id"] == test_vote_id
        assert len(data["data"]["submitted_shares"]) == 0
        assert data["data"]["count"] == 0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()
        mock_blockchain_service.contract.functions.getSubmittedShares.assert_called_once()
    
    async def test_get_submitted_shares_error(self, client, mock_blockchain_service):
        """Test error handling when getting submitted shares."""
        # Setup mock to raise an exception
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(return_value=["vote_data"])
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        get_shares_mock = AsyncMock()
        get_shares_mock.call = AsyncMock(side_effect=Exception("Blockchain error"))
        mock_blockchain_service.contract.functions.getSubmittedShares = MagicMock(return_value=get_shares_mock)
        
        # Make request
        response = client.get(f"/api/shares/by-vote/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()
        mock_blockchain_service.contract.functions.getSubmittedShares.assert_called_once() 
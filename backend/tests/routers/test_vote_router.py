"""
Tests for the vote router.
"""
import pytest
from fastapi import status
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Test data
test_vote_id = 1
test_vote_data = "This is a secret ballot"
test_decryption_time = int((datetime.now() + timedelta(days=1)).timestamp())  # Tomorrow
test_ciphertext = "0a1b2c3d4e5f"
test_nonce = "f5e4d3c2b1a0"
test_g2r = ["123456789", "987654321"]

# Tests for the GET /votes endpoint
class TestGetAllVotes:
    
    async def test_get_all_votes_success(self, client, mock_blockchain_service):
        """Test getting all votes successfully."""
        # Setup mocks
        mock_blockchain_service.contract.functions.voteCount().return_value.call.return_value = 2
        
        # Mock vote data for two votes
        vote_data1 = [
            bytes.fromhex(test_ciphertext),
            bytes.fromhex(test_nonce),
            test_decryption_time,
            [int(test_g2r[0]), int(test_g2r[1])]
        ]
        vote_data2 = [
            bytes.fromhex("aabbccddeeff"),
            bytes.fromhex("ffeeddccbbaa"),
            test_decryption_time + 3600,  # 1 hour later
            [int(test_g2r[0]) + 1, int(test_g2r[1]) + 1]
        ]
        
        # Setup mock to return different vote data for different vote IDs
        def get_vote_side_effect(vote_id):
            mock = MagicMock()
            if vote_id == 0:
                mock.call.return_value = vote_data1
            else:
                mock.call.return_value = vote_data2
            return mock
        
        mock_blockchain_service.contract.functions.getVote.side_effect = get_vote_side_effect
        
        # Make request
        response = client.get("/api/votes")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved 2 votes" in data["message"]
        assert len(data["data"]) == 2
        
        # Verify first vote data
        assert data["data"][0]["id"] == 0
        assert data["data"][0]["ciphertext"] == test_ciphertext
        assert data["data"][0]["nonce"] == test_nonce
        assert data["data"][0]["decryption_time"] == test_decryption_time
        assert data["data"][0]["g2r"] == test_g2r
        
        # Verify second vote data
        assert data["data"][1]["id"] == 1
        assert data["data"][1]["ciphertext"] == "aabbccddeeff"
        assert data["data"][1]["nonce"] == "ffeeddccbbaa"
        assert data["data"][1]["decryption_time"] == test_decryption_time + 3600
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()
        assert mock_blockchain_service.contract.functions.getVote.call_count == 2
    
    async def test_get_all_votes_empty(self, client, mock_blockchain_service):
        """Test getting all votes when there are none."""
        # Setup mock
        mock_blockchain_service.contract.functions.voteCount().return_value.call.return_value = 0
        
        # Make request
        response = client.get("/api/votes")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved 0 votes" in data["message"]
        assert len(data["data"]) == 0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()
        mock_blockchain_service.contract.functions.getVote.assert_not_called()
    
    async def test_get_all_votes_error(self, client, mock_blockchain_service):
        """Test error handling when getting all votes."""
        # Setup mock to raise an exception
        mock_blockchain_service.contract.functions.voteCount().return_value.call.side_effect = Exception("Blockchain error")
        
        # Make request
        response = client.get("/api/votes")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get all votes: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()

# Tests for the GET /votes/{vote_id} endpoint
class TestGetVoteData:
    
    async def test_get_vote_data_success(self, client, mock_blockchain_service):
        """Test getting vote data by ID successfully."""
        # Setup mock
        vote_data = [
            bytes.fromhex(test_ciphertext),
            bytes.fromhex(test_nonce),
            test_decryption_time,
            [int(test_g2r[0]), int(test_g2r[1])],
            "Title",
            "Description",
            int(datetime.now().timestamp()),
            int((datetime.now() + timedelta(days=7)).timestamp()),
            "active",
            0,
            ["Option 1", "Option 2"],
            1000000000000000000,  # 1 ETH in Wei
            1000000000000000000   # 1 ETH in Wei
        ]
        mock_blockchain_service.contract.functions.getVote().return_value.call.return_value = vote_data
        mock_blockchain_service.w3.from_wei.return_value = 1.0
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert f"Successfully retrieved vote data for vote {test_vote_id}" in data["message"]
        assert data["data"]["id"] == test_vote_id
        assert data["data"]["ciphertext"] == test_ciphertext
        assert data["data"]["nonce"] == test_nonce
        assert data["data"]["decryption_time"] == test_decryption_time
        assert data["data"]["g2r"] == test_g2r
        assert data["data"]["title"] == "Title"
        assert data["data"]["description"] == "Description"
        assert data["data"]["status"] == "active"
        assert data["data"]["options"] == ["Option 1", "Option 2"]
        assert data["data"]["reward_pool"] == 1.0
        assert data["data"]["required_deposit"] == 1.0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()
    
    async def test_get_vote_data_not_found(self, client, mock_blockchain_service):
        """Test getting vote data for a non-existent vote."""
        # Setup mock to raise an exception
        mock_blockchain_service.contract.functions.getVote().return_value.call.side_effect = Exception("Vote not found")
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get vote data: Vote not found"
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()

# Tests for the GET /votes/status endpoint
class TestGetVoteStatus:
    
    async def test_get_vote_status_success(self, client, mock_blockchain_service):
        """Test getting vote status successfully."""
        # Setup mock
        mock_blockchain_service.contract.functions.voteCount().return_value.call.return_value = 5
        mock_blockchain_service.contract.functions.getVote().return_value.call.return_value = [
            bytes.fromhex(test_ciphertext),
            bytes.fromhex(test_nonce),
            test_decryption_time,
            [int(test_g2r[0]), int(test_g2r[1])],
            "Title",
            "active",
            0,
            ["Option 1", "Option 2"],
            1000000000000000000,  # 1 ETH in Wei
            1000000000000000000   # 1 ETH in Wei
        ]
        
        # Make request
        response = client.get("/api/votes/status")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved vote status" in data["message"]
        assert data["data"]["total_votes"] == 5
        assert data["data"]["active_votes"] == 5
        assert data["data"]["closed_votes"] == 0
        assert data["data"]["decrypted_votes"] == 0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()
        assert mock_blockchain_service.contract.functions.getVote.call_count == 5
    
    async def test_get_vote_status_error(self, client, mock_blockchain_service):
        """Test error handling when getting vote status."""
        # Setup mock to raise an exception
        mock_blockchain_service.contract.functions.voteCount().return_value.call.side_effect = Exception("Blockchain error")
        
        # Make request
        response = client.get("/api/votes/status")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get vote status: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()

# Tests for the POST /votes endpoint
class TestSubmitVote:
    
    async def test_submit_vote_success(self, client, mock_blockchain_service):
        """Test submitting a vote successfully."""
        # Setup mock
        mock_blockchain_service.submit_vote.return_value = {
            "success": True,
            "transaction_hash": "0x1234567890abcdef",
            "vote_id": test_vote_id
        }
        
        # Request data
        request_data = {
            "vote_data": test_vote_data,
            "decryption_time": test_decryption_time
        }
        
        # Make request
        response = client.post("/api/votes", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Vote submitted successfully" in data["message"]
        assert data["transaction_hash"] == "0x1234567890abcdef"
        
        # Verify mock calls
        mock_blockchain_service.submit_vote.assert_called_once_with(
            vote_data=test_vote_data.encode('utf-8'),
            decryption_time=test_decryption_time
        )
    
    async def test_submit_vote_past_decryption_time(self, client):
        """Test submitting a vote with a past decryption time."""
        # Request data with past decryption time
        request_data = {
            "vote_data": test_vote_data,
            "decryption_time": int(datetime.now().timestamp()) - 3600  # 1 hour ago
        }
        
        # Make request
        response = client.post("/api/votes", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Validation error: Decryption time must be in the future"
    
    async def test_submit_vote_error(self, client, mock_blockchain_service):
        """Test error handling when submitting a vote."""
        # Setup mock to return an error
        mock_blockchain_service.submit_vote.return_value = {
            "success": False,
            "error": "Transaction failed"
        }
        
        # Request data
        request_data = {
            "vote_data": test_vote_data,
            "decryption_time": test_decryption_time
        }
        
        # Make request
        response = client.post("/api/votes", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to submit vote: Transaction failed"
        
        # Verify mock calls
        mock_blockchain_service.submit_vote.assert_called_once_with(
            vote_data=test_vote_data.encode('utf-8'),
            decryption_time=test_decryption_time
        )

# Tests for the POST /votes/create endpoint
class TestCreateVote:
    
    async def test_create_vote_success(self, client, mock_blockchain_service):
        """Test creating a vote successfully."""
        # Setup mocks
        mock_blockchain_service.w3.eth.get_transaction_count.return_value = 1
        mock_blockchain_service.contract.functions.createVote().estimate_gas.return_value = 100000
        mock_blockchain_service.w3.eth.send_raw_transaction.return_value = bytes.fromhex("0x1234567890abcdef")
        
        # Request data
        request_data = {
            "title": "Test Vote",
            "description": "Test Description",
            "start_date": "2024-03-07T00:00:00",
            "end_date": "2024-03-14T00:00:00",
            "options": ["Option 1", "Option 2"],
            "reward_pool": 1.0,
            "required_deposit": 0.5
        }
        
        # Make request
        response = client.post("/api/votes/create", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Vote created successfully" in data["message"]
        assert data["transaction_hash"] == "0x1234567890abcdef"
        
        # Verify mock calls
        mock_blockchain_service.w3.eth.get_transaction_count.assert_called_once()
        mock_blockchain_service.contract.functions.createVote().estimate_gas.assert_called_once()
        mock_blockchain_service.w3.eth.send_raw_transaction.assert_called_once()
    
    async def test_create_vote_invalid_dates(self, client):
        """Test creating a vote with invalid dates."""
        # Request data with end date before start date
        request_data = {
            "title": "Test Vote",
            "description": "Test Description",
            "start_date": "2024-03-14T00:00:00",
            "end_date": "2024-03-07T00:00:00",
            "options": ["Option 1", "Option 2"],
            "reward_pool": 1.0,
            "required_deposit": 0.5
        }
        
        # Make request
        response = client.post("/api/votes/create", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_create_vote_invalid_options(self, client):
        """Test creating a vote with invalid options."""
        # Request data with empty options
        request_data = {
            "title": "Test Vote",
            "description": "Test Description",
            "start_date": "2024-03-07T00:00:00",
            "end_date": "2024-03-14T00:00:00",
            "options": [],
            "reward_pool": 1.0,
            "required_deposit": 0.5
        }
        
        # Make request
        response = client.post("/api/votes/create", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    async def test_create_vote_error(self, client, mock_blockchain_service):
        """Test error handling when creating a vote."""
        # Setup mock to raise an exception
        mock_blockchain_service.w3.eth.get_transaction_count.side_effect = Exception("Blockchain error")
        
        # Request data
        request_data = {
            "title": "Test Vote",
            "description": "Test Description",
            "start_date": "2024-03-07T00:00:00",
            "end_date": "2024-03-14T00:00:00",
            "options": ["Option 1", "Option 2"],
            "reward_pool": 1.0,
            "required_deposit": 0.5
        }
        
        # Make request
        response = client.post("/api/votes/create", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to create vote: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.w3.eth.get_transaction_count.assert_called_once()

# Tests for the POST /votes/tokens/{vote_id} endpoint
class TestGenerateToken:
    
    async def test_generate_token_success(self, client, mock_db):
        """Test generating a voting token successfully."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one.return_value = None  # Token doesn't exist
        mock_db.election_tokens.tokens.insert_one.return_value = None  # Successful insert
        
        # Make request
        response = client.post(f"/api/votes/tokens/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Token generated successfully" in data["message"]
        assert "token" in data["data"]
        assert len(data["data"]["token"]) == 8
        
        # Verify mock calls
        mock_db.election_tokens.tokens.insert_one.assert_called_once()
    
    async def test_generate_token_error(self, client, mock_db):
        """Test error handling when generating a token."""
        # Setup mock to raise an exception
        mock_db.election_tokens.tokens.insert_one.side_effect = Exception("Database error")
        
        # Make request
        response = client.post(f"/api/votes/tokens/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to generate token: Database error"
        
        # Verify mock calls
        mock_db.election_tokens.tokens.insert_one.assert_called_once()

# Tests for the GET /votes/tokens/validate endpoint
class TestValidateToken:
    
    async def test_validate_token_valid(self, client, mock_db):
        """Test validating a valid token."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one.return_value = {
            "token": "abc123",
            "used": 0,
            "vote_id": test_vote_id
        }
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "abc123"})
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["valid"] is True
        
        # Verify mock calls
        mock_db.election_tokens.tokens.find_one.assert_called_once_with({"token": "abc123"})
    
    async def test_validate_token_invalid(self, client, mock_db):
        """Test validating an invalid token."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one.return_value = None
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "invalid"})
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["valid"] is False
        
        # Verify mock calls
        mock_db.election_tokens.tokens.find_one.assert_called_once_with({"token": "invalid"})
    
    async def test_validate_token_error(self, client, mock_db):
        """Test error handling when validating a token."""
        # Setup mock to raise an exception
        mock_db.election_tokens.tokens.find_one.side_effect = Exception("Database error")
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "abc123"})
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to validate token: Database error"
        
        # Verify mock calls
        mock_db.election_tokens.tokens.find_one.assert_called_once_with({"token": "abc123"})

# Tests for the GET /votes/{vote_id}/shares endpoint
class TestGetShareStatus:
    
    async def test_get_share_status_success(self, client, mock_blockchain_service):
        """Test getting share status successfully."""
        # Setup mock
        mock_blockchain_service.get_share_status.return_value = {
            "total_holders": 3,
            "submitted_shares": 2,
            "missing_shares": 1,
            "holder_status": {
                "0x123": {
                    "submitted": True,
                    "valid": True
                },
                "0x456": {
                    "submitted": True,
                    "valid": False
                },
                "0x789": {
                    "submitted": False,
                    "valid": False
                }
            }
        }
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}/shares")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved share status" in data["message"]
        assert data["data"]["total_holders"] == 3
        assert data["data"]["submitted_shares"] == 2
        assert data["data"]["missing_shares"] == 1
        assert data["data"]["holders"] == {
            "0x123": {
                "submitted": True,
                "valid": True
            },
            "0x456": {
                "submitted": True,
                "valid": False
            },
            "0x789": {
                "submitted": False,
                "valid": False
            }
        }
        
        # Verify mock calls
        mock_blockchain_service.get_share_status.assert_called_once_with(test_vote_id)
    
    async def test_get_share_status_error(self, client, mock_blockchain_service):
        """Test error handling when getting share status."""
        # Setup mock to raise an exception
        mock_blockchain_service.get_share_status.side_effect = Exception("Blockchain error")
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}/shares")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to get share status: Blockchain error"
        
        # Verify mock calls
        mock_blockchain_service.get_share_status.assert_called_once_with(test_vote_id)

# Tests for the POST /votes/{vote_id}/decrypt endpoint
class TestDecryptVote:
    
    async def test_decrypt_vote_success(self, client, mock_blockchain_service):
        """Test decrypting a vote successfully."""
        # Setup mock
        mock_blockchain_service.decrypt_vote.return_value = {
            "success": True,
            "data": {
                "vote_data": "This is a secret ballot",
                "decryption_time": 1714521600,
                "shares_used": 3
            }
        }
        
        # Make request
        response = client.post(f"/api/votes/{test_vote_id}/decrypt")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Vote decrypted successfully" in data["message"]
        assert data["data"]["vote_id"] == test_vote_id
        assert data["data"]["vote_data"] == "This is a secret ballot"
        assert data["data"]["decryption_time"] == 1714521600
        assert data["data"]["shares_used"] == 3
        
        # Verify mock calls
        mock_blockchain_service.decrypt_vote.assert_called_once_with(test_vote_id)
    
    async def test_decrypt_vote_error(self, client, mock_blockchain_service):
        """Test error handling when decrypting a vote."""
        # Setup mock to return an error
        mock_blockchain_service.decrypt_vote.return_value = {
            "success": False,
            "error": "Decryption failed"
        }
        
        # Make request
        response = client.post(f"/api/votes/{test_vote_id}/decrypt")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert data["detail"] == "Failed to decrypt vote: Decryption failed"
        
        # Verify mock calls
        mock_blockchain_service.decrypt_vote.assert_called_once_with(test_vote_id) 
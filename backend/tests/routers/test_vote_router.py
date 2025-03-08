"""
Tests for the vote router.
"""
import pytest
from fastapi import status
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock

# Test data
test_vote_id = 1
test_vote_data = "This is a secret ballot"
test_decryption_time = int((datetime.now() + timedelta(days=1)).timestamp())  # Tomorrow
test_ciphertext = "0a1b2c3d4e5f"
test_nonce = "f5e4d3c2b1a0"
test_g2r = ["123456789", "987654321"]

# Tests for the GET /votes endpoint
class TestGetAllVotes:
    
    @pytest.mark.asyncio
    async def test_get_all_votes_success(self, client, mock_blockchain_service):
        """Test getting all votes successfully."""
        # Setup mocks for contract functions
        vote_count_mock = AsyncMock()
        vote_count_mock.call = AsyncMock(return_value=2)
        mock_blockchain_service.contract.functions.voteCount = MagicMock(return_value=vote_count_mock)
        
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
        
        # Setup mock for getVote function
        def get_vote_side_effect(vote_id):
            get_vote_mock = AsyncMock()
            if vote_id == 0:
                get_vote_mock.call = AsyncMock(return_value=vote_data1)
            else:
                get_vote_mock.call = AsyncMock(return_value=vote_data2)
            return get_vote_mock
        
        mock_blockchain_service.contract.functions.getVote = MagicMock(side_effect=get_vote_side_effect)
        
        # Make request
        response = client.get("/api/votes/")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved 2 votes" in data["message"]
        assert len(data["data"]) == 2
        assert data["data"][0]["vote_id"] == 0
        assert data["data"][0]["ciphertext"] == test_ciphertext
        assert data["data"][0]["nonce"] == test_nonce
        assert data["data"][1]["vote_id"] == 1
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()
        assert mock_blockchain_service.contract.functions.getVote.call_count == 2
    
    @pytest.mark.asyncio
    async def test_get_all_votes_empty(self, client, mock_blockchain_service):
        """Test getting all votes when there are none."""
        # Setup mock
        vote_count_mock = AsyncMock()
        vote_count_mock.call = AsyncMock(return_value=0)
        mock_blockchain_service.contract.functions.voteCount = MagicMock(return_value=vote_count_mock)
        
        # Make request
        response = client.get("/api/votes/")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved 0 votes" in data["message"]
        assert len(data["data"]) == 0
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()
        mock_blockchain_service.contract.functions.getVote.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_get_all_votes_error(self, client, mock_blockchain_service):
        """Test error handling when getting all votes."""
        # Setup mock to raise an exception
        vote_count_mock = AsyncMock()
        vote_count_mock.call = AsyncMock(side_effect=Exception("Blockchain error"))
        mock_blockchain_service.contract.functions.voteCount = MagicMock(return_value=vote_count_mock)
        
        # Make request
        response = client.get("/api/votes/")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.voteCount.assert_called_once()

# Tests for the GET /votes/{vote_id} endpoint
class TestGetVoteData:
    
    @pytest.mark.asyncio
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
        
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(return_value=vote_data)
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved vote" in data["message"]
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
    
    @pytest.mark.asyncio
    async def test_get_vote_data_not_found(self, client, mock_blockchain_service):
        """Test getting vote data for a non-existent vote."""
        # Setup mock to raise an exception
        get_vote_mock = AsyncMock()
        get_vote_mock.call = AsyncMock(side_effect=Exception("Vote not found"))
        mock_blockchain_service.contract.functions.getVote = MagicMock(return_value=get_vote_mock)
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Vote not found" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.contract.functions.getVote.assert_called_once()

# Tests for the GET /votes/summary endpoint
class TestGetVoteSummary:
    
    @pytest.mark.asyncio
    async def test_get_vote_summary_success(self, client, mock_blockchain_service):
        """Test getting vote summary successfully."""
        # Setup mock for vote count
        vote_count_mock = AsyncMock()
        vote_count_mock.call = AsyncMock(return_value=5)
        mock_blockchain_service.contract.functions.voteCount = MagicMock(return_value=vote_count_mock)
        
        # Setup mock for getVote function to return different statuses
        def get_vote_side_effect(vote_id):
            get_vote_mock = AsyncMock()
            # Return different statuses for different vote IDs
            if vote_id < 2:
                # First 2 votes are active
                vote_data = [b'', b'', 0, [], '', '', '', '', 'active']
            elif vote_id < 4:
                # Next 2 votes are closed
                vote_data = [b'', b'', 0, [], '', '', '', '', 'closed']
            else:
                # Last vote is decrypted
                vote_data = [b'', b'', 0, [], '', '', '', '', 'decrypted']
            
            get_vote_mock.call = AsyncMock(return_value=vote_data)
            return get_vote_mock
        
        mock_blockchain_service.contract.functions.getVote = MagicMock(side_effect=get_vote_side_effect)
        
        # Make request
        response = client.get("/api/votes/summary")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully retrieved vote summary" in data["message"]
        assert data["data"]["total_votes"] == 5
        assert data["data"]["active_votes"] == 2
        assert data["data"]["closed_votes"] == 2
        assert data["data"]["decrypted_votes"] == 1
    
    @pytest.mark.asyncio
    async def test_get_vote_summary_error(self, client, mock_blockchain_service):
        """Test error handling when getting vote summary."""
        # Setup mock to raise an exception
        vote_count_mock = AsyncMock()
        vote_count_mock.call = AsyncMock(side_effect=Exception("Blockchain error"))
        mock_blockchain_service.contract.functions.voteCount = MagicMock(return_value=vote_count_mock)
        
        # Make request
        response = client.get("/api/votes/summary")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]

# Tests for the POST /votes endpoint
class TestSubmitVote:
    
    @pytest.mark.asyncio
    async def test_submit_vote_success(self, client, mock_blockchain_service):
        """Test submitting a vote successfully."""
        # Setup mock
        mock_blockchain_service.submit_vote = AsyncMock(return_value={
            "success": True,
            "message": "Successfully submitted vote",
            "transaction_hash": "0x1234567890abcdef",
            "vote_id": test_vote_id
        })
        
        # Request data
        request_data = {
            "vote_data": test_vote_data,
            "decryption_time": test_decryption_time,
            "reward_amount": 0.1  # Explicitly set reward_amount to match the default
        }
        
        # Make request
        response = client.post("/api/votes", json=request_data)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Successfully submitted vote" in data["message"]
        assert data["data"]["transaction_hash"] == "0x1234567890abcdef"
        assert data["data"]["vote_id"] == test_vote_id
        
        # Verify mock calls
        mock_blockchain_service.submit_vote.assert_called_once_with(
            test_vote_data, test_decryption_time, 0.1, None
        )
    
    @pytest.mark.asyncio
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
        assert data["detail"] == "Decryption time must be in the future"
    
    @pytest.mark.asyncio
    async def test_submit_vote_error(self, client, mock_blockchain_service):
        """Test error handling when submitting a vote."""
        # Setup mock to return an error
        mock_blockchain_service.submit_vote = AsyncMock(return_value={
            "success": False,
            "error": "Transaction failed"
        })
        
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
        assert "Transaction failed" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.submit_vote.assert_called_once_with(
            test_vote_data, test_decryption_time, 0.1, None
        )

# Tests for the POST /votes/create endpoint
class TestCreateVote:
    
    @pytest.mark.asyncio
    async def test_create_vote_success(self, client, mock_blockchain_service):
        """Test creating a vote successfully."""
        # Setup mocks
        mock_blockchain_service.w3.eth.get_transaction_count = MagicMock(return_value=1)
        
        # Mock contract function
        create_vote_mock = AsyncMock()
        create_vote_mock.estimate_gas = MagicMock(return_value=100000)
        create_vote_mock.build_transaction = MagicMock(return_value={
            "to": "0x1234567890abcdef",
            "data": "0x1234567890abcdef",
            "gas": 100000,
            "gasPrice": 20000000000,
            "nonce": 1
        })
        mock_blockchain_service.contract.functions.createVote = MagicMock(return_value=create_vote_mock)
        
        # Mock transaction signing and sending
        mock_blockchain_service.w3.eth.account.sign_transaction = MagicMock(return_value=MagicMock(rawTransaction=b'0x1234'))
        mock_blockchain_service.w3.eth.send_raw_transaction = MagicMock(return_value=b'0x1234567890abcdef')
        
        # Ensure tx_hash.hex() works by mocking it
        tx_hash_mock = MagicMock()
        tx_hash_mock.hex.return_value = "0x1234567890abcdef"
        mock_blockchain_service.w3.eth.send_raw_transaction = MagicMock(return_value=tx_hash_mock)
        
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
        assert "Successfully created vote" in data["message"]
        assert data["data"]["transaction_hash"] == "0x1234567890abcdef"
    
    @pytest.mark.asyncio
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
        data = response.json()
        assert "End date must be after start date" in str(data["detail"])
    
    @pytest.mark.asyncio
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
        data = response.json()
        assert "too_short" in str(data["detail"])
        assert "List should have at least 2 items" in str(data["detail"])
    
    @pytest.mark.asyncio
    async def test_create_vote_error(self, client, mock_blockchain_service):
        """Test error handling when creating a vote."""
        # Setup mock to raise an exception
        mock_blockchain_service.w3.eth.get_transaction_count = MagicMock(side_effect=Exception("Blockchain error"))
        
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
        assert "Blockchain error" in data["detail"]

# Tests for the POST /votes/tokens/{vote_id} endpoint
class TestGenerateToken:
    
    @pytest.mark.asyncio
    async def test_generate_token_success(self, client, mock_db):
        """Test generating a voting token successfully."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one = AsyncMock(return_value=None)  # Token doesn't exist
        mock_db.election_tokens.tokens.insert_one = AsyncMock(return_value=None)  # Successful insert
        
        # Make request
        response = client.post(f"/api/votes/tokens/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Token generated successfully" in data["message"]
        assert "token" in data["data"]
        assert data["data"]["vote_id"] == test_vote_id
    
    @pytest.mark.asyncio
    async def test_generate_token_error(self, client, mock_db):
        """Test error handling when generating a token."""
        # Setup mock to raise an exception
        mock_db.election_tokens.tokens.find_one = AsyncMock(return_value=None)
        mock_db.election_tokens.tokens.insert_one = AsyncMock(side_effect=Exception("Database error"))
        
        # Make request
        response = client.post(f"/api/votes/tokens/{test_vote_id}")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Database error" in data["detail"]

# Tests for the GET /votes/tokens/validate endpoint
class TestValidateToken:
    
    @pytest.mark.asyncio
    async def test_validate_token_valid(self, client, mock_db):
        """Test validating a valid token."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one = AsyncMock(return_value={
            "token": "abc123",
            "used": 0,
            "vote_id": test_vote_id
        })
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "abc123"})
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Token is valid" in data["message"]
        assert data["data"]["valid"] is True
        assert data["data"]["vote_id"] == test_vote_id
    
    @pytest.mark.asyncio
    async def test_validate_token_invalid(self, client, mock_db):
        """Test validating an invalid token."""
        # Setup mock
        mock_db.election_tokens.tokens.find_one = AsyncMock(return_value=None)
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "invalid"})
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Token is invalid" in data["message"]
        assert data["data"]["valid"] is False
    
    @pytest.mark.asyncio
    async def test_validate_token_error(self, client, mock_db):
        """Test error handling when validating a token."""
        # Setup mock to raise an exception
        mock_db.election_tokens.tokens.find_one = AsyncMock(side_effect=Exception("Database error"))
        
        # Make request
        response = client.get("/api/votes/tokens/validate", params={"token": "abc123"})
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Database error" in data["detail"]

# Tests for the GET /votes/{vote_id}/shares endpoint
class TestGetShareStatus:
    
    @pytest.mark.asyncio
    async def test_get_share_status_success(self, client, mock_blockchain_service):
        """Test getting share status successfully."""
        # Setup mock
        mock_blockchain_service.get_share_status = AsyncMock(return_value={
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
        })
        
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
        assert len(data["data"]["holder_status"]) == 3
        assert data["data"]["holder_status"]["0x123"]["submitted"] is True
        assert data["data"]["holder_status"]["0x123"]["valid"] is True
        
        # Verify mock calls
        mock_blockchain_service.get_share_status.assert_called_once_with(test_vote_id)
    
    @pytest.mark.asyncio
    async def test_get_share_status_error(self, client, mock_blockchain_service):
        """Test error handling when getting share status."""
        # Setup mock to raise an exception
        mock_blockchain_service.get_share_status = AsyncMock(side_effect=Exception("Blockchain error"))
        
        # Make request
        response = client.get(f"/api/votes/{test_vote_id}/shares")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Blockchain error" in data["detail"]

# Tests for the POST /votes/{vote_id}/decrypt endpoint
class TestDecryptVote:
    
    @pytest.mark.asyncio
    async def test_decrypt_vote_success(self, client, mock_blockchain_service):
        """Test decrypting a vote successfully."""
        # Setup mock
        mock_blockchain_service.decrypt_vote = AsyncMock(return_value={
            "success": True,
            "data": {
                "vote_data": "This is a secret ballot",
                "decryption_time": 1714521600,
                "shares_used": 3,
                "threshold": 2
            }
        })
        
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
        assert data["data"]["threshold"] == 2
        
        # Verify mock calls
        mock_blockchain_service.decrypt_vote.assert_called_once_with(test_vote_id, None)
    
    @pytest.mark.asyncio
    async def test_decrypt_vote_error(self, client, mock_blockchain_service):
        """Test error handling when decrypting a vote."""
        # Setup mock to return an error
        mock_blockchain_service.decrypt_vote = AsyncMock(return_value={
            "success": False,
            "error": "Decryption failed"
        })
        
        # Make request
        response = client.post(f"/api/votes/{test_vote_id}/decrypt")
        
        # Assertions
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data = response.json()
        assert "Decryption failed" in data["detail"]
        
        # Verify mock calls
        mock_blockchain_service.decrypt_vote.assert_called_once_with(test_vote_id, None) 
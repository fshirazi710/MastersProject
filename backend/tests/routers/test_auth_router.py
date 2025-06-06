"""
Tests for the authentication router.
"""
import pytest
from fastapi import status
import json
import bcrypt
from datetime import datetime
from unittest.mock import MagicMock

# Test data
test_user = {
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPassword123",
    "role": "voter"
}

# Tests for the /auth/register endpoint
class TestRegister:
    
    @pytest.mark.asyncio
    async def test_register_success(self, client, mock_db):
        """Test successful user registration."""
        # Setup mock
        mock_db.users.find_one.return_value = None  # User doesn't exist
        insert_result = MagicMock()
        insert_result.inserted_id = "test_id"
        mock_db.users.insert_one.return_value = insert_result  # Mock insert result with ID
        
        # Make request
        response = client.post("/api/auth/register", json=test_user)
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "User registered successfully" in data["message"]
        assert data["data"]["email"] == test_user["email"]
        
        # Verify mock calls
        mock_db.users.find_one.assert_called_once_with({"email": test_user["email"]})
        mock_db.users.insert_one.assert_called_once()
        
        # Verify password was hashed
        call_args = mock_db.users.insert_one.call_args[0][0]
        assert "hashed_password" in call_args
        assert call_args["hashed_password"] != test_user["password"]
        assert call_args["email"] == test_user["email"]
    
    @pytest.mark.asyncio
    async def test_register_existing_user(self, client, mock_db):
        """Test registration with an existing email."""
        # Setup mock to return an existing user
        mock_db.users.find_one.return_value = {
            "email": test_user["email"],
            "name": "Existing User"
        }
        
        # Make request
        response = client.post("/api/auth/register", json=test_user)
        
        # Assertions
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Email already registered" in data["detail"]
        
        # Verify mock calls
        mock_db.users.find_one.assert_called_once_with({"email": test_user["email"]})
        mock_db.users.insert_one.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_register_invalid_data(self, client):
        """Test registration with invalid data."""
        # Test with missing fields
        response = client.post("/api/auth/register", json={"email": "test@example.com"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid email
        invalid_user = test_user.copy()
        invalid_user["email"] = "invalid-email"
        response = client.post("/api/auth/register", json=invalid_user)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with short password
        invalid_user = test_user.copy()
        invalid_user["password"] = "short"
        response = client.post("/api/auth/register", json=invalid_user)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid role
        invalid_user = test_user.copy()
        invalid_user["role"] = "invalid-role"
        response = client.post("/api/auth/register", json=invalid_user)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

# Tests for the /auth/login endpoint
class TestLogin:
    
    @pytest.mark.asyncio
    async def test_login_success(self, client, mock_db):
        """Test successful login."""
        # Hash the password as it would be stored in the database
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(test_user["password"].encode('utf-8'), salt).decode('utf-8')
        
        # Setup mock to return a user
        mock_db.users.find_one.return_value = {
            "email": test_user["email"],
            "name": test_user["name"],
            "hashed_password": hashed_password,
            "role": test_user["role"]
        }
        
        # Make request with form data
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user["email"],
                "password": test_user["password"]
            }
        )
        
        # Assertions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "Login successful" in data["message"]
        assert "token" in data["data"]
        assert "expires_at" in data["data"]
        assert isinstance(data["data"]["token"], str)
        assert len(data["data"]["token"]) > 0
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client, mock_db):
        """Test login with invalid credentials."""
        # Setup mock to return None (user not found)
        mock_db.users.find_one.return_value = None
        
        # Make request with form data
        response = client.post(
            "/api/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "wrongpassword"
            }
        )
        
        # Assertions
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Invalid credentials" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, mock_db):
        """Test login with wrong password."""
        # Hash a different password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw("WrongPassword123".encode('utf-8'), salt).decode('utf-8')
        
        # Setup mock to return a user with different password
        mock_db.users.find_one.return_value = {
            "email": test_user["email"],
            "name": test_user["name"],
            "hashed_password": hashed_password,
            "role": test_user["role"]
        }
        
        # Make request with form data
        response = client.post(
            "/api/auth/login",
            data={
                "username": test_user["email"],
                "password": test_user["password"]
            }
        )
        
        # Assertions
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Invalid credentials" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_login_invalid_data(self, client):
        """Test login with invalid data."""
        # Test with missing fields
        response = client.post("/api/auth/login", json={"email": "test@example.com"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with invalid email
        response = client.post("/api/auth/login", json={
            "email": "invalid-email",
            "password": "password123"
        })
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY 
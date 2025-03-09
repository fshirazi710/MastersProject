# Backend Routers Documentation

This document provides documentation for all API routers in the backend application.

## Table of Contents

1. [Authentication Router](#authentication-router)
2. [Vote Router](#vote-router)
3. [Holder Router](#holder-router)
4. [Token Router](#token-router)

## Authentication Router

Base path: `/api/auth`

### Endpoints

#### POST /register
Register a new user in the system.

**Request:**
```json
{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "SecureP@ssw0rd",
    "role": "voter"
}
```

**Response:**
```json
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "voter"
    }
}
```

**Validation:**
- `name`: 2-100 characters
- `email`: Valid email format
- `password`: Min 8 chars, must contain uppercase, lowercase, number
- `role`: "admin", "voter", or "holder"

#### POST /login
Authenticate user and get JWT token.

**Request (Form Data):**
```
username: john.doe@example.com
password: SecureP@ssw0rd
```

**Response:**
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "eyJhbGciOiJIUzI1...",
        "expires_at": "2024-03-08T13:00:00Z"
    }
}
```

### Error Responses

- `400`: Email exists / Invalid credentials
- `422`: Invalid input data
- `500`: Database error

## Vote Router

Base path: `/api/votes`

### Endpoints

#### GET /
Get all votes from the blockchain.

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved 2 votes",
    "data": [
        {
            "vote_id": 0,
            "ciphertext": "0a1b2c3d4e5f",
            "nonce": "f5e4d3c2b1a0",
            "decryption_time": 1714521600,
            "g2r": ["123456789", "987654321"]
        },
        {
            "vote_id": 1,
            "ciphertext": "aabbccddeeff",
            "nonce": "ffeeddccbbaa",
            "decryption_time": 1714525200,
            "g2r": ["123456790", "987654322"]
        }
    ]
}
```

#### GET /summary
Get a summary of all votes including counts by status.

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved vote summary",
    "data": {
        "total_votes": 5,
        "active_votes": 2,
        "closed_votes": 2,
        "decrypted_votes": 1
    }
}
```

#### GET /{vote_id}
Get detailed information about a specific vote.

**Parameters:**
- `vote_id`: ID of the vote to retrieve

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved vote data for vote 1",
    "data": {
        "id": 1,
        "ciphertext": "0a1b2c3d4e5f",
        "nonce": "f5e4d3c2b1a0",
        "decryption_time": 1714521600,
        "g2r": ["123456789", "987654321"],
        "title": "Presidential Election 2024",
        "description": "Vote for the next president",
        "start_date": "2024-03-01T12:00:00",
        "end_date": "2024-03-15T12:00:00",
        "status": "active",
        "participant_count": 0,
        "options": ["Candidate A", "Candidate B"],
        "reward_pool": 1.0,
        "required_deposit": 0.5
    }
}
```

#### POST /
Submit an encrypted vote to the blockchain.

**Request:**
```json
{
    "vote_data": "This is a secret ballot",
    "decryption_time": 1714521600,
    "reward_amount": 0.1,
    "threshold": 3
}
```

**Response:**
```json
{
    "success": true,
    "message": "Successfully submitted vote",
    "data": {
        "success": true,
        "message": "Successfully submitted vote",
        "transaction_hash": "0x1234567890abcdef",
        "vote_id": 1
    }
}
```

**Validation:**
- `vote_data`: Non-empty string
- `decryption_time`: Unix timestamp in the future
- `reward_amount`: Optional positive float (default: 0.1 ETH)
- `threshold`: Optional integer ≥ 2 (default: 2/3 of holders)

#### POST /create
Create a new vote with options and parameters.

**Request:**
```json
{
    "title": "Presidential Election 2024",
    "description": "Vote for the next president",
    "start_date": "2024-03-01T12:00:00",
    "end_date": "2024-03-15T12:00:00",
    "options": ["Candidate A", "Candidate B"],
    "reward_pool": 1.0,
    "required_deposit": 0.5
}
```

**Response:**
```json
{
    "success": true,
    "message": "Successfully created vote",
    "data": {
        "success": true,
        "message": "Successfully created vote",
        "transaction_hash": "0x1234567890abcdef"
    }
}
```

**Validation:**
- `title`: 3-100 characters
- `description`: 10-1000 characters
- `start_date`: ISO format date string
- `end_date`: ISO format date string (must be after start_date)
- `options`: List of at least 2 options
- `reward_pool`: Positive float (ETH amount)
- `required_deposit`: Positive float (ETH amount)

#### POST /tokens/{vote_id}
Generate a voting token for a specific vote.

**Parameters:**
- `vote_id`: ID of the vote

**Response:**
```json
{
    "success": true,
    "message": "Token generated successfully",
    "data": {
        "token": "A1B2C3D4",
        "vote_id": 1
    }
}
```

#### GET /tokens/validate
Validate a voting token.

**Parameters:**
- `token`: Token string to validate

**Response:**
```json
{
    "success": true,
    "message": "Token is valid",
    "data": {
        "valid": true,
        "vote_id": 1
    }
}
```

#### GET /{vote_id}/shares
Get the status of share submissions for a vote.

**Parameters:**
- `vote_id`: ID of the vote

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved share status",
    "data": {
        "total_holders": 3,
        "submitted_shares": 2,
        "missing_shares": 1,
        "holder_status": {
            "0x123": {"submitted": true, "valid": true},
            "0x456": {"submitted": true, "valid": false},
            "0x789": {"submitted": false, "valid": false}
        }
    }
}
```

#### POST /{vote_id}/decrypt
Decrypt a vote using submitted shares.

**Parameters:**
- `vote_id`: ID of the vote

**Request (Optional):**
```json
{
    "threshold": 3
}
```

**Response:**
```json
{
    "success": true,
    "message": "Vote decrypted successfully",
    "data": {
        "vote_id": 1,
        "vote_data": "This is a secret ballot",
        "decryption_time": 1714521600,
        "shares_used": 3,
        "threshold": 2
    }
}
```

### Error Responses

- `400`: Validation error (e.g., decryption time in the past)
- `422`: Invalid input data
- `500`: Blockchain interaction error

## Holder Router

Base path: `/api/holders`

### Endpoints

#### GET /
Get all registered secret holders.

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved holders",
    "data": [
        {
            "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "public_key": [123456789, 987654321],
            "active": true
        }
    ]
}
```

#### GET /count
Get the total number of registered holders.

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved holder count",
    "data": {
        "count": 3
    }
}
```

#### GET /status/{address}
Check if an address is a registered holder.

**Parameters:**
- `address`: Ethereum address to check

**Response:**
```json
{
    "success": true,
    "message": "Address is a holder",
    "data": {
        "is_holder": true
    }
}
```

#### GET /deposit
Get the required deposit amount to become a holder.

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved required deposit",
    "data": {
        "required_deposit": 1.0
    }
}
```

#### POST /join
Join as a secret holder by providing public key and deposit.

**Request:**
```json
{
    "public_key": [123456789, 987654321],
    "deposit_amount": 1.0
}
```

**Response:**
```json
{
    "success": true,
    "message": "Successfully joined as holder",
    "data": {
        "success": true,
        "message": "Successfully joined as holder",
        "transaction_hash": "0x1234567890abcdef"
    }
}
```

**Validation:**
- `public_key`: List of exactly 2 integers
- `deposit_amount`: Positive float matching the required deposit amount

### Error Responses

- `422`: Invalid input data (e.g., invalid public key format)
- `500`: Blockchain interaction error

## Share Router

Base path: `/api/shares`

### Endpoints

#### POST /
Submit a share for a vote.

**Request:**
```json
{
    "vote_id": 1,
    "share_index": 2,
    "share_value": 123456789
}
```

**Response:**
```json
{
    "success": true,
    "message": "Share submitted successfully",
    "data": {
        "success": true,
        "message": "Share submitted successfully",
        "transaction_hash": "0x1234567890abcdef"
    }
}
```

**Validation:**
- `vote_id`: Positive integer
- `share_index`: Positive integer (> 0)
- `share_value`: Integer

#### POST /verify
Verify a share submission.

**Request:**
```json
{
    "vote_id": 1,
    "holder_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "share": [2, 123456789]
}
```

**Response:**
```json
{
    "success": true,
    "message": "Share verification successful",
    "data": {
        "valid": true,
        "holder_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "vote_id": 1
    }
}
```

#### GET /by-vote/{vote_id}
Get all submitted shares for a specific vote.

**Parameters:**
- `vote_id`: ID of the vote

**Response:**
```json
{
    "success": true,
    "message": "Successfully retrieved 2 submitted shares for vote 1",
    "data": {
        "vote_id": 1,
        "submitted_shares": [
            {
                "holder_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "share_index": 1,
                "share_value": 123456789
            },
            {
                "holder_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "share_index": 2,
                "share_value": 987654321
            }
        ],
        "count": 2
    }
}
```

### Error Responses

- `404`: Vote not found
- `422`: Invalid input data
- `500`: Blockchain interaction error
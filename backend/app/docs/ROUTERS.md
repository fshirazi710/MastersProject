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

*Coming soon*

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

*Coming soon* 
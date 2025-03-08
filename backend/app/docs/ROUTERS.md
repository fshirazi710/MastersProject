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

*Coming soon*

## Share Router

*Coming soon* 
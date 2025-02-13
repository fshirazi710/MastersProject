# Timed Release Crypto System Backend

FastAPI backend server for the Timed Release Crypto System. This service manages blockchain interactions, cryptographic operations, and provides API endpoints for the frontend.

## Architecture

This backend service:
- Handles all blockchain interactions through Web3
- Implements cryptographic protocols from crypto-core
- Provides RESTful API endpoints for the frontend
- Manages database operations for message persistence
- Coordinates with blockchain agents

## Core Features
- Smart contract interaction service
- Message encryption/decryption service
- Agent coordination service
- Database management
- Authentication and authorization
- API endpoint handlers

## API Endpoints

### Messages
```
POST /api/messages
- Submit new time-locked message
- Handles encryption and blockchain transaction

GET /api/messages
- Retrieve message history
- Includes status and decryption time

GET /api/messages/{id}
- Get specific message details
- Includes share holders and status
```

### Agents
```
GET /api/agents
- List all registered agents
- Includes status and public keys

GET /api/agents/{id}/status
- Get specific agent status
- Includes current shares and availability
```

## Setup and Development

### Prerequisites
- Python 3.9+
- PostgreSQL
- Ethereum node access (or similar blockchain)

### Installation
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables
Create a `.env` file:
```
# Database
DATABASE_URL=postgresql://user:password@localhost/dbname

# Blockchain
CONTRACT_ADDRESS=your_contract_address
API_URL=your_blockchain_rpc_url
PRIVATE_KEY=your_service_private_key

# Security
SECRET_KEY=your_secret_key
```

### Project Structure
```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── secret_holders.py    # From secret_holder_router.py
│   │   │   │   ├── elections.py         # From vote_router.py
│   │   │   │   └── health.py
│   │   │   └── router.py
│   │   └── deps.py
│   ├── core/
│   │   ├── config.py                    # Enhanced version of constants.py
│   │   ├── security.py
│   │   └── blockchain.py                # From services/blockchain.py
│   ├── db/
│   │   ├── session.py
│   │   └── base.py
│   ├── models/                          # Database models
│   │   ├── election.py                  # Enhanced from vote.py
│   │   ├── secret_holder.py
│   │   └── vote.py
│   ├── schemas/                         # Pydantic models
│   │   ├── election.py
│   │   ├── secret_holder.py
│   │   └── vote.py
│   └── services/
│       ├── blockchain.py
│       ├── crypto.py
│       └── election.py
├── alembic/
│   └── versions/
├── tests/
│   ├── api/
│   ├── services/
│   └── conftest.py
└── main.py
```

### Running the Server
```bash
# Development
uvicorn src.main:app --reload

# Production
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Database Schema

### Messages Table
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content BYTEA NOT NULL,
    decryption_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_hash VARCHAR(66),
    sender_address VARCHAR(42)
);
```

### Agents Table
```sql
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    public_key VARCHAR(132) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_seen TIMESTAMP
);
```

## Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src
```

## Integration with crypto-core

This backend implements the client functionality from `crypto-core/client-script` for message submission and the agent monitoring logic from `crypto-core/agent-script` for status updates.

### Key Integrations:
1. Smart Contract Interaction
   - Contract deployment verification
   - Event listening and processing
   - Transaction submission

2. Cryptographic Operations
   - Message encryption using BLS12-381
   - Share generation and verification
   - Time-lock enforcement

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

Detailed error responses include:
```json
{
    "error": "string",
    "detail": "string",
    "timestamp": "string"
}
```

## Monitoring and Logging

The service includes:
- Prometheus metrics endpoint (/metrics)
- Structured logging with correlation IDs
- Health check endpoint (/health)
- Transaction monitoring

## Security Considerations

1. Authentication using JWT tokens
2. Rate limiting on all endpoints
3. Input validation and sanitization
4. Secure key storage and management
5. CORS configuration
6. Request signing for blockchain transactions

## Contributing

[Add contribution guidelines here]

## License

[Add license information here]

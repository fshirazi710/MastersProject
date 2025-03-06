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
- Python 3.12.9
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
Create a `api.ini` file:
```
[API]
API_STR = /api/v1
PROJECT_NAME = YOUR_PROJECT_NAME

[CORS]
CORS_ALLOWED_ORIGINS = http://localhost:3000

[DATABASE]
DATABASE_URL = postgresql://user:password@localhost/dbname

[BLOCKCHAIN]
WEB3_PROVIDER_URL = https://eth-sepolia.g.alchemy.com/v2/your-api-key-here
CONTRACT_ADDRESS = 0xYourContractAddressHere
WALLET_ADDRESS = 0xYourWalletAddressHere
CONTRACT_ABI = YOUR_CONTRACT_ABI
PRIVATE_KEY = YOUR_PRIVATE_KEY_HERE

[SECURITY]
SECRET_KEY = your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES = 30

[JWT]
JWT_SECRET_KEY = secret_key
ALGORITHM = HS256
```

### Database
To view records stored in the database:
1. Download and install MongoDB Compass from the official website
2. You will need the MongoDB connection string (URI). This is typically in the format: 
    - mongodb://<username>:<password>@<host>:<port>/<database>
3. Connect with Compass:
    - Open MongoDB Compass
    - Paste the connection string in the "Connection String" field
    - Click "Connect"

### Project Structure
```
backend/
├── app/
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
│   ├── routers/                         # API route definitions for handling requests
│   │   ├── election.py                  
│   │   ├── secret_holder.py
│   │   └── vote.py
│   ├── schemas/                         
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
├── main.py
├── api.ini
├── api.ini.example
└── requirements.txt
```

### Running the Server
```bash
# Development
uvicorn main:app --reload

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
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
pytest --cov=app.services

# Run tests with visualization (showing print statements)
pytest -v -s

# Run specific test files with visualization
pytest tests/test_crypto.py -v -s
pytest tests/test_blockchain.py -v -s
```

### Test Visualization

The test suite includes detailed print statements that help visualize the cryptographic and blockchain operations. To see these visualizations, run the tests with the `-s` flag, which prevents pytest from capturing stdout.

#### Crypto Visualizations

The crypto tests visualize:
- **BLS12-381 Keypair Generation**: Shows the generated private and public keys
- **Secret Sharing**: Displays the original secret, generated shares, and reconstructed secret
- **Vote Encryption/Decryption**: Shows the original vote data, encryption key, ciphertext, nonce, and decrypted data
- **Share Verification**: Demonstrates the verification of valid and invalid shares
- **Hash to Scalar**: Shows the input data, resulting scalar, and confirms deterministic behavior

Example output:
```
=== Secret Sharing and Reconstruction ===
Original Secret: 3407277151969687427993513947276512868709236181037768246516745884605547301407

Generated 10 shares with threshold 7:
Share 1: (index=1, value=18915560937742515382476943012473562333820395148850261083649375633660862896216)
Share 2: (index=2, value=15515710921721009832801701128661790120181528810606231936518355004584857234394)
...

Reconstructed Secret (using all 10 shares): 3407277151969687427993513947276512868709236181037768246516745884605547301407
Reconstruction successful: True
```

#### Blockchain Visualizations

The blockchain tests visualize:
- **Join as Holder**: Shows the deposit amount, transaction details, and result
- **Vote Submission**: Displays the vote data, encryption, share generation, and transaction result
- **Share Verification**: Shows the verification process for submitted shares
- **Share Status**: Displays the status of all shares for a vote
- **Error Handling**: Demonstrates how errors are handled during transactions

Example output:
```
=== Test: Vote Submission ===
Vote Data: Test vote: This is a confidential ballot
Decryption Time: 1234567890 (Unix timestamp)
Number of Holders: 10

Mocked Cryptographic Operations:
Encrypted Vote: 656e63727970746564
Nonce: 6e6f6e6365
Generated Shares: [(1, 100), (2, 200)]

Result:
Success: True
Transaction Hash: 0101010101010101010101010101010101010101010101010101010101010101
Vote ID: 1
```

These visualizations help developers and testers understand the flow of data through the system and verify that cryptographic operations are working as expected.

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

## Changes Made and Why:
# Made a new branch just to make sure that I didn't remove anything vital from the changes Luke had made

1. Removed api/ and its contents
    - This was confusing to look at, as it seemed the code within was redundant when looking at the rest of the codebase.
2. Modified Main.py
    - Previously the routing was handled in api/.
    - I believe the routing itslef should be handled directly within Main.py.
3. Using a .ini file, instead of a .env file.
    - This allows us to create a more structured configuration file.
    - This was the approach used by the development team the worked with FastAPI at my placement.
    - The .ini file shouldn't be pushed to github.
    - The .ini.example file can be pushed, and should be used as a skeleton file to create your own .ini file.
4. Modified the config.py file in core/
    - To use the .ini file as the configuration file.

# After making these modifications, the backend is back to running.

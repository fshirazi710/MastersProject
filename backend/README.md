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
- Python 3.12.*
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
│   │   ├── config.py                    # Application configuration
│   │   ├── dependencies.py              # Dependency injection
│   │   ├── error_handling.py            # Standardized error handling
│   │   ├── security.py                  # Authentication and authorization
│   │   └── mongodb.py                   # Database connection
│   ├── db/
│   │   ├── session.py                   # Database session management
│   │   └── base.py                      # Base model class
│   ├── models/                          # Database models (SQLAlchemy)
│   │   ├── user_model.py                # User database model
│   │   ├── vote_model.py                # Vote and token database models
│   │   └── holder_model.py              # Secret holder and share database models
│   ├── routers/                         # API route definitions
│   │   ├── auth_router.py               # Authentication endpoints
│   │   ├── vote_router.py               # Vote management endpoints
│   │   ├── holder_router.py             # Secret holder endpoints
│   │   └── share_router.py              # Share management endpoints
│   ├── schemas/                         # API request/response schemas (Pydantic)
│   │   ├── auth.py                      # Authentication schemas
│   │   ├── vote.py                      # Vote schemas
│   │   ├── holder.py                    # Secret holder schemas
│   │   ├── share.py                     # Share schemas
│   │   └── responses.py                 # Standard response schemas
│   └── services/
│       ├── blockchain.py                # Blockchain interaction service
│       └── crypto.py                    # Cryptographic operations service
├── tests/
│   ├── services/                        # Service tests
│   ├── routers/                         # Router tests
│   └── conftest.py                      # Test fixtures
├── main.py                              # Application entry point
├── api.ini                              # Configuration file
└── requirements.txt                     # Dependencies
```

## Models vs. Schemas

The application uses a clear separation between database models and API schemas:

### Database Models (`app/models/`)

Database models represent the structure of data as it's stored in the database:

- Use **SQLAlchemy** for ORM functionality
- Define database tables and relationships
- Include database-specific constraints (unique, nullable, indexes)
- Handle database operations
- Not directly exposed to API clients

Example:
```python
class User(BaseModel):
    """Database model for users."""
    __tablename__ = "users"

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VOTER, nullable=False)
```

### API Schemas (`app/schemas/`)

API schemas define the structure of data for API requests and responses:

- Use **Pydantic** for validation and serialization
- Define validation rules for incoming data
- Specify the format of outgoing data
- Include documentation (descriptions, examples)
- Directly exposed to API clients through OpenAPI/Swagger

Example:
```python
class RegisterRequest(BaseModel):
    """Schema for user registration request."""
    name: str = Field(..., 
                     description="User's full name",
                     min_length=2, 
                     max_length=100,
                     example="John Doe")
    email: EmailStr = Field(..., 
                           description="User's email address",
                           example="john.doe@example.com")
    password: str = Field(..., 
                         description="User's password",
                         min_length=8,
                         example="SecureP@ssw0rd")
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

The application includes comprehensive tests for both services and routers. These tests ensure that the application works as expected and help catch regressions when making changes.

### Test Structure

The tests are organized into two main categories:

1. **Service Tests**: Test the core business logic and service layer
   - Located in `tests/services/`
   - Test blockchain interactions, cryptographic operations, etc.
   - Use mocks to isolate the service being tested

2. **Router Tests**: Test the API endpoints and request/response handling
   - Located in `tests/routers/`
   - Test validation, error handling, and response formatting
   - Use mocks for services and database

### Running Tests

You can run the tests using pytest. Here are some common commands:

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run with print statements visible
pytest -v -s

# Run specific test categories
pytest tests/services/  # Run service tests only
pytest tests/routers/   # Run router tests only

# Run specific test files
pytest tests/services/test_blockchain.py
pytest tests/routers/test_auth_router.py

# Run specific test classes or methods
pytest tests/routers/test_vote_router.py::TestSubmitVote
pytest tests/routers/test_vote_router.py::TestSubmitVote::test_submit_vote_success

# Run with coverage report
pytest --cov=app
pytest --cov=app.services  # Coverage for services only
pytest --cov=app.routers   # Coverage for routers only
```

### Test Fixtures

The tests use fixtures defined in `tests/conftest.py` to set up the test environment:

- `mock_blockchain_service`: Mocks the blockchain service for testing
- `mock_crypto_service`: Mocks the cryptographic service for testing
- `mock_db`: Mocks the database client for testing
- `client`: Creates a FastAPI test client with mocked dependencies

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

## Local Development with Hardhat

For local development, you can use Hardhat to run a local Ethereum node. This provides a convenient way to test the blockchain interactions without spending real ETH.

### Setting up Hardhat

1. Install Hardhat globally:
   ```bash
   npm install -g hardhat
   ```

2. Start the Hardhat node:
   ```bash
   npx hardhat node
   ```
   This will start a local Ethereum node with several pre-funded accounts.

### Deploying the Contract

1. Navigate to the crypto-core directory:
   ```bash
   cd ../crypto-core
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   # Web3 provider URL (Hardhat local node)
   WEB3_PROVIDER_URL=http://127.0.0.1:8545

   # Private key for deployment (without 0x prefix)
   # This is Account #0 from Hardhat
   PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

4. Compile the contract:
   ```bash
   npm run compile
   ```

5. Deploy the contract:
   ```bash
   npm run deploy
   ```
   This will deploy the contract to the local Hardhat node and save the deployment information to `build/deployment.json`.

6. Test the contract interaction:
   ```bash
   npm run test-contract
   ```
   This will test the contract by registering holders, submitting a vote, and retrieving vote data.

### Configuring the Backend

1. Update the `api.ini` file with the following settings:
   ```ini
   [BLOCKCHAIN]
   WEB3_PROVIDER_URL = http://127.0.0.1:8545
   CONTRACT_ADDRESS = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   WALLET_ADDRESS = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   PRIVATE_KEY = ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   Replace the `CONTRACT_ADDRESS` with the address from your deployment.

2. Start the backend server:
   ```bash
   uvicorn main:app --reload
   ```

### Test Accounts

Hardhat provides several pre-funded accounts for testing. Here are the first few:

| Account | Address | Private Key |
|---------|---------|-------------|
| Account #0 | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 |
| Account #1 | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| Account #2 | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |
| Account #3 | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 | 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 |

Each account has 10,000 ETH for testing purposes.

## Testing
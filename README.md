# Timed Release Crypto System

A decentralized system for sending time-locked encrypted messages using blockchain technology and cryptographic protocols. This system allows clients to share secrets among multiple agents who are responsible for revealing the secret at a specific time through smart contract interactions.

## System Architecture

### Frontend (Vue/Nuxt)
- Provides user interface for message submission and monitoring
- Handles user authentication and session management
- Communicates with backend API for all blockchain and data operations
- No direct blockchain or database interaction

### Backend (FastAPI)
- Manages all blockchain interactions through Web3
- Handles database operations for message storage and retrieval
- Provides RESTful API endpoints for the frontend
- Implements the cryptographic protocols from crypto-core
- Manages agent coordination and message scheduling

### Crypto Core
- Contains the core cryptographic implementation
- Provides the smart contract for blockchain deployment
- Includes reference implementations for agents and clients

## Project Structure

```
timed-release-crypto/
├── frontend/                 # Vue/Nuxt frontend application
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── components/      # UI components
│       ├── pages/          # Route pages
│       ├── composables/     # Shared logic and API calls
│       └── utils/          # Helper functions
│
├── backend/                  # FastAPI server
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Blockchain and business logic
│   │   ├── models/        # Data models
│   │   └── utils/         # Helper functions
│   └── config/            # Configuration files
│
├── crypto-core/             # Core crypto implementation
│   ├── agent-script/       # Agent implementation for secret holders
│   ├── client-script/      # Client implementation for message senders
│   ├── contracts/         # Smart contract implementation
│   └── tamarin-crypto-model/ # Formal cryptographic protocol model
```

## API Flow
1. Frontend sends requests to Backend API
2. Backend handles:
   - Message encryption/decryption
   - Smart contract interactions
   - Database operations
3. Backend returns processed data to Frontend
4. Frontend displays results to user

## Directory Details

### crypto-core
- `client-script/`: Contains the Rust implementation for clients to send timed release message transactions. Entry point is `client-script/src/bin/main.rs`.

- `agent-script/`: Contains the Rust implementation for agents (secret holders) who listen to smart contract events and respond with shares. Entry point is `agent-script/src/bin/main.rs`.

- `contracts/`: Contains the smart contract implementation that needs to be deployed on a blockchain. The contract manages the time-locked message protocol and agent coordination.

- `tamarin-crypto-model/`: Contains the formal model of the system's cryptographic protocol in Tamarin Prover (not part of the system implementation).

## Getting Started

[Add setup instructions here]

## Contributing

[Add contribution guidelines here]

## License

[Add license information here]
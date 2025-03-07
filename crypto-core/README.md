# Timed-Release-Crypto
This repository is the implementation of a smart contract based timed-release cryptography system. The system is presented in the paper: [Send Message to the Future? Blockchain-based Time Machines for Decentralized Reveal of Locked Information](https://arxiv.org/abs/2401.05947).

## Basic Concepts
The system is designed for clients to share a secret among multiple agents (secret holders), who are responsible for revealing the secret at a specific time. The clients and the secret holders communicate through a smart contract. To send a timed-release message, a client sends a transaction to the smart contract. The contract emits an event when it receives a message. The agents listen to the smart contract events. From that event, the agents can extract their shares of the secret and publish it to the smart contract at the client specified time.

## File structure
- `agent-script/` is the directory containing the code an agent should run in a Rust implementation. `agent-script/src/bin/main.rs` is the main entry of the code, where agents constantly listen to the smart contract events and respond to them.

- `client-script/` is the directory containing the code that a client can use to send timed release message transactions in a Rust implementation. `client-script/src/bin/main.rs` is the main entry of the code.

- `contracts/` is an implementation of the smart contract that needs to be published on a blockchain for the system to work.

- `tamarin-crypto-model/` is not part of the system implementation but a formal model of the system's cryptographic protocol in Tamarin Prover.

## Smart Contracts

The `contracts` directory contains the Solidity smart contracts for the Timed Release Crypto System:

- `TimedReleaseVoting.sol`: The main contract that handles vote submission, secret holder registration, and share management.
- `TimeLockEnc.sol`: An earlier implementation of time-locked encryption.
- `Vote.sol`: A simple voting contract.

### Compiling Contracts

To compile the contracts:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile the contract:
   ```bash
   npm run compile
   ```

This will generate the ABI and bytecode in the `build/contracts` directory.

### Deploying Contracts

To deploy the contract to a test network:

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your provider URL and private key.

3. Deploy the contract:
   ```bash
   npm run deploy
   ```

The deployment script will:
- Connect to the specified network
- Deploy the contract
- Save the deployment information to `build/deployment.json`

### Contract Interface

The `TimedReleaseVoting` contract provides the following functions:

#### Holder Management
- `joinAsHolder(uint256[2] memory publicKey)`: Register as a secret holder by staking a deposit
- `exitAsHolder()`: Exit as a secret holder and withdraw deposit
- `getNumHolders()`: Get the number of registered holders
- `getHolders()`: Get all registered holders
- `getHolderPublicKey(address holderAddress)`: Get the public key of a holder
- `isHolder(address holderAddress)`: Check if an address is a registered holder
- `requiredDeposit()`: Get the required deposit amount

#### Vote Management
- `submitVote(bytes calldata ciphertext, bytes calldata nonce, uint256 decryptionTime, uint256[2] calldata g2r)`: Submit an encrypted vote
- `submitShare(uint256 voteId, uint256 shareIndex, uint256 shareValue)`: Submit a share for a vote
- `getVote(uint256 voteId)`: Get vote data
- `getSubmittedShares(uint256 voteId)`: Get submitted shares for a vote

## Usage
Here is a step-by-step guide on how to set up a system:
1. Deploy the smart contract in `contracts/` to a blockchain. In the contract, the constants can be tuned to any desired parameters. It may require external smart contract development tools like *hardhat* or *foundry* to deploy the contract. Once deployed, keep a note of the deployed contract address.
2. Set up multiple agents running the `agent-script` Rust code. The number of agents should be equal to the `MAX_COMMITTEE_SIZE` set in the smart contract. To run the agent code, create a `.env` file in the `agent-script` directory specifying the following environment variables:
    - `ADDRESS_SK`: the secret key of the agent's address.
    - `ADDRESS_PK`: the agent's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
    - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
    - `API_URL`: an RPC URL of the blockchain.

3. To send a timed release transaction, run the `client-script` Rust code. Start by creating a `.env` file in the `client-script` directory specifying the same environment variables:
    - `CLIENT_SK`: the secret key of the client's address.
    - `CLIENT_ADDRESS`: the client's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
    - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
    - `API_URL`: an RPC URL of the blockchain.
Then modify the `client-script/src/bin/main.rs` file to specify the secret and the time to reveal the secret. Run the code to send a timed release transaction.
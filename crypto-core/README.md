# Timed-Release-Crypto

This repository implements a smart contract-based timed-release cryptography system. The system is presented in the paper: [Send Message to the Future? Blockchain-based Time Machines for Decentralized Reveal of Locked Information](https://arxiv.org/abs/2401.05947).

## Basic Concepts

The system is designed for clients to share a secret among multiple agents (secret holders), who are responsible for revealing the secret at a specific time. The clients and the secret holders communicate through a smart contract. To send a timed-release message, a client sends a transaction to the smart contract. The contract emits an event when it receives a message. The agents listen to the smart contract events. From that event, the agents can extract their shares of the secret and publish it to the smart contract at the client-specified time.

## Project Structure

- `contracts/`: Contains the Solidity smart contracts for the Timed Release Crypto System.
  - `TimedReleaseVoting.sol`: The main contract that handles vote submission, secret holder registration, and share management.

- `CONTRACT_API.md`: Comprehensive documentation of the contract's functions and access points for backend integration.

## Smart Contract Overview

The `TimedReleaseVoting` contract implements a timed-release cryptography system where:

1. Secret holders register by staking a deposit
2. Clients submit encrypted votes with a specified decryption time
3. Secret holders submit their shares after the decryption time
4. Rewards are distributed to secret holders who submitted their shares
5. Secret holders can exit and withdraw their deposit after fulfilling their obligations

### Key Features

- **Deposit System**: Secret holders must stake a deposit to participate
- **Reward Mechanism**: Clients can set custom reward amounts for secret holders
- **Automatic Distribution**: Rewards are distributed to secret holders who submit their shares
- **Accountability**: Secret holders who fail to submit shares can be forced to exit and forfeit their deposit

## Compiling and Deploying

### Prerequisites

- Node.js and npm
- Web3 provider (like Infura, Alchemy, or a local node)
- Ethereum wallet with funds for deployment

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

To deploy the contract to a network:

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

## Testing

To test the TimedReleaseVoting contract:

1. Make sure you have compiled the contract
2. Run the test script:
   ```bash
   node test-contract.js
   ```

The test script will:
- Deploy the contract to a local network
- Register secret holders
- Submit votes
- Submit shares
- Distribute rewards
- Test the exit functionality

## Integration

For detailed information on how to integrate with the contract, please refer to the [CONTRACT_API.md](./CONTRACT_API.md) file, which provides comprehensive documentation of all contract functions, events, and integration examples.

## Security Considerations

When using this system, consider the following security aspects:

1. **Deposit Management**: Ensure your backend properly tracks deposit status for holders.
2. **Timing**: Implement proper timing mechanisms to submit shares after decryption time.
3. **Error Handling**: Handle contract errors gracefully, especially for transactions that may revert.
4. **Gas Estimation**: Always estimate gas before sending transactions to avoid failures.
5. **Event Monitoring**: Set up reliable event monitoring to catch all relevant contract events.
6. **Backup Mechanisms**: Implement backup mechanisms for share submission in case of network issues.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
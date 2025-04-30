# Timed-Release-Crypto

This repository implements a smart contract-based timed-release cryptography system, refactored for better modularity and to overcome contract size limits. The system is presented in the paper: [Send Message to the Future? Blockchain-based Time Machines for Decentralized Reveal of Locked Information](https://arxiv.org/abs/2401.05947).

## Basic Concepts

The system is designed for clients to share a secret among multiple agents (secret holders), who are responsible for revealing the secret at a specific time. A **Vote Session** defines the parameters of a specific timed-release event (like voting dates, options, deposit requirements). Participants can register as **Voters** or deposit-staking **Holders** via the **Participant Registry**. Clients submit encrypted votes during the session. Holders submit decryption shares after the voting period ends. Rewards (funded by holder deposits) are distributed via the Registry to holders who successfully submitted shares.

## Project Structure

- `contracts/`: Contains the Solidity smart contracts.
  - `VoteSessionFactory.sol`: Deploys linked pairs of `VoteSession` and `ParticipantRegistry` contracts.
  - `VoteSession.sol`: Manages the lifecycle, parameters, and voting process for a single timed-release session.
  - `ParticipantRegistry.sol`: Manages participant registration (holders/voters), deposits, BLS keys, share submission status, and reward/deposit claims for sessions.
- `test/`: Contains Hardhat test files.
  - `VoteSessionIntegration.test.js`: Integration tests for the factory and contract interactions.
- `scripts/`: Contains deployment scripts (e.g., `deploy.js`).
- `hardhat.config.js`: Hardhat configuration file.
- `CONTRACT_API.md`: **(Needs Update)** Comprehensive documentation of the contract's functions and access points for backend integration.

## Smart Contract Overview (Refactored Architecture)

The system now uses a factory pattern for deployment:

1.  **`VoteSessionFactory`**: A factory contract responsible for deploying new timed-release sessions. When called, it deploys a dedicated pair of `VoteSession` and `ParticipantRegistry` contracts and links them together.
2.  **`VoteSession`**: Manages the specific details and lifecycle of one timed-release event (e.g., voting period, share submission period, options, minimum threshold).
3.  **`ParticipantRegistry`**: Manages all participant-related data and actions across multiple sessions (identified by `sessionId`). It handles holder deposits, voter/holder registration, tracks who submitted shares, stores BLS keys, and manages the pull-based reward and deposit claim system.

This separation addresses contract size limits and improves modularity.

### Key Features

- **Factory Deployment**: Simplifies launching new sessions.
- **Separation of Concerns**: `VoteSession` handles timing/voting, `ParticipantRegistry` handles participants/funds.
- **Deposit System**: Holders stake deposits via the `ParticipantRegistry`. Deposits are returned to holders who successfully submit shares.
- **Reward Mechanism**: The reward pool is funded by **forfeited deposits** (from holders who fail to submit shares) and **external contributions** (added by the session creator/owner via the `addRewardFunding` function in `ParticipantRegistry`). This pool is distributed among holders who successfully submitted shares.
- **Pull Payments**: Rewards and Deposits are claimed by participants via functions on the `ParticipantRegistry`, improving gas efficiency for distribution.
- **Voter/Holder Roles**: Supports distinct registration for simple voters and deposit-staking holders.

## Compiling and Deploying

### Prerequisites

- Node.js and npm/yarn
- Hardhat (`npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox` or `yarn add --dev hardhat @nomicfoundation/hardhat-toolbox`)
- Ethereum wallet with funds for deployment (if deploying to testnet/mainnet)
- Web3 provider URL (like Infura, Alchemy, or a local node) for deployments

### Compiling Contracts

To compile the contracts:

1.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

2.  Compile the contracts using Hardhat:
    ```bash
    npx hardhat compile
    ```

This will generate artifacts (ABI, bytecode) in the `artifacts/` directory.

### Deploying Contracts

Deployment should be done using the `VoteSessionFactory`.

1.  Create a deployment script (e.g., `scripts/deploy.js`). This script should:
    *   Get the `VoteSessionFactory` contract factory.
    *   Deploy the factory, passing the desired initial owner address.
    *   (Optionally) Call `createSessionPair` on the deployed factory to initialize the first session.
2.  Configure network details in `hardhat.config.js` if deploying to a network other than the local Hardhat Network.
3.  Create a `.env` file (if needed by your script/config for private keys/URLs).
4.  Run the deployment script:

    *   **To deploy to the default in-memory Hardhat Network (for quick tests):**
        ```bash
        # Assumes 'hardhat' is the default network in hardhat.config.js
        npx hardhat run scripts/deploy.js
        # Or explicitly:
        # npx hardhat run scripts/deploy.js --network hardhat
        ```
        **Note:** Running without `--network localhost` uses a temporary, in-memory Hardhat instance that is separate from any persistent node started with `npx hardhat node` and is destroyed after the script finishes.

    *   **To deploy to a persistent local node (started with `npx hardhat node`):**
        Make sure the node is running in another terminal first.
        ```bash
        # Assumes a network named 'localhost' is configured in hardhat.config.js
        npx hardhat run scripts/deploy.js --network localhost
        ```
    *   **To deploy to a live or test network (e.g., Sepolia):**
        ```bash
        # Assumes a network named 'sepolia' is configured in hardhat.config.js
        npx hardhat run scripts/deploy.js --network sepolia
        ```

## Testing

To run the integration tests using Hardhat:

1.  Make sure you have compiled the contracts (`npx hardhat compile`).
2.  Run the tests:
    ```bash
    npx hardhat test
    # or to run a specific file:
    # npx hardhat test test/VoteSessionIntegration.test.js
    ```

### Running a Local Development Node

For full-stack testing, you can run a local Hardhat Network node that mimics a real blockchain:

```bash
npx hardhat node
```

This will start a local RPC server (usually at `http://127.0.0.1:8545/`) and provide a list of funded accounts you can use for testing. You can then configure your frontend and backend to connect to this local node.

## Integration

For detailed information on how to integrate with the **new contract system**, please refer to the `CONTRACT_API.md` file. **Note: This file requires significant updates** to reflect the `VoteSessionFactory`, `VoteSession`, and `ParticipantRegistry` contracts and their functions/events.

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
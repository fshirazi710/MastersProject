# Timed-Release-Crypto

This repository implements a smart contract-based timed-release cryptography system, refactored for better modularity and to overcome contract size limits. The system is presented in the paper: [Send Message to the Future? Blockchain-based Time Machines for Decentralized Reveal of Locked Information](https://arxiv.org/abs/2401.05947).

## Basic Concepts

The system is designed for clients to share a secret among multiple agents (secret holders), who are responsible for revealing the secret at a specific time. A **Vote Session** defines the parameters of a specific timed-release event (like voting dates, options, deposit requirements). Participants can register as **Voters** or deposit-staking **Holders** via the **Participant Registry**. Clients submit encrypted votes during the session. Holders submit decryption shares after the voting period ends. Rewards (funded by **forfeited deposits** from non-submitting holders and **external contributions**) are distributed via the Registry to holders who successfully submitted shares.

## Project Structure

- `contracts/`: Contains the Solidity smart contracts.
  - `VoteSessionFactory.sol`: A non-upgradeable factory to deploy linked pairs of upgradeable `VoteSession` and `ParticipantRegistry` proxy contracts using the EIP-1167 Clones pattern.
  - `VoteSession.sol`: (Upgradeable) Manages the lifecycle, parameters, voting process, and decryption coordination for a single timed-release session.
  - `ParticipantRegistry.sol`: (Upgradeable) Manages participant registration (holders/voters), deposits, BLS keys, share submission status, and reward/deposit claims across sessions.
  - `interfaces/`: Interfaces for contract interactions (e.g., for initializers).
  - `Structs.sol`: Shared data structures.
- `test/`: Contains Hardhat test files.
  - `fixtures.js`: Deployment fixture for tests.
  - `Factory.test.js`: Tests for the `VoteSessionFactory`.
  - `Registration.test.js`: Tests for participant registration logic.
  - `Voting.test.js`: Tests for the voting process.
  - `ShareSubmission.test.js`: Tests for decryption share submission.
  - `Decryption.test.js`: Tests for decryption value submission and coordination.
  - `RewardsClaims.test.js`: Tests for reward and deposit claim logic.
- `scripts/`: Contains deployment scripts (e.g., `deploy.js`).
- `hardhat.config.js`: Hardhat configuration file.
- `CONTRACT_API.md`: **(Updated)** Comprehensive documentation of the contract's functions, state, events, and access points for backend integration.

## Smart Contract Overview (Refactored & Upgradeable Architecture)

The system now uses a factory pattern with upgradeable contracts:

1.  **`VoteSessionFactory`**: A non-upgradeable factory contract responsible for deploying new timed-release sessions using the EIP-1167 Clones pattern. It requires the addresses of the `VoteSession` and `ParticipantRegistry` *implementation* contracts upon deployment.
2.  **`VoteSession` (Upgradeable Proxy)**: Manages the specific details and lifecycle of one timed-release event (e.g., voting period, share submission period, options, decryption coordination). Deployed as a proxy by the factory.
3.  **`ParticipantRegistry` (Upgradeable Proxy)**: Manages all participant-related data and actions (identified by `sessionId`). It handles holder deposits, voter/holder registration, tracks who submitted shares/values, stores BLS keys, and manages the pull-based reward and deposit claim system. Deployed as a proxy by the factory.

When the factory's `createSessionPair` function is called, it deploys *proxies* pointing to the implementation contracts and initializes them. An external call is then needed to link the registry proxy to the session proxy (`registryProxy.setVoteSessionContract(...)`). This separation addresses contract size limits, improves modularity, and allows for future upgrades of the session/registry logic without disrupting the factory or existing sessions.

### Key Features

- **Factory Deployment**: Simplifies launching new sessions via EIP-1167 Clones (proxies).
- **Upgradeable Contracts**: `VoteSession` and `ParticipantRegistry` logic can be upgraded via their proxies.
- **Separation of Concerns**: `VoteSession` handles timing/voting/decryption, `ParticipantRegistry` handles participants/funds.
- **Deposit System**: Holders stake deposits via the `ParticipantRegistry`. Deposits are returned to holders who successfully submit shares.
- **Reward Mechanism**: The reward pool is funded by **forfeited deposits** (from holders who fail to submit shares) and **external contributions** (added by the session creator/owner via the `addRewardFunding` function in `ParticipantRegistry`). This pool is distributed among holders who successfully submitted shares.
- **Pull Payments**: Rewards and Deposits are claimed by participants via functions on the `ParticipantRegistry`, improving gas efficiency for distribution.
- **Voter/Holder Roles**: Supports distinct registration for simple voters and deposit-staking holders.
- **On-Chain Decryption Coordination**: `VoteSession` facilitates the collection and verification of decryption values from holders, emitting events when the threshold is reached.

## Compiling and Deploying

### Prerequisites

- Node.js and npm/yarn
- Hardhat (`npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts @openzeppelin/contracts-upgradeable` or `yarn add --dev ...`)
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

Deployment involves deploying the implementation contracts first, then the factory, and finally creating session pairs.

1.  Create/update a deployment script (e.g., `scripts/deploy.js`). This script should generally:
    *   Deploy the `ParticipantRegistry` implementation contract.
    *   Deploy the `VoteSession` implementation contract.
    *   Deploy the `VoteSessionFactory`, passing the implementation addresses and the desired initial owner address to its constructor.
    *   **(Optionally)** Call `factory.createSessionPair(...)` on the deployed factory to initialize the first session proxy pair.
    *   **(Crucially)** If a pair was created, call `registryProxy.setVoteSessionContract(sessionId, voteSessionProxyAddress)` using the addresses returned by `createSessionPair` to link the deployed proxies.
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

The project includes a comprehensive integration test suite using Hardhat, ethers.js, and Chai.

1.  Make sure you have compiled the contracts (`npx hardhat compile`).
2.  Run all tests:
    ```bash
    npx hardhat test
    ```
3.  Run tests in a specific file (e.g., `Factory.test.js`):
    ```bash
    npx hardhat test test/Factory.test.js
    ```

### Running a Local Development Node

For full-stack testing, you can run a local Hardhat Network node that mimics a real blockchain:

```bash
npx hardhat node
```

This will start a local RPC server (usually at `http://127.0.0.1:8545/`) and provide a list of funded accounts you can use for testing. You can then configure your frontend and backend to connect to this local node.

## Integration

For detailed information on how to integrate with the **new contract system**, please refer to the `CONTRACT_API.md` file. **This file is now updated** to reflect the `VoteSessionFactory`, `VoteSession`, and `ParticipantRegistry` contracts and their functions/events.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
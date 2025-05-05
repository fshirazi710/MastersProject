# Crypto Core Integration Tasks

This document outlines the tasks required to integrate the newly refactored smart contract system (`ParticipantRegistry.sol`, `VoteSession.sol`, `VoteSessionFactory.sol`) into the backend and frontend applications.

## Remaining Smart Contract Tasks

These tasks focus on refining and hardening the existing contracts before full integration.

-   [ ] **Expand Test Coverage:**
    -   [ ] Add tests for edge cases (e.g., zero eligible participants, zero reward pool, session parameters like `decryptionThreshold` = participant count).
    -   [ ] Add tests for multiple sequential sessions created by the factory.
    -   [ ] Add tests specifically for reentrancy guards on claim functions.
    -   [ ] Consider fuzz testing for state transitions and inputs.
-   [ ] **Gas Optimization Analysis:**
    -   [ ] Use tools like `hardhat-gas-reporter` to analyze gas usage of key functions (registration, voting, share submission, decryption value submission, claims).
    -   [ ] Investigate potential optimizations (e.g., struct packing, loop efficiency, view vs external function usage where applicable).
    -   [ ] Evaluate trade-offs between gas savings and code complexity/readability.
-   [ ] **Security Review / Audit Preparation:**
    -   [ ] Conduct an internal security review focusing on access control, reentrancy, integer overflow/underflow, denial-of-service vectors, and economic incentives.
    *   [ ] **Note:** A formal external security audit is strongly recommended before mainnet deployment or handling significant value.
-   [ ] **Code Comments:** Add NatSpec documentation to all contracts (`Structs.sol`, `ParticipantRegistry.sol`, `VoteSession.sol`, `VoteSessionFactory.sol`) and their functions.

## Backend Integration (`backend/`)

-   [X] **Update `BlockchainService` (`app/services/blockchain.py`):**
    -   [X] Integrate ABIs for `ParticipantRegistry`, `VoteSession`, and `VoteSessionFactory`. (Need to copy new ABIs from `crypto-core/artifacts/contracts/...`)
    -   [X] Add/Update functions to interact with the `VoteSessionFactory` for creating new sessions and retrieving addresses of deployed `VoteSession` and `ParticipantRegistry` contracts.
    -   [X] Modify existing functions (or add new ones) to interact with the correct `ParticipantRegistry` and `VoteSession` instances for a given session ID (using addresses fetched from the factory).
    -   [X] Adapt logic for fetching participant status, session details, vote data, decryption values, reward pool info, etc., to use the new contract functions and ABIs.
    -   [X] Remove all logic, ABI references, and contract address usage related to the old `TimedReleaseVoting` contract.
-   [ ] **Update API Routers (e.g., `vote_session_router.py`, `share_router.py`, `holder_router.py`?):**
    -   [X] Adjust API endpoints to reflect the new contract interactions handled by the updated `BlockchainService`. (e.g., creating a session now uses the factory).
    -   [X] Ensure data returned by endpoints aligns with the information available from the new contracts (e.g., participant status structure might change).
    -   [ ] Review and update any signature verification logic (`share_router.py`?) if required payload structures have changed.
    -   [X] Remove endpoints or logic related to phased-out features (e.g., old winner calculation, direct share submission by backend).
-   [X] **Configuration:**
    -   [X] Add configuration for the deployed `VoteSessionFactory` address (e.g., in `.env` and `app/core/config.py`).
    -   [X] Ensure the backend environment provides necessary RPC URLs.
    -   [X] Remove configuration related to the old `TimedReleaseVoting` contract address.

## Frontend Integration (`frontend/`)

*   **Service Layer Integration:**
    *   [x] `ethersBase.js`: Ensure connection logic is sound.
    *   [x] `factoryService.js`: Update functions to use new `VoteSessionFactory` ABI and address.
    *   [x] `registryService.js`: Update functions to use new `ParticipantRegistry` ABI and address. Add methods for `getParticipantDetails`, `getAllParticipantKeys`, `claimDepositOrReward`.
    *   [x] `voteSessionService.js`: Update functions to use new `VoteSession` ABI and address. Add methods for `getSessionInfo`, `castVote`, `submitShares`, `getVoteRoundParameters`, `submitDecryptionValue`.
    *   [ ] **Cryptography Utilities (`cryptographyUtils.js`, `utils/aesUtils.js`, `utils/conversionUtils.js`):**
        *   [x] Refactor conversion helpers into `utils/conversionUtils.js`.
        *   [x] Refactor AES/Password helpers into `utils/aesUtils.js`.
        *   [x] `cryptographyUtils.js::generateBLSKeyPair`: Verify key generation.
        *   [x] `cryptographyUtils.js::getKAndSecretShares` / `getKAndAlphas`: Verify threshold setup logic and outputs (k, g1r, g2r, alphas).
        *   [x] `cryptographyUtils.js::recomputeKey`: Verify key reconstruction logic (Lagrange, XOR alphas) and AES key derivation.
        *   [x] `cryptographyUtils.js::encodeVoteToPoint`: Implemented using hash-to-curve.
        *   [x] `cryptographyUtils.js::decodePointToVote`: Implemented using comparison against hash-to-curve encodings.
        *   [x] `cryptographyUtils.js::calculateDecryptionShareForSubmission`: Implemented (currently calls `generateShares` which calculates `g1r*sk`). Needs verification against off-chain decryption needs.
        *   [x] `cryptographyUtils.js::decryptVote`: Implemented using AES-GCM and reconstructed key.
        *   [x] `cryptographyUtils.js::calculateNullifier`: Implemented using SHA-256 with domain separation.
        *   [ ] `cryptographyUtils.js::generateZkProof`: Placeholder implemented (throws error). **TODO:** Requires ZK circuit implementation.
        *   [x] `cryptographyUtils.js::calculateDecryptionValue`: Implemented using SHA256(sk).
*   **Component Refactoring / Integration:**
    *   [x] `pages/create-vote-session.vue`: Use `factoryService` to create new sessions.
    *   [x] `pages/session/[id].vue`: 
        *   [x] Fetch session details (`voteSessionService`, `factoryService`, `registryService`).
        *   [x] Manage component display based on contract state (`Pending`, `Active`, `Shares`, `Complete`, `Failed`).
        *   [x] Integrate `RegisterToVote`.
        *   [x] Integrate `CastYourVote`.
        *   [x] Integrate `SubmitSecretShare`.
        *   [x] Integrate `VoteResults`.
        *   [x] Integrate Decryption Submission logic (using `voteSessionService.submitDecryptionValue`).
            *   [ ] **TODO:** Add secure password input field.
            *   [ ] **TODO:** Call `cryptographyUtils.js::calculateDecryptionValue`.
        *   [x] Integrate Claim logic (using `registryService.claimDepositOrReward`).
            *   [ ] **TODO:** Fetch specific claimable amount (deposit vs reward) from `registryService`.
    *   [x] `components/vote/RegisterToVote.vue`: Use `registryService.registerParticipant`.
    *   [x] `components/vote/CastYourVote.vue`: Use `voteSessionService.castVote`.
        *   [x] Fetch participant public keys using `registryService.getAllParticipantKeys`.
        *   [ ] **TODO:** Generate Nullifier by calling `cryptographyUtils.js::calculateNullifier`.
        *   [ ] **TODO:** Generate ZK-SNARK Proof by calling `cryptographyUtils.js::generateZkProof`.
        *   [ ] **TODO:** Encode vote option by calling `cryptographyUtils.js::encodeVoteToPoint` before encryption.
    *   [x] `components/vote/SubmitSecretShare.vue`: Use `voteSessionService.submitShares`.
        *   [x] Fetch `g1r` using `voteSessionService.getVoteRoundParameters`.
        *   [ ] **TODO:** Calculate G2 share by calling `cryptographyUtils.js::calculateDecryptionShareForSubmission`.
    *   [x] `components/vote/VoteResults.vue`:
        *   [x] Fetch state/results data (`voteSessionService` / `registryService`).
        *   [x] Refactor into child components.
        *   [x] Populate child components (`ResultsPending`, `DecryptionFailed`, `ResultsDisplay`, `HolderStatusAndClaim`).
        *   [ ] **TODO:** Implement actual data fetching for decryption (`getAllEncryptedVotes`, `getAllDecryptionShares`, `getSessionInfo`) in `runDecryptionProcess`.
        *   [ ] **TODO:** Implement actual decryption logic within `runDecryptionProcess` (calling `cryptographyUtils.js::decryptVote` and `cryptographyUtils.js::decodePointToVote`).
*   **Testing:**
    *   [ ] Set up Vitest framework.
    *   [ ] Add unit tests for `cryptographyUtils.js` functions (including placeholders once implemented).
    *   [ ] Add unit tests for `utils/aesUtils.js`.
    *   [ ] Add unit tests for `utils/conversionUtils.js`.
    *   [ ] Add integration tests for service functions (`registryService`, `voteSessionService`, etc.) interacting with mock contracts or a local node.
    *   [ ] Add component tests for key components (`CastYourVote`, `VoteResults`, etc.) to verify prop handling and state changes.

## Testing (Duplicate Section Removed)

## Documentation

-   [ ] Update project `README.md` to reflect the new contract architecture (`ParticipantRegistry`, `VoteSession`, `VoteSessionFactory`), deployment process (using the factory), and how to run/test the integrated system. Add note about running the Hardhat node.
-   [ ] Create/Update `CONTRACT_API.md` (or similar) detailing the functions, events, and interaction patterns of the finalized smart contracts for backend/frontend developers. 
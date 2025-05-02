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

-   [ ] **Update `ethersService` (`services/ethersService.js`):**
    -   [X] Integrate ABIs for `ParticipantRegistry`, `VoteSession`, and `VoteSessionFactory`.
    -   [X] Add functions for interacting with the factory (e.g., `createVoteSession`).
    -   [X] Modify functions/helpers to interact with the correct `ParticipantRegistry` and `VoteSession` instances based on the active session ID (e.g. `getSessionAddresses`).
    -   [ ] Adapt transaction functions for:
        -   [X] Registration (`registerParticipant` calling `ParticipantRegistry.registerParticipant`)
        -   [ ] Casting votes (`castVote` calling `VoteSession.castVote`)
        -   [ ] Submitting shares (`submitShares` calling `VoteSession.submitShares`)
        -   [ ] Submitting decryption values (`submitDecryptionValue` calling `VoteSession.submitDecryptionValue`)
        -   [ ] Claiming deposits/rewards (`claimDepositOrReward` calling `ParticipantRegistry.claimDepositOrReward`)
    -   [ ] Update/Add functions for reading contract state (e.g., `getParticipantDetails`, `getSessionInfo`, `getEncryptedVote`, `getDecryptionShare`, `hasClaimed`, etc.).
    -   [ ] Remove all logic, ABI references, and contract address usage related to the old `TimedReleaseVoting` contract.
-   [ ] **Update Components:**
    -   [ ] **`CreateVoteSession.vue`:** Adapt to use the factory contract via the updated `ethersService`.
    -   [ ] **`pages/session/[id].vue` & Child Components:**
        -   [ ] **`RegisterToVote.vue` (or similar):** Update registration logic to use `ethersService.registerParticipant`, handle deposits correctly, associate BLS public key via `ParticipantRegistry`.
        -   [ ] **`CastYourVote.vue`:** Update vote casting logic to use `ethersService.castVote`. Ensure correct BLS public keys are fetched (likely from `ParticipantRegistry` via `ethersService`) and used for threshold logic.
        -   [ ] **`SubmitSecretShare.vue`:** Update share submission logic to use `ethersService.submitShares`, ensuring interaction with the correct `VoteSession` instance.
        -   [ ] **Decryption Submission Component (New/Existing):** Implement UI and logic for calling `ethersService.submitDecryptionValue`.
        -   [ ] **Claim Component (New/Existing):** Implement UI and logic calling `ethersService.claimDepositOrReward`. Handle display of claimable amounts (deposit vs reward) and claimed status.
        -   [ ] **Status Displays:** Update all displays (e.g., in `SessionDetails.vue`, `VoteResults.vue`, participant status components) for participant status, deposit amount, reward pool, session state, decryption progress, claim status etc., fetching data from the new contracts via the updated `ethersService`.
-   [ ] **BLS Key Handling (`services/cryptography.js`, `localStorage` usage):** Review and ensure the localStorage mechanism for encrypting/decrypting/storing BLS keys still aligns with the registration (`ParticipantRegistry`) and submission (`VoteSession`) flows using the new contracts.
-   [ ] **UI/UX Refinements:** Adjust text, button labels, flows, and information displays across the application to accurately reflect the new contract interactions (e.g., clear distinction between deposit return and reward claim).

## Documentation

-   [ ] Update project `README.md` to reflect the new contract architecture (`ParticipantRegistry`, `VoteSession`, `VoteSessionFactory`), deployment process (using the factory), and how to run/test the integrated system. Add note about running the Hardhat node.
-   [ ] Create/Update `CONTRACT_API.md` (or similar) detailing the functions, events, and interaction patterns of the finalized smart contracts for backend/frontend developers. 
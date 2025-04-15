# Deposit System for Secret Holders Implementation

This feature involves implementing a secure deposit system for secret holders, moving beyond the initial user testing prototype to a production-ready design.

## Completed Tasks

- [x] Identify all code components related to the current deposit prototype.
- [x] Analyze dependencies of the prototype code (both internal and external).
- [x] Document the existing data structures and workflow of the prototype deposit system.
- [x] Identify other parts of the system that interact with or depend on the current deposit functionality.
- [x] Define a strategy for phasing out/removing the prototype code.

## In Progress Tasks

## Future Tasks

- [x] Audit/Enhance Smart Contract (`TimedReleaseVoting.sol`) for holder/share status queries (e.g., `hasSubmittedShare`).
- [ ] Refactor `holder_router.py` to remove `public_keys` DB usage (endpoint may be removed/simplified if frontend handles `joinAsHolder` tx).
- [ ] Refactor `vote_router.py` to remove `public_keys` DB usage and rely on contract calls.
- [ ] Refactor `share_router.py` to remove `public_keys` DB usage, remove central key signing, and implement holder signature verification.
- [ ] Refactor `election_router.py` to remove `public_keys` DB usage and rely on contract calls for status checks.
- [x] Update `BlockchainService` (`blockchain.py`) with new/updated contract interaction methods.
- [ ] Implement wallet signing integration in Frontend (`services/api.js`, `services/web3.js`, relevant pages/components) for share submission.
- [ ] Implement frontend logic to initiate/sign `joinAsHolder` contract transaction.
- [ ] Define and implement transition plan (e.g., support only new elections).
- [ ] Remove obsolete code/DB collections (`public_keys`, old signing logic, `holder_helper.py`) after validation.
- [ ] (Optional) Implement on-chain deposit/stake mechanism if required (Smart Contract, Backend, Frontend).
- [ ] Add comprehensive tests for the new on-chain verification and holder signing logic.
- [ ] Update documentation to reflect the new architecture.

## Implementation Plan

### Phasing Out/Removal Strategy (Blockchain-Centric)

1.  **Blockchain as Source of Truth:** Eliminate reliance on the `public_keys` database collection for holder/share status. Query the smart contract directly.
2.  **Smart Contract Audit/Enhancement:** Ensure contract functions exist and are efficient for querying holder registration and share submission status (e.g., `getHoldersByElection`, potentially add `hasSubmittedShare`). Ensure robust event emission.
3.  **Backend Refactoring:** Remove DB writes/reads for `public_keys`. Replace reads with contract calls via `BlockchainService`. Update `BlockchainService` as needed.
4.  **Database Minimization:** Remove `public_keys` collection. Retain `election_metadata` only if necessary for off-chain UI/config data.
5.  **Holder Key Management & Signing:** Shift share submission signing from the backend central key to individual holders using their wallets.
6.  **API & Frontend Changes:** Modify `POST /shares/submit-share` to accept holder-signed data. Update frontend for wallet signing.
7.  **Deposit/Stake Mechanism (Optional):** Implement entirely on-chain if required.
8.  **Transition Plan:** Likely a clean break; new elections use the new system.
9.  **Code Removal:** Remove old backend signing logic, `public_keys` DB logic, and related flags.

### Existing Workflow & Data Structures (Share Submission Prototype)

**Workflow Summary:**

1.  **Registration:** Secret holders register via `POST /holders/join/{election_id}` or `POST /votes/store-public-key/{vote_id}`, creating/updating an entry in the `public_keys` DB collection and marking them with `is_secret_holder: True`.
2.  **Share Preparation:** Agent prepares secret shares for the relevant votes within an election.
3.  **Submission:** Agent calls `POST /shares/submit-share/{election_id}` with their `public_key` and a list of `shares` (each containing `vote_id` and `share` data).
4.  **Backend Processing (`share_router.py`):**
    *   Receives the request.
    *   (Checks `public_keys` DB if shares already submitted - using `released_secret` flag? Needs clarification).
    *   Builds transaction data for the `submitShares` smart contract function.
    *   Signs transaction with backend's private key.
    *   Sends transaction and waits for receipt.
5.  **Status Update:** If the transaction succeeds, `share_router.py` updates the holder's entry in the `public_keys` DB, setting `share_submitted_successfully: True`.
6.  **Verification/Finalization (`election_router.py`, etc.):** Other parts query `public_keys` DB (`share_submitted_successfully` flag) and contract (`getShares`) to check status, meet threshold, calculate rewards.

**Relevant Data Structures:**

*   **`public_keys` DB Collection (MongoDB - inferred):**
    *   `vote_id` (int): Election ID.
    *   `public_key` (string): Participant's public key (hex, stored w/o '0x').
    *   `is_secret_holder` (bool): Identifies secret holders.
    *   `reward_token` (int): Potential reward tracking.
    *   `share_submitted_successfully` (bool): Tracks successful share submission via the backend API.
    *   `released_secret` (bool): Checked before submission in `share_router.py` (purpose unclear / possibly redundant).
*   **API Request Body (`ShareListSubmitRequest` in `backend/app/schemas/`):**
    *   `public_key`: Submitter's public key.
    *   `shares`: List of `{'vote_id': int, 'share': string}`.
*   **Smart Contract Function (`submitShares` in `TimedReleaseVoting.sol`):**
    *   `electionId` (uint256)
    *   `voteIndex` (uint256[])
    *   `publicKey` (string/bytes?)
    *   `shareList` (string[]/bytes[]?)

### Relevant Files

- `backend/app/routers/share_router.py` - Handles API requests for submitting secret shares.
  - **Provides:** `POST /shares/submit-share/{election_id}` endpoint.
  - **Depends on:** `BlockchainService`, Database (`public_keys` collection), `submitShares` (Smart Contract), Schemas (`ShareListSubmitRequest`).
  - **Status:** Identified (Target for major refactor: remove DB, remove central signing, add signature verification)
- `backend/app/services/blockchain.py` - Provides low-level interaction with the blockchain/smart contract.
  - **Provides:** Connection (`w3`), Contract object, `call_contract_function`.
  - **Depends on:** `web3.py`, Contract ABI (`TimedReleaseVoting.json`), `settings`.
  - **Status:** Identified (Needs updates for new contract functions/events)
- `backend/app/routers/holder_router.py` - Handles API requests for secret holder registration.
  - **Provides:** `POST /holders/join/{election_id}` endpoint.
  - **Depends on:** `BlockchainService`, `join_as_holder_transaction` (helper), Smart Contract functions (`getHoldersByElection`).
  - **Status:** Identified (Target for refactor: remove DB usage)
- `backend/app/routers/vote_router.py` - Handles vote submission and participant key management.
  - **Provides:** `POST /votes/submit-vote/{election_id}`, `POST /votes/store-public-key/{vote_id}`.
  - **Depends on:** `BlockchainService`, Database (`public_keys` collection), Smart Contract (`submitVote`).
  - **Status:** Identified (Target for refactor: remove DB usage)
- `backend/app/routers/election_router.py` - Manages election lifecycle and status.
  - **Provides:** Endpoints for creating/querying elections, checking winners.
  - **Depends on:** `BlockchainService`, Database (`public_keys`, `election_metadata` collections), Smart Contract (`getElection`, `getVotes`).
  - **Status:** Identified (Target for refactor: remove DB usage for holder/share status)
- `TimedReleaseVoting.json` (Located at `/` in backend runtime, likely in project root or `backend/` dir) - ABI for the smart contract.
  - **Provides:** Smart contract function definitions.
  - **Depends on:** Solidity contract source (`crypto-core/contracts/TimedReleaseVoting.sol`).
  - **Status:** Identified
- `crypto-core/contracts/TimedReleaseVoting.sol` - Source code for the main smart contract.
  - **Provides:** On-chain logic for elections, voting, holder registration, share submission.
  - **Depends on:** Solidity (`^0.8.0`).
  - **Status:** Identified (Target for audit/enhancement: add efficient status queries)
- Database Collection: `public_keys` - Stores holder information and tracks share submission status.
  - **Provides:** State tracking (`share_submitted_successfully`, `released_secret` flags).
  - **Depends on:** Database instance (likely MongoDB).
  - **Status:** Identified (Target for removal)
- Database Collection: `election_metadata` - Stores UI/config related election metadata.
  - **Provides:** Off-chain data (`displayHint`, `sliderConfig`).
  - **Depends on:** Database instance (likely MongoDB).
  - **Status:** Identified (Likely retained)
- `backend/app/schemas/*.py` - Defines request/response data structures.
  - **Provides:** Data validation and structure.
  - **Depends on:** `pydantic`.
  - **Status:** Identified (May need updates for new API signatures)
- `backend/app/core/config.py` - Contains configuration like private keys and provider URLs.
  - **Provides:** `PRIVATE_KEY`, `WALLET_ADDRESS`, `WEB3_PROVIDER_URL`, `CONTRACT_ADDRESS`.
  - **Depends on:** Environment variables or `.env` file.
  - **Status:** Identified (`PRIVATE_KEY`/`WALLET_ADDRESS` usage in `share_router.py` to be removed)
- `backend/app/core/dependencies.py` - Provides dependency injection setup.
  - **Provides:** Service/DB instances to routers.
  - **Depends on:** Service classes, DB connection logic.
  - **Status:** Identified (DB dependency related to `public_keys` to be removed)
- `frontend/services/api.js` - Central API client module for the Nuxt frontend.
  - **Provides:** Functions to call all backend endpoints.
  - **Depends on:** `axios`, `frontend/config.ts`, Backend API.
  - **Status:** Identified (Needs updates for API changes, wallet integration)
- `frontend/services/web3.js` - Frontend wallet interaction service.
  - **Provides:** Connection to MetaMask/wallets.
  - **Depends on:** Wallet provider (e.g., MetaMask), `ethers.js` or similar.
  - **Status:** Identified (Will be used for holder signing)
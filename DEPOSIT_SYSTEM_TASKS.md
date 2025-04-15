# Deposit System for Secret Holders Implementation

This feature involves implementing a secure deposit system for secret holders, moving beyond the initial user testing prototype to a production-ready design.

## Completed Tasks

- [x] Identify all code components related to the current deposit prototype.
- [x] Analyze dependencies of the prototype code (both internal and external).
- [x] Document the existing data structures and workflow of the prototype deposit system.
- [x] Identify other parts of the system that interact with or depend on the current deposit functionality.
- [x] Define a strategy for phasing out/removing the prototype code.
- [x] Design overall deposit/reward flow (on-chain vs. off-chain elements).
- [x] Smart Contract Enhancements (`TimedReleaseVoting.sol`)
  - [x] Implement basic deposit logic (`depositFunds`).
  - [x] Implement basic on-chain reward calculation/distribution logic (`distributeRewards`).
  - [x] Implement efficient way to get the list of active holders for rewards (`EnumerableSet`).
- [x] Backend Refactoring (`election_router.py`, `election_helper.py`)
  - [x] Remove `public_keys` database/collection usage.
  - [x] Remove winner calculation logic (moved to contract).
  - [x] Remove `/get-winners` endpoint.
  - [x] Update helper functions (`election_information_response`) to get data from contract state via web3 calls (or cache).
  - [x] Add endpoint (`/trigger-reward-distribution`) to call the `distributeRewards` contract function.
- [x] Refactor `frontend/services/web3.js` or Migrate to `ethers.js` (Chosen: Migrate)
  - [x] Implement `EthersService` class.
  - [x] Add method for wallet connection (`init`).
  - [x] Add methods for getting account, signer, balance.
  - [x] Add method for signing messages (`signMessage`).
  - [x] Add method for sending transactions (`sendTransaction`).
- [x] Refactor Frontend Share Submission (`SubmitSecretShare.vue`)
  - [x] Remove private key cookie usage.
  - [x] Use `ethersService` for account & signing.
  - [x] Implement signing of submission payload.
  - [x] Update `shareApi.submitShare` call for backend verification.
  - [x] Use `ethersService.sendTransaction` for contract call.
  - [x] Remove cookie reliance for status (replaced with contract check - *partially done, cookie still used temporarily*).

## In Progress Tasks

- [ ] Backend `share_router.py` Refactoring
  - [ ] Update `/submit-share` endpoint:
    - [ ] Accept signature and public key (address).
    - [ ] Verify signature against payload (shares, election ID, public key).
    - [ ] **Do not** store shares directly.
    - [ ] **Do not** call contract directly (frontend does this now).
    - [ ] Return success/failure based on verification.
- [ ] Frontend `RegisterHolder.vue` Refactoring
  - [ ] Remove private key generation/storage in cookies.
  - [ ] Use `ethersService` to get user's address.
  - [ ] Modify registration process: User connects wallet, signs a registration message.
  - [ ] Backend verifies signature and registers the address.
  - [ ] Handle secure generation/storage/retrieval of Pedersen commitment components (e.g., `h`) if needed, or adjust flow.
  - [ ] Frontend calls `ethersService.sendTransaction` to execute the `joinAsHolder` contract function (potentially including deposit).

## Future Tasks

- [ ] Refactor Naming Scheme (Election->VoteSession, Vote->EncryptedVote, etc.)
- [ ] Refactor `election_router.py`: Remove/Replace `/get-winners`, update helpers, use contract state.
- [ ] Update `BlockchainService` (`blockchain.py`) with new/updated contract interaction methods.
- [ ] Refactor `SubmitSecretShare.vue`: Use web3 service for signing/tx, remove cookies.
- [ ] Implement Frontend `joinAsHolder`: Add UI, send deposit value with tx, remove cookies.
- [ ] Implement Frontend Deposit/Reward UI: Add UI/logic for `claimDeposit` and displaying reward status.
- [ ] Define and implement transition plan (e.g., support only new VoteSessions).
- [ ] Remove obsolete code/DB collections (`public_keys`, old winner logic, `holder_helper.py`) after validation.
- [ ] (Optional) Implement on-chain deposit/stake mechanism if required (Smart Contract, Backend, Frontend). [Covered by Deposit Logic task above]
- [ ] Add comprehensive tests for the new on-chain deposit, reward, and signing logic.
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
  - **Provides:** `POST /shares/submit-share/{election_id}` (now verifies signature).
  - **Depends on:** `BlockchainService`, Schemas (`ShareListSubmitRequest`), `eth_account`.
  - **Status:** Refactored (Removed DB/Central Signing, Added Sig Verification)
- `backend/app/services/blockchain.py` - Provides low-level interaction with the blockchain/smart contract.
  - **Provides:** Connection (`w3`), Contract object, `call_contract_function`, `is_holder_active`, `has_holder_submitted`.
  - **Depends on:** `web3.py`, Contract ABI (`TimedReleaseVoting.json`), `settings`.
  - **Status:** Updated
- `backend/app/routers/holder_router.py` - Handles API requests for secret holder registration.
  - **Provides:** `POST /holders/join/{election_id}` (now checks eligibility).
  - **Depends on:** `BlockchainService`.
  - **Status:** Refactored (Removed Tx Submission)
- `backend/app/routers/vote_router.py` - Handles vote submission and participant key management.
  - **Provides:** `POST /votes/submit-vote/{election_id}`.
  - **Depends on:** `BlockchainService`, Smart Contract (`submitVote`).
  - **Status:** Refactored (Removed DB Endpoints)
- `backend/app/routers/election_router.py` - Manages election lifecycle and status.
  - **Provides:** Endpoints for creating/querying elections, checking winners.
  - **Depends on:** `BlockchainService`, Database (`election_metadata` collection), Smart Contract.
  - **Status:** Partially Refactored (Needs checks in `/get-winners`, `/submit-token-value` updated)
- `TimedReleaseVoting.json` (Located at `/` in backend runtime, likely in project root or `backend/` dir) - ABI for the smart contract.
  - **Provides:** Smart contract function definitions.
  - **Depends on:** Solidity contract source (`crypto-core/contracts/TimedReleaseVoting.sol`).
  - **Status:** Identified
- `crypto-core/contracts/TimedReleaseVoting.sol` - Source code for the main smart contract.
  - **Provides:** On-chain logic for elections, voting, holder registration, share submission.
  - **Depends on:** Solidity (`^0.8.0`).
  - **Status:** Enhanced (Added efficient status queries, fixed duplication)
- Database Collection: `public_keys` - Stores holder information and tracks share submission status.
  - **Provides:** State tracking (`share_submitted_successfully`, `released_secret` flags).
  - **Depends on:** Database instance (likely MongoDB).
  - **Status:** Deprecated (Target for removal)
- Database Collection: `election_metadata` - Stores UI/config related election metadata.
  - **Provides:** Off-chain data (`displayHint`, `sliderConfig`).
  - **Depends on:** Database instance (likely MongoDB).
  - **Status:** Retained
- `backend/app/schemas/share.py` - Defines share-related schemas.
  - **Provides:** `ShareListSubmitRequest` (updated with `signature`).
  - **Depends on:** `pydantic`.
  - **Status:** Updated
- `backend/app/schemas/*.py` (other) - Defines request/response data structures.
  - **Provides:** Data validation and structure.
  - **Depends on:** `pydantic`.
  - **Status:** Identified (May need updates for new API signatures or naming scheme)
- `backend/app/core/config.py` - Contains configuration like private keys and provider URLs.
  - **Provides:** `PRIVATE_KEY`, `WALLET_ADDRESS`, `WEB3_PROVIDER_URL`, `CONTRACT_ADDRESS`.
  - **Depends on:** Environment variables or `.env` file.
  - **Status:** Identified (`PRIVATE_KEY`/`WALLET_ADDRESS` usage removed from routers)
- `backend/app/core/dependencies.py` - Provides dependency injection setup.
  - **Provides:** Service/DB instances to routers.
  - **Depends on:** Service classes, DB connection logic.
  - **Status:** Identified (DB dependency for `public_keys` removed from most routers)
- `frontend/services/api.js` - Central API client module for the Nuxt frontend.
  - **Provides:** Functions to call all backend endpoints.
  - **Depends on:** `axios`, `frontend/config.ts`, Backend API.
  - **Status:** Identified (Needs updates for API changes, wallet integration)
- `frontend/services/web3.js` - Frontend wallet interaction service.
  - **Provides:** Connection to MetaMask/wallets.
  - **Depends on:** Wallet provider (e.g., MetaMask), `ethers.js` or similar.
  - **Status:** Identified (Target for refactoring: add signMessage/sendTransaction)
- `frontend/pages/vote/[id].vue` - Main page for displaying and interacting with a specific vote session.
  - **Provides:** UI container for registration, voting, share submission, results.
  - **Depends on:** `services/api.js`, Child Components (`RegisterToVote`, `SubmitSecretShare`, etc.), `js-cookie` (to be removed).
  - **Status:** Identified (Needs updates to handle new state management/component interactions)
- `frontend/components/vote/SubmitSecretShare.vue` - Component handling secret share submission.
  - **Provides:** UI for share submission.
  - **Depends on:** `services/api.js`, `services/cryptography.js`, `js-cookie`.
  - **Status:** Identified (Target for major refactor: remove key storage, add signing, add tx sending)
- `frontend/components/vote/RegisterToVote.vue` - Component handling voter/holder registration for a session.
  - **Provides:** UI for registration.
  - **Depends on:** `services/api.js`.
  - **Status:** Identified (Target for refactor: implement frontend `joinAsHolder` transaction logic)
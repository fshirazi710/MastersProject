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
  - [x] Add method for reading contract state (`readContract`).
- [x] Refactor Frontend Share Submission (`SubmitSecretShare.vue`)
  - [x] Remove private key cookie usage.
  - [x] Use `ethersService` for account & signing.
  - [x] Implement signing of submission payload.
  - [x] Update `shareApi.submitShare` call for backend verification.
  - [x] Use `ethersService.sendTransaction` for contract call.
  - [x] Remove cookie reliance for status (replaced with `ethersService.readContract('getHolderStatus')`).
- [x] Frontend `RegisterHolder.vue` Refactoring (Renamed to `RegisterToVote.vue`)
  - [x] Remove private key generation/storage in cookies.
  - [x] Use `ethersService` to get user's address.
  - [x] Modify registration process: User connects wallet, calls contract.
  - [x] Backend verifies signature and registers the address. (Note: Backend verification of registration message removed, registration is direct contract call now)
  - [x] Handle secure generation/storage/retrieval of Pedersen commitment components (e.g., `h`) if needed, or adjust flow. (Note: Pedersen logic not added, adjust flow implemented)
  - [x] Frontend calls `ethersService.sendTransaction` to execute the `joinAsHolder` contract function (potentially including deposit).
- [x] Backend `share_router.py` Refactoring
  - [x] Update `/submit-share` endpoint:
    - [x] Accept signature and public key (address).
    - [x] Verify signature against payload (shares, election ID, public key).
    - [x] **Do not** store shares directly.
    - [x] **Do not** call contract directly (frontend does this now).
    - [x] Return success/failure based on verification.
- [x] Implement Secure BLS Key Handling during Registration (`RegisterToVote.vue`):
    - [x] Upon successful `joinAsHolder` transaction:
        - [x] Generate election-specific BLS key pair (`generateBLSKeyPair` in `cryptography.js`).
        - [x] Prompt user for a secure password specifically for this election key (UI added).
        - [x] Implement/Use robust password-based key derivation (PBKDF2) in `cryptography.js`.
        - [x] Encrypt the generated BLS private key using the derived key (AES-GCM via `cryptography.js`).
        - [x] Store the *encrypted* BLS private key, the *salt*, and the *unencrypted* BLS public key in localStorage, scoped by election ID and user address (using consistent key format `election_{id}_user_{addr}_bls...`).
    - [x] Update `RegisterToVote.vue` UI to include password input/confirmation.
- [x] Implement Secure BLS Key Handling during Share Submission (`SubmitSecretShare.vue`):
    - [x] Prompt user for the password created during registration.
    - [x] Retrieve encrypted BLS private key and salt from localStorage (using consistent key format).
    - [x] Use password and PBKDF2 (from `cryptography.js`) to derive decryption key.
    - [x] Decrypt the BLS private key (using AES-GCM via `cryptography.js`).
    - [x] Use the *decrypted* BLS private key when calling `generateShares`.
    - [x] Ensure the decrypted private key is cleared from memory after use.
- [x] Refactor `frontend/services/cryptography.js`:
    - [x] Implement robust password-based key derivation (PBKDF2 via `window.crypto.subtle`).
    - [x] Implement AES-GCM functions (`AESEncrypt`, `AESDecrypt`) using `window.crypto.subtle`.
    - [x] Remove obsolete `getPublicKeyFromPrivate` function.
    - [x] `generateShares` still takes key, but this is now the decrypted key (Acceptable).
    - [x] Remove unused imports (`babelParse`).
- [x] Refactor `VoteResults.vue`:
    - [x] Remove voter-centric winner check logic (`checkWinners`, `submitEmail`).
    - [x] Remove associated UI elements (winner button, email form).
    - [x] Remove reliance on `ethersService` (was only for winner check).
- [x] Refactor `CastYourVote.vue`:
    - [x] Retrieve BLS public key from localStorage instead of deriving from cookie/private key.
    - [x] Remove `js-cookie` dependency and related logic.
    - [x] Update `validateKeyPair` function.

## In Progress Tasks

- [ ] Refactor Naming Scheme (Election->VoteSession, Vote->EncryptedVote, etc.) 
  - [x] Frontend UI Text (Create Vote Session, All Vote Sessions, Key Password Labels).
  - [x] Frontend Code (`api.js`: Rename electionApi->voteSessionApi, voteApi->encryptedVoteApi; update functions, endpoints, params, exports).
  - [x] Frontend Code (`all-vote-sessions.vue`: Update API calls, variable names).
  - [x] Frontend Code (`create-vote-session.vue`: Update API calls, variable names).
  - [x] Frontend Code (`pages/session/[id].vue`: Update API calls, variable names).
  - [x] Frontend Code (`CastYourVote.vue`: Update API calls, function names).
  - [x] Frontend Code (`VoteResults.vue`: Update API calls, function/variable names).
  - [ ] Backend Code (Routers, Services, Helpers - Requires manual changes).
  - [ ] Database Models/Schemas (Requires manual changes).

## Future Tasks

- [ ] Review/update related backend functions (`verifyShares`, etc.) based on the new deposit/signing flow.
- [ ] Investigate/Implement Pedersen commitment logic if required by the updated registration/verification process.
- [ ] Define and implement transition plan (e.g., support only new VoteSessions).
- [ ] Remove obsolete code/DB collections (`public_keys`, old winner logic, `holder_helper.py`) after validation.
- [ ] Add comprehensive tests for the new on-chain deposit, reward, and signing logic.
- [ ] Update documentation to reflect the new architecture.
- [ ] Add UI elements to `VoteResults.vue` to display ETH reward pool status and distribution information for holders (Relates to Task 1 & 6).
- [ ] Implement `claimDeposit` functionality (UI component + contract interaction via `ethersService`).

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
  - **Key Function:** `verify_share_submission_request`.
  - **Depends on:** `BlockchainService`, Schemas (`ShareListSubmitRequest`), `eth_account`, `web3.py`.
  - **Status:** Refactored (Removed DB/Central Signing, Added Sig Verification)
- `backend/app/services/blockchain.py` - Provides low-level interaction with the blockchain/smart contract.
  - **Provides:** Connection (`w3`), Contract object, `call_contract_function`, `is_holder_active`, `has_holder_submitted`.
  - **Depends on:** `web3.py`, Contract ABI (`TimedReleaseVoting.json`), `settings`.
  - **Status:** Updated (Reduced scope of key usage)
- `backend/app/routers/holder_router.py` - Handles API requests for secret holder registration.
  - **Provides:** `POST /holders/join/{election_id}` (now checks eligibility, frontend sends tx).
  - **Depends on:** `BlockchainService`.
  - **Status:** Refactored (Removed Tx Submission Logic)
- `backend/app/routers/vote_router.py` - Handles vote submission and participant key management.
  - **Provides:** `POST /votes/submit-vote/{election_id}`, `POST /get-vote-information/{election_id}`.
  - **Depends on:** `BlockchainService`, Schemas (`VoteCreateRequest`, `VoteSubmitRequest`, etc.), `app.routers.auth_router` (for `get_current_user`), Smart Contract (`submitVote`, `getVotes`), `datetime`.
  - **Status:** Refactored (Removed election creation/listing endpoints, added vote info endpoint)
- `backend/app/routers/election_router.py` - Manages election lifecycle and status.
  - **Provides:** Endpoints for creating/querying elections, reward distribution trigger.
  - **Depends on:** `BlockchainService`, Database (`election_metadata` collection), Schemas (`ExtendedElectionCreateRequest`, etc.), Helpers (`election_helper.py`), Smart Contract, `asyncio`, `logging`, `json`, `datetime`, `app.core.config`, `app.core.error_handling`.
  - **Status:** Partially Refactored (Trigger added, `/get-winners` removed, helper updated, needs confirmation on all state queries)
- `TimedReleaseVoting.json` (Located at `/` in backend runtime, likely in project root or `backend/` dir) - ABI for the smart contract.
  - **Provides:** Smart contract function definitions.
  - **Depends on:** Solidity contract source (`crypto-core/contracts/TimedReleaseVoting.sol`).
  - **Status:** Identified (Generated by compile script)
- `crypto-core/contracts/TimedReleaseVoting.sol` - Source code for the main smart contract.
  - **Provides:** On-chain logic for elections, voting, holder registration, share submission, deposit, rewards.
  - **Depends on:** Solidity (`^0.8.0`), `@openzeppelin/contracts` (`ReentrancyGuard`, `EnumerableSet`).
  - **Status:** Enhanced (Added deposits, rewards, efficient status queries)
  - **Key Functions:**
    - `joinAsHolder(uint256 electionId) payable`: Allows user to register and deposit.
    - `submitShares(uint256 electionId, uint256[] voteIndices, uint256[] shareIndices, string[] shareDataList)`: Submits shares (called by user).
    - `getHolderStatus(uint256 electionId, address holderAddress) view returns (bool isActive, bool hasSubmitted, uint256 deposit)`: Checks holder status.
    - `distributeRewards(uint256 electionId)`: Distributes rewards (called by backend/admin).
    - `claimDeposit(uint256 electionId)`: Allows holder to claim back deposit.
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
  - **Provides:** `WEB3_PROVIDER_URL`, `CONTRACT_ADDRESS`. (Backend `PRIVATE_KEY`/`WALLET_ADDRESS` usage removed from routers).
  - **Depends on:** Environment variables or `.env` file.
  - **Status:** Updated (Reduced scope of key usage)
- `backend/app/core/dependencies.py` - Provides dependency injection setup.
  - **Provides:** Service/DB instances to routers.
  - **Depends on:** Service classes, DB connection logic.
  - **Status:** Identified (DB dependency for `public_keys` removed from most routers)
- `frontend/services/api.js` - Central API client module for the Nuxt frontend.
  - **Provides:** Functions to call all backend endpoints.
  - **Depends on:** `axios`, `frontend/config.ts`, Backend API.
  - **Status:** Identified (Needs updates for API changes, particularly share submission flow)
- `frontend/services/ethersService.js` (Formerly `web3.js`) - Frontend wallet interaction service.
  - **Provides:** Wallet connection, account access, signing, transaction sending, contract reading.
  - **Key Functions:** `init`, `getAccount`, `signMessage`, `sendTransaction`, `readContract`.
  - **Depends on:** Wallet provider (e.g., MetaMask), `ethers.js`.
  - **Status:** Refactored (Implemented `EthersService` class)
- `frontend/services/cryptography.js` - Frontend cryptographic utilities.
  - **Provides:** BLS operations, AES encryption/decryption, share generation, key recomputation, PBKDF2.
  - **Depends on:** `@noble/curves/bls12-381`, `@noble/curves/abstract/modular`, `@noble/curves/abstract/bls`, `buffer`, `window.crypto.subtle`.
  - **Status:** Refactored (PBKDF2/AES implemented, obsolete function removed).
- `frontend/pages/vote/[id].vue` - Main page for displaying and interacting with a specific vote session.
  - **Provides:** UI container for registration, voting, share submission, results.
  - **Depends on:** `services/api.js`, `services/ethersService.js`, Child Components (`RegisterToVote`, `SubmitSecretShare`, etc.).
  - **Status:** Identified (Needs updates for new state management/component interactions).
- `frontend/components/vote/SubmitSecretShare.vue` - Component handling secret share submission.
  - **Provides:** UI for share submission.
  - **Key Function:** `prepareAndSubmitShare` (handles signing, verification API call, contract tx).
  - **Depends on:** `services/api.js`, `services/ethersService.js`, `services/cryptography.js`, `fast-json-stable-stringify`, localStorage.
  - **Status:** Refactored (Secure key retrieval/decryption implemented, uses contract status check).
- `frontend/components/vote/RegisterToVote.vue` - Component handling voter/holder registration for a session.
  - **Provides:** UI for registration and deposit.
  - **Key Functions:** `checkRegistrationStatus`, `registerAndDeposit`, `connectWallet`.
  - **Depends on:** `services/ethersService.js`, `services/cryptography.js`, `config`, `ethers`, localStorage.
  - **Status:** Refactored (Secure BLS key generation/storage implemented).
- `frontend/components/vote/CastYourVote.vue` - Component handling encrypted vote casting.
  - **Provides:** UI for selecting vote option and submitting.
  - **Key Function:** `handleVoteSubmit`, `validateKeyPair`.
  - **Depends on:** `services/api.js`, `services/ethersService.js`, `services/cryptography.js`, localStorage.
  - **Status:** Refactored (Uses localStorage for public key check, removed cookies).
- `frontend/components/vote/VoteResults.vue` - Component displaying vote results and potentially winner info.
  - **Provides:** UI for displaying decrypted vote counts/distribution.
  - **Key Function:** `decryptVotes`.
  - **Depends on:** `services/api.js`, `services/cryptography.js`.
  - **Status:** Refactored (Removed voter winner check logic).

*This list provides a snapshot based on the current understanding. Dependencies and status may evolve.*
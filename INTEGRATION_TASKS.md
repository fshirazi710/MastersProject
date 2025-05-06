### General Development Rules

*   **Always Read First:** Before creating or modifying any file, always read its existing content (if any) to understand the current state. Do not make assumptions about file existence or content.
*   **Verify and Confirm:** Explicitly verify existing structures and confirm requirements before implementing changes.
*   **Keep Tasks Updated:** Regularly update this document (`INTEGRATION_TASKS.md`) by marking tasks as completed (e.g., checking off `[ ]` to `[X]`) as they are finished.
*   **Refactor Large Files:** Prioritize refactoring for any service or utility file exceeding approximately 500 lines of code to maintain readability and manageability.
*   **Modularity & Single Responsibility:** Strive for modular code. Each function, class, and service should ideally have a single, well-defined responsibility.
*   **Clarity & Readability:** Write clear, concise, and readable code. Use meaningful names for variables, functions, and classes.
*   **DRY (Don't Repeat Yourself):** Avoid code duplication. Abstract common logic into reusable functions or utilities.
*   **Consistent Error Handling:** (Related to optional task for `blockchainProvider.js`) Aim for consistent error handling patterns, making it clear how errors are propagated.
*   **Immutability (where practical):** Prefer immutable data structures and pure functions when appropriate to reduce side effects and improve predictability.

### Proposed Service Reorganization

To improve modularity, maintainability, and clarity, the frontend services will be reorganized as follows:

*   `frontend/services/`
    *   `blockchainProvider.js`: (Replaces/evolves from `ethersBase.js`) Handles core Web3 provider/signer logic, network connections, and basic contract interaction utilities.
    *   `contracts/`
        *   `factoryService.js`: All interactions with `VoteSessionFactory.sol`.
        *   `registryParticipantService.js`: Handles participant aspects of `ParticipantRegistry.sol`.
        *   `registryFundService.js`: Handles funding and reward aspects of `ParticipantRegistry.sol`.
        *   `registryAdminService.js`: Handles administrative aspects of `ParticipantRegistry.sol`.
        *   `voteSessionService.js`: All interactions with `VoteSession.sol`.
    *   `utils/`
        *   `cryptographyUtils.js`: Core cryptographic operations (BLS, hashing, shares, etc.).
        *   `aesUtils.js`: AES encryption/decryption utilities.
        *   `conversionUtils.js`: Data type conversion utilities (hex, bytes, string, BigInt).
        *   `blsUtils.js`: Lower-level BLS point manipulations and pairings (if needed directly, otherwise abstracted by `cryptographyUtils.js`).
        *   `lagrangeUtils.js`: Lagrange interpolation logic.
        *   `constants.js`: Shared constants (e.g., domain separators for hashing).

### 1. Core Blockchain Interaction (`frontend/services/blockchainProvider.js`)

*   [X] **Provider & Signer Management:** (Initial version implemented, including dynamic event handling)
    *   [X] Initialize ethers.js provider (e.g., `Web3Provider` from `window.ethereum` or a fallback RPC).
    *   [X] Manage signer acquisition and updates when account changes in wallet.
    *   [X] Implement robust detection and handling of network changes (e.g., chain ID).
    *   [X] Expose functions to get current provider, signer, user address, and chain ID.
*   [X] **Contract Interaction Utilities:** (Initial version implemented)
    *   [X] Generic function `getContractInstance(contractAddress, contractAbi)`: Returns an ethers.js `Contract` instance.
    *   [X] Generic function `readContract(contractInstance, methodName, args)`: For calling view/pure functions.
        *   [X] Includes error handling for contract reverts, parsing error messages.
    *   [X] Generic function `sendTransaction(contractInstance, methodName, args, value)`: For calling state-changing functions.
        *   [X] Handles transaction submission, waits for confirmation (configurable via `confirmations` parameter).
        *   [X] Parses transaction receipts and extracts relevant event data (returns full receipt; specific parsing can be in calling service).
        *   [X] Includes robust error handling (reverts, gas issues, user rejection).
*   [X] **Event Handling:** (Wallet event handling improved with CustomEvents; contract event helpers exist)
    *   [X] Helper functions for subscribing to and unsubscribing from contract events.
*   [X] **Utility Functions:** (Implemented)
    *   [X] `hashMessage(message)`: Uses `ethers.utils.id`.
    *   [X] Wei/Ether conversion utilities (`formatEther`, `parseEther`).
*   [ ] **Error Handling:**
    *   [ ] (Optional) Define a consistent custom error object structure (e.g., `BlockchainProviderError` extending `Error` with codes) for services to throw/return.
    *   [X] Centralized parsing of common Ethers.js errors and contract revert reasons (initial version implemented, can be expanded with custom errors).
*   [X] **JSDoc Comments:** Add for all functions (initial pass completed, updated for event handlers).

### 2. Contract Services (`frontend/services/contracts/`)

**General Requirements for all Contract Services:**
*   [X] Load ABIs directly from the `crypto-core/artifacts/contracts/CONTRACT_NAME.sol/CONTRACT_NAME.json` paths (e.g., `crypto-core/artifacts/contracts/VoteSessionFactory.sol/VoteSessionFactory.json`).
*   [X] Utilize `blockchainProvider.js` for all contract interactions.
*   [X] Implement clear separation between functions performing read operations (view/pure) and write operations (transactions).
*   [X] Perform necessary data type conversions (e.g., JavaScript numbers/strings to BigNumber for contract calls, and vice-versa for results).
*   [X] Implement comprehensive error handling, catching errors from `blockchainProvider.js` and providing context-specific error messages.
*   [X] Add JSDoc comments for all public functions, detailing parameters, return values, and contract methods called.

**2.1. `factoryService.js` (Interactions with `VoteSessionFactory.sol`)**

*   [~] **Configuration:** (Factory address currently read from global config; getter/setter function not implemented but current approach is acceptable)
    *   [ ] Function to set/get the deployed `VoteSessionFactory` contract address.
*   [X] **`createSessionPair(title, description, startDate, endDate, sharesEndDate, options, metadata, requiredDeposit, minShareThreshold)`:** (Implemented as `createVoteSession`)
    *   [X] Calls `VoteSessionFactory.createSessionPair()`.
    *   [X] Input: All parameters as defined in `CONTRACT_API.md`. Ensure correct types (e.g., timestamps as numbers/BigNumbers, `requiredDeposit` as BigNumberish).
    *   [X] Output: `{ voteSessionProxyAddress: string, registryProxyAddress: string, sessionId: number/string }`.
    *   [X] Action: Write transaction.
    *   [X] Listen for `SessionPairDeployed` event to confirm and extract addresses/ID. (Event parsing implemented)
*   [X] **`getDeployedSessionCount()`:**
    *   [X] Calls `VoteSessionFactory.getDeployedSessionCount()`.
    *   [X] Output: `number`.
    *   [X] Action: Read operation.
*   [X] **`getVoteSessionAddressByIndex(index)`:**
    *   [X] Calls `VoteSessionFactory.getVoteSessionAddressByIndex()`.
    *   [X] Input: `index (number)`.
    *   [X] Output: `string (address)`.
    *   [X] Action: Read operation.
*   [X] **`getVoteSessionAddressById(sessionId)`:** (Covered by `getSessionAddresses` method in service)
    *   [X] Calls `VoteSessionFactory.getVoteSessionAddressById()`.
    *   [X] Input: `sessionId (number/string)`.
    *   [X] Output: `string (address)`.
    *   [X] Action: Read operation.
*   [X] **`getRegistryAddressById(sessionId)`:** (Covered by `getSessionAddresses` method in service)
    *   [X] Calls `VoteSessionFactory.getRegistryAddressById()`.
    *   [X] Input: `sessionId (number/string)`.
    *   [X] Output: `string (address)`.
    *   [X] Action: Read operation.
*   [X] **`getFactoryOwner()`:**
    *   [X] Calls `VoteSessionFactory.owner()`.
    *   [X] Output: `string (address)`.
    *   [X] Action: Read operation.
*   [X] **`transferFactoryOwnership(newOwner)`:**
    *   [X] Calls `VoteSessionFactory.transferOwnership()`.
    *   [X] Input: `newOwner (string address)`.
    *   [X] Action: Write transaction.

**2.2. Refactoring `registryService.js`**

Due to its increasing size, `registryService.js` will be refactored into three more focused services. Each service will handle a specific domain of the `ParticipantRegistry.sol` contract's functionality. They will reside in `frontend/services/contracts/`.

**General Requirements for these new Registry-related Services:**
*   [ ] Each service will be a class exporting a singleton instance.
*   [ ] Each service will import and use `blockchainProviderService` for all contract interactions.
*   [ ] Each service will import and use `factoryService` (specifically `factoryService.getSessionAddresses(sessionId)`) to resolve the `registryAddress` for a given `sessionId` before interacting with the registry contract.
*   [ ] Each service will load/manage necessary ABIs (`ParticipantRegistry.json`, and `VoteSession.json` if calls to VoteSession contract are needed from that specific service).
*   [ ] All methods will be aligned with `CONTRACT_API.md` for `ParticipantRegistry.sol`.
*   [ ] Comprehensive JSDoc and error handling for all methods.

**2.2.1. `registryParticipantService.js` (Handles participant registration and information)**

*   [ ] **`registerAsHolder(sessionId, blsPublicKeyHex)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.joinAsHolder()`.
    *   [ ] Requires fetching `requiredDeposit` from `VoteSession.getRequiredDeposit()`.
    *   [ ] Requires checking `VoteSession.isRegistrationOpen()`.
*   [ ] **`registerAsVoter(sessionId)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.registerAsVoter()`.
    *   [ ] Requires checking `VoteSession.isRegistrationOpen()`.
*   [ ] **`getParticipantInfo(sessionId, participantAddress)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.getParticipantInfo()`.
    *   [ ] Returns `{ isRegistered, isHolder, depositAmount, blsPublicKeyHex, hasSubmittedShares }` (deposit formatted).
*   [ ] **`getActiveHolders(sessionId)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.getActiveHolders()`.
*   [ ] **`getNumberOfActiveHolders(sessionId)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.getNumberOfActiveHolders()`.
*   [ ] **`getHolderBlsKeys(sessionId)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.getHolderBlsKeys()`.
    *   [ ] Returns `{ addresses: string[], blsKeysHex: string[] }`.
*   [ ] **`getParticipantIndex(sessionId, participantAddress)`:** (Moved from `registryService.js`)
    *   [ ] Calls `ParticipantRegistry.getParticipantIndex()`.
*   [X] **`claimDeposit(sessionId)`:** (Implemented in `RegistryParticipantService.js`)
    *   [X] Calls `ParticipantRegistry.claimDeposit()`.
    *   [ ] TODO: Check `VoteSession.isDepositClaimPeriodActive()`.
*   [X] **`hasClaimedDeposit(sessionId, participantAddress)`:** (Implemented in `RegistryParticipantService.js`)
    *   [X] Calls `ParticipantRegistry.depositClaimed()`.

**2.2.2. `registryFundService.js` (Manages funding, claims, and financial queries)**

*   [X] **`addRewardFunding(sessionId, amountInWei)`:** (Moved from `registryService.js`, Owner-only on contract)
    *   [X] Calls `ParticipantRegistry.addRewardFunding()` with `msg.value`.
*   [X] **`claimReward(sessionId)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.claimReward()`.
*   [ ] **`getClaimableAmounts(sessionId, participantAddress)`:** (Moved from `registryService.js`) - *To be refactored/replaced by `getRewardsOwed` and participant deposit info.*
    *   [ ] Fetches `rewardsOwed` for the participant.
    *   [ ] Fetches participant's deposit and checks `hasSubmittedShares` via `getParticipantInfo` (potentially from `RegistryParticipantService` or directly if kept simple).
    *   [ ] Returns `{ claimableRewardWei: bigint, claimableDepositWei: bigint }`.
*   [X] **`hasClaimedReward(sessionId, participantAddress)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.rewardClaimed()`.
*   [X] **`getTotalRewardPool(sessionId)`:** (Implemented in `RegistryFundService.js`)
    *   [X] Calls `ParticipantRegistry.totalRewardPool()`.
    *   [X] Output: `string (BigNumberish, amount in Wei)`.
*   [X] **`getRewardsOwed(sessionId, participantAddress)`:** (Implemented in `RegistryFundService.js`)
    *   [X] Calls `ParticipantRegistry.rewardsOwed()`.
    *   [X] Output: `string (BigNumberish, amount in Wei)`.

**2.2.3. `registryAdminService.js` (Handles administrative and owner-specific functions)**

*   [X] **`setVoteSessionContract(sessionId, sessionContractAddress)`:** (Implemented in `RegistryAdminService.js`)
    *   [X] Calls `ParticipantRegistry.setVoteSessionContract()`.
*   [X] **`calculateRewards(sessionId)`:** (Implemented in `RegistryAdminService.js`)
    *   [X] Calls `ParticipantRegistry.calculateRewards()`.
    *   [ ] Requires checking `VoteSession.isRewardCalculationPeriodActive()` (TODO in service).
*   [X] **`getRegistryOwner(sessionId)`:** (Implemented in `RegistryAdminService.js`)
    *   [X] Gets `registryAddress` for `sessionId` via `factoryService`.
    *   [X] Calls `ParticipantRegistry.owner()` on that `registryAddress`.
*   [X] **`transferRegistryOwnership(sessionId, newOwner)`:** (Implemented in `RegistryAdminService.js`)
    *   [X] Gets `registryAddress` for `sessionId` via `factoryService`.
    *   [X] Calls `ParticipantRegistry.transferOwnership()` on that `registryAddress`.

**Old `registryService.js` Status:**
*   [X] File `frontend/services/contracts/registryService.js` has been deleted as its functionality is now covered by `RegistryParticipantService.js`, `RegistryFundService.js`, and `RegistryAdminService.js`.

**2.3. Refactoring `voteSessionService.js`**

Due to its large size (800+ lines), `voteSessionService.js` will be refactored into three more focused services. Each service will handle a specific domain of the `VoteSession.sol` contract's functionality. They will reside in `frontend/services/contracts/`.

**General Requirements for these new VoteSession-related Services:**
*   [ ] Each service will be a class exporting a singleton instance.
*   [ ] Each service will import and use `blockchainProviderService` for all contract interactions.
*   [ ] Each service will load/manage the `VoteSession.json` ABI.
*   [ ] All methods will be aligned with `CONTRACT_API.md` for `VoteSession.sol`.
*   [ ] **Holder Submissions:** Services interacting with `submitDecryptionShare` and `submitDecryptionValue` must account for the `SharesCollectionOpen` period (defined by `endDate` to `sharesCollectionEndDate` in `VoteSession.sol`), which serves as the primary window (e.g., 15 minutes) for holders to submit their cryptographic materials. Failure to complete necessary submissions within this window will result in penalties (loss of deposit/reward) enforced by `ParticipantRegistry.sol` during reward calculation.
*   [ ] Comprehensive JSDoc and error handling for all methods.
*   [ ] The existing `_getContractInstance` and `_SessionStatusEnum` from `voteSessionService.js` can be reused or adapted in each new service.

**2.3.1. `voteSessionAdminService.js` (Handles admin/owner functions, status updates, and calculations)**
    *   [X] **`setDecryptionParameters(voteSessionAddress, alphas, threshold)`** (Moved from `voteSessionService.js`)
    *   [X] **`transferSessionOwnership(voteSessionAddress, newOwner)`** (Moved from `voteSessionService.js`)
    *   [X] **`updateSessionStatus(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`triggerRewardCalculation(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] Service created, relevant methods moved from `voteSessionService.js`.
    *   [X] `voteSessionService.js` updated to remove these methods and add deprecation tags.

**2.3.2. `voteSessionVotingService.js` (Handles casting votes, submitting shares/values)**
    *   [X] **`castEncryptedVote(voteSessionAddress, ciphertext, g1r, g2r, alpha, threshold)`** (Moved from `voteSessionService.js`)
    *   [X] **`submitDecryptionShare(voteSessionAddress, voteIndex, share, shareIndex)`** (Moved from `voteSessionService.js`)
        *   This is the first crucial step for a holder during the `SharesCollectionOpen` period (e.g., 15 minutes post-voting).
        *   Calls `VoteSession.sol::submitDecryptionShare()`, which in turn calls `ParticipantRegistry.sol::recordShareSubmission()`.
    *   [X] **`submitDecryptionValue(voteSessionAddress, value)`** (Moved from `voteSessionService.js`)
        *   This is the second crucial step for a holder, ideally also within the `SharesCollectionOpen` period.
        *   Calls `VoteSession.sol::submitDecryptionValue()`. This function requires that `recordShareSubmission` was successfully called for the holder in `ParticipantRegistry.sol`.
        *   The "value" is typically a hash of the holder's private key (e.g., `SHA256(sk)`), confirming their active participation.
    *   [X] Service created, relevant methods moved from `voteSessionService.js`.
    *   [X] `voteSessionService.js` updated to remove these methods.

**2.3.3. `voteSessionViewService.js` (Handles all read-only/getter functions)**
    *   [X] **`isRegistrationOpen(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getRequiredDeposit(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`isRewardCalculationPeriodActive(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`isDepositClaimPeriodActive(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getSessionDetails(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getSessionInfo(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getStatus(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getEncryptedVote(voteSessionAddress, voteIndex)`** (Moved from `voteSessionService.js`)
    *   [X] **`getNumberOfVotes(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getDecryptionShare(voteSessionAddress, shareLogIndex)`** (Moved from `voteSessionService.js`)
    *   [X] **`getNumberOfSubmittedShares(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getDecryptionParameters(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getSubmittedValues(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getSessionOwner(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getSessionId(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getParticipantRegistryAddress(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getTitle(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] **`getDescription(voteSessionAddress)`** (Moved from `voteSessionService.js`)
    *   [X] Service created, all remaining view methods moved from `voteSessionService.js`.
    *   [X] **(Add any other view functions from `VoteSession.sol` if deemed necessary)** - Considered complete for now.

**Old `voteSessionService.js` Status:**
*   [X] File `frontend/services/contracts/voteSessionService.js` has been deleted as its functionality is now fully covered by the new services above.

### 3. Utility Services (`frontend/services/utils/`)

**General Requirements for all Utility Services:**
*   [ ] Pure JavaScript functions, no direct blockchain interactions.
*   [ ] Comprehensive JSDoc comments for all functions.
*   [ ] Thorough unit testing.

**3.1. `cryptographyUtils.js`**
    *   [X] Refactor `cryptographyUtils.js` into smaller, more focused modules.
        *   [X] `shamirUtils.js` created; `getKAndSecretShares` and `recomputeKey` moved into it.
        *   [X] `blsCryptoUtils.js` created; `generateBLSKeyPair`, `verifyShares`, and `calculateDecryptionShareForSubmission` moved into it.
        *   [X] `voteCryptoUtils.js` created; `encodeVoteToPoint`, `decodePointToVote`, `encryptVoteData`, `decryptVote` moved into it.
    *   [ ] Verify remaining functions (`calculateNullifier`, `calculateDecryptionValue`).
    *   [X] **`calculateNullifier(blsPrivateKey, voteIdentifier)`**: (Reviewed - Existing implementation in `cryptographyUtils.js` aligns with plan: SHA256(sk_hex + domain_sep + sessionId_str))
        *   Input: User's BLS private key, a unique `voteIdentifier` (e.g., `sessionId` + `voteMessageHash` or similar, needs clear definition).
        *   Process: Implement as `SHA256(blsPrivateKey + domainSeparator + voteIdentifier)` or as per specific nullifier scheme defined for the project. Ensure domain separation.
        *   Output: `bytes32` formatted string. (Ensure this is what `VoteSession.castEncryptedVote` expects, though `CONTRACT_API.md` does not explicitly show a nullifier parameter for `castEncryptedVote`. This task might need to be re-evaluated based on the actual `castEncryptedVote` implementation or if it's handled implicitly via ZK-proof).
        *   **Note:** The `CONTRACT_API.md` for `castEncryptedVote` shows parameters `(bytes memory ciphertext, bytes memory g1r, bytes memory g2r, bytes[] memory alpha, uint256 threshold)`. A nullifier is not explicitly listed. This task might be based on an older understanding or a ZK-proof related input. **If ZK-proofs handle unicity, this explicit nullifier calculation might not be needed for `castEncryptedVote` directly, but might be part of ZK-proof inputs.**
    *   [ ] **`generateZkProof(inputs)`**: (Deferred - Full ZKP implementation is out of current scope. Function in `cryptographyUtils.js` throws an error if called.)
        *   Currently a placeholder.
        *   For testing purposes, define a mock structure it should return, e.g., `{ proof: "mock_proof_bytes", publicSignals: ["mock_signal_1"] }`.
        *   The actual inputs will depend on the ZK circuit design (e.g., private key, message, nullifier, merkle path).
    *   [X] **`calculateDecryptionValue(password, encryptedSkPayloadHex)`**: (Refactored to use `aesUtils.decryptWithPassword`)
        *   Input: User's password, and the encrypted SK payload (`0xSALT_IV_CIPHERTEXT`).
        *   Process: Uses `decryptWithPassword` to get SK hex, then hashes it (SHA256) to produce the `v_i` value.
        *   Output: `bytes32` formatted string, suitable for `VoteSession.submitDecryptionValue()`'s `_value` parameter.
    *   [X] **JSDoc Comments & Completeness**: Ensure all crypto operations used by services are robust, secure, and well-documented (All remaining functions in `cryptographyUtils.js` now have up-to-date JSDoc).

**3.1.1. `shamirUtils.js` (New file for Shamir's Secret Sharing functions)**
    *   [X] `getKAndSecretShares` / `getKAndAlphas` (Now `getKAndSecretShares` in `shamirUtils.js`): Reviewed. Refactored `getKAndSecretShares` to use Shamir's Secret Sharing for a scalar `k`. `getKAndAlphas` (for point-based alphas) removed as it was part of the previous problematic scheme for `k` reconstruction.
        *   [X] Threshold setup logic for scalar `k` (Shamir's) verified.
    *   [X] `recomputeKey` (Now in `shamirUtils.js`): Reviewed. Refactored to reconstruct scalar `k` from Shamir's shares using Lagrange interpolation, then derive AES key.
        *   [X] Key reconstruction (Lagrange for scalar shares) verified.
        *   [X] Subsequent AES key derivation (e.g., HKDF from reconstructed scalar `k` / SHA256 of `k` via `importBigIntAsCryptoKey`) verified.

**3.1.2. `blsCryptoUtils.js` (New file for BLS-specific functions)**
    *   [X] `generateBLSKeyPair` (Moved from `cryptographyUtils.js`): Review and verify key generation (public and private key formats).
    *   [X] **`calculateDecryptionShareForSubmission(privateKey, g1r_from_vote)`**: (Moved from `cryptographyUtils.js`, refactored to expect `privateKey` as `bigint`)
        *   [X] Input: User's BLS private key (bigint), `g1r` point associated with the encrypted vote from `VoteSession.sol`.
        *   [X] Process: Perform scalar multiplication `share = g1r * blsPrivateKey`. This `share` is the cryptographic material submitted via `VoteSession.submitDecryptionShare()`.
        *   [X] Output: `bytes` (serialized point) representation suitable for `VoteSession.submitDecryptionShare()`'s `_share` parameter.
    *   [X] `verifyShares` (Moved from `cryptographyUtils.js`): Review BLS pairing logic for correctness (Reviewed, logic `e(share, G2_Base) === e(PK, g2^r)` appears correct for verifying shares of the form `(g1^r)^sk`).

**3.1.3. `voteCryptoUtils.js` (New file for vote-specific cryptographic operations)**
    *   [X] `encodeVoteToPoint` (Moved from `cryptographyUtils.js`): Reviewed. Verified H2C logic using library defaults.
    *   [X] `decodePointToVote` (Moved from `cryptographyUtils.js`): Review and verify; must be inverse of `encodeVoteToPoint`.
    *   [X] `encryptVoteData(voteData, aesKey, activeHolderBlsPublicKeysHex, voteEncryptionThreshold)` (Moved from `cryptographyUtils.js`): Implemented. Depends on `aesUtils.AESEncrypt` and `conversionUtils.hexToBytes`.
    *   [X] `decryptVote(encryptedData, aesKey)` (Moved from `cryptographyUtils.js`): Review and verify AES-GCM decryption logic, IV handling.

**3.2. `aesUtils.js`**
    *   [X] Verify `encryptWithPassword`, `decryptWithPassword` (Implemented and integrated with `cryptographyUtils.calculateDecryptionValue`).
    *   [X] Verify `encryptAES_GCM`, `decryptAES_GCM` for general data encryption (Reviewed, `0x` prefix handling standardized).
    *   [X] Ensure secure and correct handling of salt, IV, and authentication tags (Reviewed: Salt generated for password-based encryption, IV handled by AES-GCM, Auth tags implicit in AES-GCM success/failure).
    *   [X] Add JSDoc comments (Review and ensure completeness for all functions) (All functions have JSDoc).

**3.3. `conversionUtils.js`**
    *   [X] Verify all hex/bytes/string/BigInt/UTF8 conversion functions (Existing functions `hexToBytes`, `bytesToHex`, `bigIntToHex`, `stringToBigInt`, `bigIntTo32Bytes`, `pointToBigint` reviewed and seem robust. UTF8 handled by TextEncoder/Decoder directly where needed).
    *   [ ] Add utilities for padding/unpadding hex strings to specific lengths if needed (Deferred until specific use case arises).
    *   [X] Add JSDoc comments (Existing functions are well-documented).

**3.4. `blsPointUtils.js`, `lagrangeUtils.js`**
    *   [X] Verify correctness of low-level BLS operations (`blsPointUtils.js`: `genR`, `getG1R`, `getG2R`, `computePkRValue`) and Lagrange interpolation logic (`lagrangeUtils.js`: `modInverse`, `lagrangeBasis`, `lagrangeInterpolate`), especially as used by `shamirUtils.js` and `voteCryptoUtils.js` (formerly `cryptographyUtils.js`). (All functions reviewed and appear correct).
    *   [X] Add JSDoc comments (Existing functions in both files are well-documented).
    *   [ ] (TODO for constants.js) Consolidate `FIELD_ORDER` definition from `shamirUtils.js`, `blsCryptoUtils.js`, and `lagrangeUtils.js` into `constants.js`.

**3.5. `constants.js`**
    *   [ ] Define any shared constants, e.g., domain separator strings for hashing, specific curve parameters if not handled by libraries.
    *   [ ] (New Task) Consolidate `FIELD_ORDER` into this file and update dependent utils (`shamirUtils.js`, `blsCryptoUtils.js`, `lagrangeUtils.js`) to import it.

## Testing (`frontend/test/`)

This section details the comprehensive testing strategy for the frontend service layer and utilities.

*   [X] **Setup Vitest Framework:** Ensure Vitest is configured and running for the frontend.
*   [ ] **Mocking Strategy:**
    *   [ ] **Smart Contract Interactions:**
        *   Develop a robust strategy for mocking `ethers.js.Contract` interactions. This can be achieved by:
            *   Creating mock JavaScript classes that implement the same interface as `ethers.js.Contract`.
            *   Using libraries like `jest-ethers` (if compatible with Vitest) or manually mocking provider/signer calls.
            *   Mock implementations should allow simulating successful calls, reverts with specific error messages, event emissions, and different return values.
        *   Consider a `MockBlockchainProvider` that can be injected into services during tests.
    *   [ ] **Data Management:**
        *   Create sets of mock data for sessions, participants, votes, shares, etc., to be used across tests.
        *   Store these in `frontend/test/fixtures/` or similar.

*   [ ] **Unit Tests for Utilities (`frontend/test/utils/`)**
    *   Create separate test files for each utility (e.g., `cryptographyUtils.test.js`, `aesUtils.test.js`, `conversionUtils.test.js`).
    *   **`cryptographyUtils.test.js`**:
        *   Test `generateBLSKeyPair` for valid key pair generation.
        *   Test `getKAndSecretShares` / `getKAndAlphas` with various thresholds and participant counts. Verify share properties.
        *   Test `recomputeKey` with correct and incorrect sets of shares/alphas.
        *   Test `encodeVoteToPoint` and `decodePointToVote` for round-trip consistency.
        *   Test `calculateDecryptionShareForSubmission` against expected outputs given mock inputs.
        *   Test `decryptVote` with known ciphertext/key pairs.
        *   Test `calculateNullifier` for consistent output given same inputs.
        *   Test `generateZkProof` (mock) returns the defined mock structure.
        *   Test `calculateDecryptionValue` for correct output format.
        *   Test `encryptVoteData` and its consistency with parameters expected by `castEncryptedVote`.
        *   Include tests for edge cases (e.g., threshold 1, threshold equals participant count) and expected failures/error throwing for invalid inputs.
    *   **`aesUtils.test.js`**: Test all encryption/decryption functions for round-trip consistency, correct IV/salt/authTag handling, and error handling.
    *   **`conversionUtils.test.js`**: Test all conversion functions with various inputs, including edge cases and invalid formats.
    *   **`blsUtils.test.js`, `lagrangeUtils.test.js`**: Test core logic for correctness.

*   [ ] **Integration Tests for Services (`frontend/test/contracts/`)**
    *   Create separate test files for each service (e.g., `factoryService.test.js`, `registryService.test.js`, `voteSessionService.test.js`).
    *   Inject mocked `blockchainProvider` and mocked contract instances.
    *   For each function in each service:
        *   Test successful execution path: mock contract call success, verify service formats parameters correctly and returns expected data.
        *   Test contract revert scenarios: mock contract revert, verify service handles and propagates the error appropriately.
        *   Test event handling: if a service function should listen for an event, mock its emission and verify the service reacts.
        *   Test data transformations between frontend data types and contract-expected types.
    *   **Example for `factoryService.test.js` - `createNewSession`**:
        *   Test with valid parameters, mock `createSessionPair` success and `SessionPairDeployed` event emission, verify returned addresses/ID.
        *   Test with invalid parameters, expect service to throw error before contract call.
        *   Test contract revert during `createSessionPair`, verify service throws appropriate error.
    *   Test error handling in services thoroughly.

*   [ ] **End-to-End Mocked Voting System Tests (`frontend/test/e2e/`)**
    *   These tests will simulate user flows using the frontend services, with the entire blockchain interaction layer mocked.
    *   They will verify the correct orchestration of calls across different services and utilities.
    *   Structure: `votingLifecycle.test.js`
    *   **Setup for E2E tests:**
        *   Instantiate all services with mocked providers/contracts.
        *   Prepare mock data: factory address, user accounts (admin, holder1, holder2, voter1).
        *   Helper functions to simulate time progression (e.g., advancing mock `block.timestamp` to move between session phases).

    *   **Test Scenario 1: Full Successful Lifecycle**
        1.  **Admin**: Call `factoryService.createSessionPair(...)` -> Mock successful deployment, get `sessionId`, `voteSessionAddress`, `registryAddress`. Ensure `sharesCollectionEndDate` is set to `endDate` + 15 minutes.
        2.  **Admin**: Call `registryAdminService.setVoteSessionContract(...)` for the new pair. (Updated from registryService)
        3.  **Admin**: Call `voteSessionAdminService.setDecryptionParameters(...)`. (Updated from voteSessionService)
        4.  **Admin**: Call `registryFundService.addRewardFunding(...)`. (Updated from registryService)
        5.  **Holder1**: Call `cryptographyUtils.generateBLSKeyPair()`.
        6.  **Holder1**: Call `registryParticipantService.registerAsHolder(sessionId, blsPublicKeyHex)`. (Updated, assuming deposit is part of this or handled by VoteSession directly)
        7.  **Voter1**: Call `registryParticipantService.registerAsVoter(sessionId)`. (Updated from registryService)
        8.  (Simulate time moves to `VotingOpen` period: `block.timestamp >= startDate && block.timestamp < endDate`)
        9.  **Holder1**: Prepare vote, call `cryptographyUtils.encryptVoteData(...)`, then `voteSessionVotingService.castEncryptedVote(...)`. Mock success. (Updated from voteSessionService)
        10. **Voter1**: Prepare vote, call `cryptographyUtils.encryptVoteData(...)`, then `voteSessionVotingService.castEncryptedVote(...)`. Mock success. (Updated from voteSessionService)
        11. (Simulate time moves to `SharesCollectionOpen` period: `block.timestamp >= endDate && block.timestamp < sharesCollectionEndDate`)
        12. **Holder1**: Call `cryptographyUtils.calculateDecryptionShareForSubmission(...)`, then `voteSessionVotingService.submitDecryptionShare(...)`. Mock success. This call must occur within the 15-minute `SharesCollectionOpen` window.
        13. **Holder1**: Call `cryptographyUtils.calculateDecryptionValue(...)`, then `voteSessionVotingService.submitDecryptionValue(...)`. Mock success. This call must also effectively be completed considering the 15-minute window, as `ParticipantRegistry.calculateRewards` will check submissions made before `sharesCollectionEndDate`. Mock `DecryptionThresholdReached` event if applicable.
        14. (Simulate time moves to `Completed` state: `block.timestamp >= sharesCollectionEndDate`)
        15. **Anyone/Admin**: Call `voteSessionAdminService.triggerRewardCalculation()`. Mock success. (Updated from voteSessionService)
        16. **Admin**: Call `registryAdminService.calculateRewards(sessionId)`. Mock successful calculation (verifying Holder1 met submission deadlines) and `RewardsCalculated` event. (Updated from registryService)
        17. **Holder1**: Call `registryFundService.claimReward(sessionId)`. Mock success. (Updated from registryService)
        18. **Holder1**: Call `registryParticipantService.claimDeposit(sessionId)`. Mock success. (Updated from registryService)
        19. **Assertions**: Throughout the flow, assert correct parameters passed to mocked contract calls, correct events "emitted" by mocks, and correct data returned/processed by services. Check participant status changes in the mocked registry, especially `hasSubmittedShares` in `ParticipantRegistry` after step 12 and successful value submission in `VoteSession` after step 13.

    *   **Test Scenario 2: Holder Fails to Submit Decryption Share within Window**
        *   Follow Scenario 1, but Holder1 does *not* call `voteSessionVotingService.submitDecryptionShare(...)` *or* calls it *after* `sharesCollectionEndDate`.
        *   When `registryAdminService.calculateRewards` is called, mock that Holder1's deposit is forfeited and no reward is allocated because `ParticipantRegistry.recordShareSubmission` was not successfully called (or not in time).
        *   Assert Holder1 cannot claim reward or deposit.
        *   Assert other participating holders (if any who submitted correctly) receive rewards.

    *   **Test Scenario 3: Holder Submits Share but Fails to Submit Decryption Value (or submits value too late)**
        *   Follow Scenario 1, Holder1 successfully calls `voteSessionVotingService.submitDecryptionShare(...)` within the 15-minute window.
        *   However, Holder1 does *not* call `voteSessionVotingService.submitDecryptionValue(...)` at all, or calls it *after* `sharesCollectionEndDate`.
        *   When `registryAdminService.calculateRewards` is called:
            *   Mock that Holder1's deposit is claimable (as `recordShareSubmission` was successful in `ParticipantRegistry`).
            *   Mock that Holder1 is *not* eligible for rewards because `submitDecryptionValue` was missing or too late for the `VoteSession` to count it towards the `decryptionThreshold` in time for `calculateRewards`.
        *   Assert Holder1 can claim deposit.
        *   Assert Holder1 cannot claim reward.

    *   **Test Scenario 4: Insufficient Decryption Values Submitted (Threshold Not Reached within window)**
        *   Setup with multiple holders. All submit `DecryptionShare` within the 15-minute window.
        *   However, an insufficient number of them submit `DecryptionValue` within the 15-minute window (or before `sharesCollectionEndDate`).
        *   Mock that `DecryptionThresholdReached` event is not emitted by `VoteSession` *or* emitted too late to be considered by `calculateRewards`.
        *   Assert behavior of `voteSessionViewService.getSubmittedDecryptionValues()` (may show fewer than threshold, or values submitted post-window).
        *   Assert impact on reward calculation: rewards might not be distributed, or only to those who fully submitted on time, depending on `ParticipantRegistry.calculateRewards` logic. Clarify this logic.
        *   Deposits for those who submitted shares should still be claimable.

    *   **Test Scenario 5: Registration/Voting Period Handling**
        *   Attempt `joinAsHolder` before/after registration period (mock `isRegistrationOpen` to return false). Assert failure.
        *   Attempt `castEncryptedVote` before/after voting period. Assert failure.

    *   **Test Scenario 6: Edge Cases**
        *   Session with zero participants.
        *   Session with zero votes.
        *   Session with zero reward funding and no forfeitures.
        *   `minShareThreshold` in `VoteSession` (if its purpose is clarified and testable at service level).

*   [ ] **Test Coverage Goal**: Aim for 85%+ test coverage for the service and utility layers. Use Vitest coverage reporting.

### 4. UI Services & Middleware

This section covers services and middleware primarily focused on UI-level concerns, such as authentication state management and route protection.

**4.1. Authentication State Management (`frontend/authentication.js`)**

*   **File Purpose:** Provides a reactive Vue store for managing client-side authentication state, including user information and JWT token handling.
*   **Existing Functionalities:**
    *   [X] `store.loggedIn`: Reactive boolean indicating login status.
    *   [X] `store.user`: Reactive object holding user information (e.g., email parsed from token).
    *   [X] `store.checkLoginStatus()`: Checks `localStorage` for a token, updates `loggedIn` and `user` state.
    *   [X] `store.setLoggedIn(token)`: Stores token in `localStorage` and updates state.
    *   [X] `store.logout()`: Clears token from `localStorage` and resets state.
    *   [X] `store.getToken()`: Retrieves token from `localStorage`.
    *   [X] `store.isAuthenticated()`: Checks `loggedIn` status and token presence.
*   **Potential Review/Enhancements (Future Considerations):**
    *   [ ] More robust error handling during token parsing.
    *   [ ] Consider periodic token validation with a backend endpoint if session expiry needs proactive handling.
    *   [ ] Ensure sensitive user information is not stored excessively in the reactive store if only email is needed.

**4.2. Route Middleware (`frontend/middleware/auth.js`)**

*   **File Purpose:** Nuxt route middleware to protect specified routes, redirecting unauthenticated users to the login page.
*   **Existing Functionalities:**
    *   [X] Defines a list of `protectedRoutes`.
    *   [X] For protected routes, checks for a token in `localStorage` (client-side).
    *   [X] If no token, redirects to `/login` with a `redirect` query parameter for post-login navigation.
*   **Potential Review/Enhancements (Future Considerations):**
    *   [ ] Explore making `protectedRoutes` more dynamic or configurable if the application grows significantly.
    *   [ ] Consider integration with Vuex store or Pinia (if adopted) for checking authentication status instead of direct `localStorage` access in middleware, for better centralization (though current approach is common for Nuxt middleware).
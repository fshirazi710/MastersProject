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
*   **Function Documentation Standard:** For each public function in a service, clearly document (both in JSDoc and where function lists appear in this document):
    *   **Call Signature:** (e.g., `functionName(param1: type, param2: type): Promise<ReturnType>`)
    *   **Input(s):** Detailed description of each parameter, its expected type, and purpose.
    *   **Output:** Detailed description of the return value, its type, and structure.
    *   **Action:** Brief description of what the function does, including the primary smart contract method it calls (if any) and whether it's a read or write operation.

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

*   [X] **`registerAsHolder(sessionId, blsPublicKeyHex)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.joinAsHolder()`.
    *   [X] Requires fetching `requiredDeposit` from `VoteSession.getRequiredDeposit()`.
    *   [X] Requires checking `VoteSession.isRegistrationOpen()`.
*   [X] **`registerAsVoter(sessionId)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.registerAsVoter()`.
    *   [X] Requires checking `VoteSession.isRegistrationOpen()`.
*   [X] **`getParticipantInfo(sessionId, participantAddress)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.getParticipantInfo()`.
    *   [X] Returns `{ isRegistered, isHolder, depositAmount, blsPublicKeyHex, hasSubmittedShares }` (deposit formatted).
*   [X] **`getActiveHolders(sessionId)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.getActiveHolders()`.
*   [X] **`getNumberOfActiveHolders(sessionId)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.getNumberOfActiveHolders()`.
*   [X] **`getHolderBlsKeys(sessionId)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.getHolderBlsKeys()`.
    *   [X] Returns `{ addresses: string[], blsKeysHex: string[] }`.
*   [X] **`getParticipantIndex(sessionId, participantAddress)`:** (Moved from `registryService.js`)
    *   [X] Calls `ParticipantRegistry.getParticipantIndex()`.
*   [X] **`claimDeposit(sessionId)`:** (Implemented in `RegistryParticipantService.js`)
    *   [X] Calls `ParticipantRegistry.claimDeposit()`.
    *   [X] TODO: Check `VoteSession.isDepositClaimPeriodActive()`.
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
    *   [~] **`getSessionDetails(voteSessionAddress)`** (Moved from `voteSessionService.js`)
        *   (CONTRACT_API.md lists this, but VoteSession.sol source does NOT have getSessionDetails(). Service method needs refactor/removal. Test is currently commented out.)
    *   [~] **`getSessionInfo(voteSessionAddress)`** (Moved from `voteSessionService.js`)
        *   (CONTRACT_API.md signature is outdated. Service method calls contract.getSessionInfo() which returns 10-element tuple per VoteSession.sol source. Service parsing corrected.)
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
    *   [X] Define any shared constants, e.g., domain separator strings for hashing, specific curve parameters if not handled by libraries.
    *   [X] Consolidate `FIELD_ORDER` into this file and update dependent utils (`shamirUtils.js`, `blsCryptoUtils.js`, `lagrangeUtils.js`) to import it.

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

### 5. Testing (Live Hardhat Node)

This section details the strategy for testing frontend services that interact with smart contracts. The primary approach is to test against a live Hardhat node with contracts deployed.

**5.1. Core Principles & Setup**

*   **Live Hardhat Node:** All service tests involving contract interaction will run against a local Hardhat node. This ensures tests reflect actual contract behavior.
*   **`frontend/test/setup.js`:** This file is responsible for:
    *   Connecting to the Hardhat RPC endpoint (e.g., `http://127.0.0.1:8545`).
    *   Providing `ethers.js` provider and signers (e.g., `deployerSigner`, `userSigner`) for tests.
    *   Exporting the `DEPLOYED_FACTORY_ADDRESS` which is the entry point for deploying new session and registry instances for tests.
*   **Fresh Contract Instances:** For most tests, new instances of `VoteSession` and `ParticipantRegistry` contracts will be deployed via the `VoteSessionFactory` to ensure test isolation. Helper functions (like `deployRegistryTestSession` or `deployVoteSessionTestContext` in test files) should be used for this.
*   **`blockchainProviderService`:** All contract-interacting services are now built upon `blockchainProviderService`. Test setups will need to:
    *   Instantiate `blockchainProviderService`.
    *   Initialize it with the `provider` from `frontend/test/setup.js`.
    *   Use `setSigner()` or pass signers to service methods as appropriate, utilizing `deployerSigner` and `userSigner` from `setup.js`.
*   **Time Advancement:** Utilize Hardhat's time-travel capabilities (`provider.send('evm_increaseTime', ...)` and `provider.send('evm_mine', [])`) for testing time-sensitive logic (e.g., registration windows, share submission periods, claim periods).
*   **ABI Loading:** Services load ABIs directly from `crypto-core/artifacts/`. Ensure the Hardhat node has the corresponding contracts compiled and ABIs are up-to-date.

**5.1.1. Test Time Management (Crucial for Period-Dependent Logic)**

*   **Setting `startDate` for New Sessions:**
    *   When deploying `VoteSession` instances for tests that require interaction during the registration period (or any open period), set the `startDate` (and consequently `registrationEndDate`) sufficiently in the future to allow test operations before the period closes.
        *   Example: `const now = await ethers.provider.getBlock('latest').then(block => block.timestamp); const startDate = now + 3600; // 1 hour from now`
        *   Set `endDate` and `sharesCollectionEndDate` appropriately relative to this `startDate`.
*   **Advancing Time:**
    *   For tests that require a specific period to be closed (e.g., testing "registration not open" scenarios), create the session with a future `startDate` as above. Then, explicitly advance time past the relevant date using Hardhat's time manipulation tools.
        *   Example: `await network.provider.send("evm_setNextBlockTimestamp", [startDate + 10]); await network.provider.send("evm_mine"); // Advance time to 10 seconds after startDate`
    *   Or using `time.increaseTo()` from `@nomicfoundation/hardhat-network-helpers`: `await time.increaseTo(startDate + 10);`
*   **Avoid Small Time Offsets:** Do not rely on very small time offsets (e.g., `startDate = now + 1`) as test execution overhead or concurrent operations can easily lead to the period closing before intended.
*   **Verify Period Status:** For complex tests, consider adding assertions that explicitly check the status (e.g., `await voteSession.isRegistrationOpen()`) after time manipulations to ensure the contract is in the expected state before proceeding with the main test logic.

**5.2. Service Test Files (`frontend/test/contracts-tests/`)**

The following test files need to be created or refactored from existing ones. Each test suite should thoroughly test the public interface of its corresponding service.
(Status Key: [P] All Passing, [F] Some Failing/Todo, [R] Reviewed/Refactored, [NR] Not Run/Needs Rerun)

*   [NR] **`blockchainProviderService.test.js`:** (High priority - critical service)
    *   Test provider/signer initialization and retrieval.
    *   Test network change detection (if feasible in Hardhat environment, otherwise unit test logic).
    *   Test `getContractInstance`, `readContract`, `sendTransaction` against a simple mock/test contract deployed to Hardhat.
    *   Test event handling helpers.
    *   Test utility functions (`hashMessage`, Wei/Ether conversions).
    *   [X] Enhance error specificity for `getSessionAddresses` when testing with a non-existent session ID (e.g., expect `/Factory: Invalid session ID/i` or similar specific message if thrown by service/contract).
*   [P] **`factoryService.test.js`:** (All tests passing)
    *   [X] Update to use `blockchainProviderService`.
    *   [X] Test `createVoteSession` (formerly `createSessionPair`):
        *   [X] Successful deployment and event emission.
        *   [ ] Parameter validation (e.g., invalid dates, options). (Basic params are valid, extensive validation not explicitly tested yet - remains as lower priority TODO)
        *   [X] Correct addresses and `sessionId` returned.
    *   [X] Test `getDeployedSessionCount`.
    *   [X] Test `getVoteSessionAddressByIndex`.
    *   [X] Test `getSessionAddresses` (formerly `getVoteSessionAddressById` / `getRegistryAddressById`).
    *   [X] Test `getFactoryOwner`.
    *   [X] Test `transferFactoryOwnership`. (Marked as TODO in test file - Now implemented)
    *   [X] **Detailed Sub-Tasks & Review Notes:** (All addressed)
        *   [X] Refactor timestamp generation in `createVoteSession` test to use `provider.getBlock('latest').timestamp` instead of `Date.now()` for robustness.
        *   [X] Improve test independence: `getDeployedSessionCount` and `getVoteSessionAddressByIndex` tests should set up their own session context rather than relying on previous tests.
        *   [X] Enhance error specificity for `getSessionAddresses` when testing with a non-existent session ID (e.g., expect `/Factory: Invalid session ID/i` or similar specific message if thrown by service/contract).
*   [F] **`registryParticipantService.test.js`:** (Partially complete, 3 tests marked .todo)
    *   [X] Setup: Deploy a new session pair using `factoryService`.
    *   [X] Test `registerAsHolder`:
        *   [X] Successful registration with correct deposit.
        *   [X] Preventing double registration.
        *   [X] Handling insufficient deposit.
        *   [X] Interaction with `VoteSession` for `requiredDeposit` and `isRegistrationOpen`.
    *   [X] Test `registerAsVoter`.
    *   [X] Test `getParticipantInfo`.
    *   [X] Test `getActiveHolders`, `getNumberOfActiveHolders`, `getHolderBlsKeys`.
    *   [X] Test `getParticipantIndex`.
    *   [~] Test `claimDeposit` (requires time advancement) - (Marked as .todo in test file due to share submission complexities, depends on `voteSessionVotingService.test.js` resolution)
    *   [~] Test `hasClaimedDeposit`. (Marked as .todo for 'true' case, tied to `claimDeposit` complexities)
    *   [X] Verify `RewardClaimed` event and updated user balance or that `rewardsOwed` becomes 0.
*   [NR] **`registryFundService.test.js`:** (Partially implemented)
    *   [X] Setup: Deploy session, register participants. (Basic setup done, share submission & reward calc in progress for claim tests)
    *   [X] Test `addRewardFunding`.
    *   [~] Test `claimReward` (requires time advancement, prior reward calculation) - (Initial tests implemented, more complex scenarios marked as TODO)
        *   [X] Successful claim after share submission and reward calculation.
        *   [X] Prevent claiming twice.
        *   [ ] Prevent claiming if shares not submitted (Marked as TODO in test file).
        *   [ ] Prevent claiming if rewards not calculated (Marked as TODO in test file).
    *   [X] Test `hasClaimedReward`. (Basic cases covered, tied to claimReward tests)
    *   [X] Test `getTotalRewardPool`.
    *   [X] Test `getRewardsOwed`. (Basic cases covered)
    *   [X] **Detailed Sub-Tasks & Review Notes:**
        *   [X] Refactor timestamp generation in `deploySessionForFundTests` helper to use `provider.getBlock('latest').timestamp`.
        *   [X] Review and potentially remove redundant `blockchainProviderService.initialize(provider)` call in `beforeEach`. (Done, removed)
        *   [X] Import `ParticipantRegistry.json` ABI directly in `addRewardFunding` test for event parsing.
        *   [ ] Ensure tests for `getRewardsOwed` and `hasClaimedReward` (where participant is registered) handle potential timing issues with `registerAsHolder` if the main `testContext` session registration period closes too fast (should be mitigated by updating the deploy helper). (Partially addressed by new helper timing)
        *   [~] Implement full test scenario for `claimReward`: (Initial implementation done, complex scenarios pending)
            *   [X] Setup: Deploy session, register holder, fund rewards (`addRewardFunding`).
            *   [~] Simulate share submission for the holder (e.g., direct call to `registry.recordShareSubmission` or via `voteSessionVotingService.submitDecryptionShare`). (Attempted via `voteSessionVotingService`)
            *   [X] Advance time past `sharesEndDate`.
            *   [~] Admin calls `registryAdminService.calculateRewards`. (Attempted, with TODO for `isRewardCalculationPeriodActive` check)
            *   [ ] Advance time if there's a specific reward claim period (or ensure `ParticipantRegistry.rewardsCalculatedByAdmin` is true).
            *   [X] User calls `registryFundService.claimReward()`.
            *   [X] Verify `RewardClaimed` event and updated user balance or that `rewardsOwed` becomes 0.
*   [NR] **`registryAdminService.test.js`:** (Refactored, needs run)
    *   [X] Setup: Deploy session. (Implicitly done by helper)
    *   [X] Test `setVoteSessionContract`. (Success and non-admin failure implemented)
    *   [~] Test `calculateRewards` (requires time advancement, share submissions, interaction with `VoteSession.isRewardCalculationPeriodActive`). (Enhanced implementation)
        *   [X] Simulate share submission for at least one participant (e.g., direct call to `registryContract.recordShareSubmission(sessionId, participantAddress)` using `deployerSigner` or ensure a mock `voteSessionVotingService.submitDecryptionShare` is successful prior) to make them eligible for rewards. (Done via `voteSessionVotingService`)
        *   [X] Before calling `registryAdminService.calculateRewards`, ensure the conditions are met for `VoteSession.isRewardCalculationPeriodActive()` to be true. This involves advancing time past `sharesEndDate` and potentially checking this state via `voteSessionViewService`. (Done)
        *   [X] The `registryAdminService.calculateRewards` method itself should ideally perform a pre-check for `isRewardCalculationPeriodActive` (from the associated VoteSession contract) and throw a service-level error if not active. The test should then also cover this scenario. (Test for inactive period added)
        *   [X] After a successful `calculateRewards` call (and if a participant was eligible), assert that `registryFundService.getRewardsOwed(sessionId, participantAddress)` returns a value greater than 0. (Done)
        *   [X] Verify that a subsequent call to `ParticipantRegistry.voteSession()` (via a direct read or a view service if available) on Registry A now returns the address of Session B. (Event checked, direct read verification is a TODO within test)
    *   [X] Test `getRegistryOwner`.
    *   [X] Test `transferRegistryOwnership`.
    *   [X] **Detailed Sub-Tasks & Review Notes (for registryAdminService.test.js):**
        *   [X] Refactor timestamp generation in `deploySessionForAdminTests` helper (if specific to this file, or ensure general helper is used correctly) to use `provider.getBlock('latest').timestamp`.
        *   [X] Review and potentially remove redundant `blockchainProviderService.initialize(provider)` call in `beforeEach`. (Removed)
        *   [X] Import `ParticipantRegistry.json` ABI directly in `transferRegistryOwnership` and `calculateRewards` tests for event parsing (instead of `factoryService.getContractABI`).
        *   [X] Enhance `calculateRewards` test: (All sub-points addressed)
            *   [X] Crucially, simulate share submission for at least one participant (e.g., direct call to `registryContract.recordShareSubmission(sessionId, participantAddress)` using `deployerSigner` or ensure a mock `voteSessionVotingService.submitDecryptionShare` is successful prior) to make them eligible for rewards. (Done via `voteSessionVotingService`)
            *   [X] Before calling `registryAdminService.calculateRewards`, ensure the conditions are met for `VoteSession.isRewardCalculationPeriodActive()` to be true. This involves advancing time past `sharesEndDate` and potentially checking this state via `voteSessionViewService`. (Done)
            *   [X] The `registryAdminService.calculateRewards` method itself should ideally perform a pre-check for `isRewardCalculationPeriodActive` (from the associated VoteSession contract) and throw a service-level error if not active. The test should then also cover this scenario. (Test for inactive period added)
            *   [X] After a successful `calculateRewards` call (and if a participant was eligible), assert that `registryFundService.getRewardsOwed(sessionId, participantAddress)` returns a value greater than 0. (Done)
        *   [X] Implement the placeholder test for `setVoteSessionContract` (if not already covered by factory deployment implicitly): (Implemented with success and non-admin cases)
            *   [X] Setup: Deploy a session pair (yields Registry A, linked to Session A).
            *   [X] Deploy a *new, separate* `VoteSession` contract instance (Session B).
            *   [X] As admin, call `registryAdminService.setVoteSessionContract(sessionIdForRegistryA, addressOfSessionB)`.
            *   [X] Verify any event emitted by `ParticipantRegistry.setVoteSessionContract`.
            *   [ ] Verify that a subsequent call to `ParticipantRegistry.voteSession()` (via a direct read or a view service if available) on Registry A now returns the address of Session B. (Event checked, direct read verification is a TODO within test)
*   [NR] **`voteSessionAdminService.test.js`:**
    *   [ ] Setup: Deploy session.
    *   [ ] Test `setDecryptionParameters`.
    *   [ ] Test `transferSessionOwnership`.
    *   [ ] Test `updateSessionStatus` (may require time advancement to trigger status changes).
    *   [ ] Test `triggerRewardCalculation`.
    *   [ ] **Detailed Sub-Tasks & Review Notes:**
        *   [ ] Refactor timestamp generation in `deploySessionForVoteAdminTests` helper to use `provider.getBlock('latest').timestamp`.
        *   [ ] Review and potentially remove redundant `blockchainProviderService.initialize(provider)` call in `beforeEach`.
        *   [ ] Import `VoteSession.json` ABI directly in `transferSessionOwnership` test for event parsing.
        *   [ ] In `transferSessionOwnership` test, uncomment and use `voteSessionViewService.getSessionOwner()` to verify the new owner state after transfer.
        *   [ ] Implement placeholder test for `setDecryptionParameters`:
            *   [ ] Setup: Register mock holders.
            *   [ ] Generate mock alpha shares (e.g., `bytes32[]`) and a threshold `uint256`.
            *   [ ] Call `voteSessionAdminService.setDecryptionParameters()`.
            *   [ ] Verify event emission (e.g., `DecryptionParametersSet`) and use `voteSessionViewService.getDecryptionParameters()` to check stored values.
        *   [ ] Implement placeholder test for `updateSessionStatus`:
            *   [ ] Test transitions through different session states by advancing time past `startDate`, `endDate`, `sharesEndDate`.
            *   [ ] Call `voteSessionAdminService.updateSessionStatus()` after each time advancement.
            *   [ ] Use `voteSessionViewService.getStatus()` to verify the `currentStatus`.
        *   [ ] Implement placeholder test for `triggerRewardCalculation` (VoteSession context):
            *   [ ] Setup: Cast votes, submit shares (can be mocked if focusing on admin action).
            *   [ ] Advance time past `sharesCollectionEndDate`.
            *   [ ] Call `voteSessionAdminService.triggerRewardCalculation()`.
            *   [ ] Verify `RewardsCalculationTriggered` event from `VoteSession.sol`.
*   [R] **`voteSessionVotingService.test.js`:** (Refactored, needs run)
    *   [X] Setup: Deploy session, register participants as holders. (Enhanced in beforeEach blocks)
    *   [X] Test `castEncryptedVote`:
        *   [X] Successful vote casting (aligned with contract signature).
        *   [X] Preventing voting outside period or if not registered (specific error expected).
    *   [X] Test `submitDecryptionShare`:
        *   [X] Successful submission within `SharesCollectionOpen` period (parameters aligned, vote cast prior).
        *   [X] Preventing submission outside period (specific error expected).
    *   [X] Test `submitDecryptionValue`:
        *   [X] Successful submission (vote & share submitted prior).
        *   [X] Dependency on share submission (tested with another user, specific error expected).
    *   [X] **Detailed Sub-Tasks & Review Notes:** (All addressed)
        *   [X] Refactor timestamp generation in `deploySessionForVotingTests` helper to use `provider.getBlock('latest').timestamp`.
        *   [X] Review and potentially remove redundant `blockchainProviderService.initialize(provider)` call in `beforeEach`. (Removed)
        *   [X] `castEncryptedVote` test:
            *   [X] Align test parameters with the actual parameters expected by `voteSessionVotingService.castEncryptedVote` that map to the contract signature (`_ciphertext`, `_g1r`, `_g2r`, `_alpha`, `_threshold`).
            *   [X] Update event parsing to match the actual `EncryptedVoteCast` event (`sessionId`, `voter`, `voteIndex`).
        *   [X] `submitDecryptionShare` test:
            *   [X] Provide necessary `_voteIndex` and `_shareIndex` parameters if the service method expects them to align with the contract.
            *   [X] Update event parsing to match the actual `DecryptionShareSubmitted` event (`sessionId`, `holder`, `voteIndex`, `shareIndex`).
        *   [X] `submitDecryptionValue` test:
            *   [X] Update event parsing to match the actual `DecryptionValueSubmitted` event (`sessionId`, `holder`, `index`, `value`).
        *   [X] Import `VoteSession.json` ABI directly in the test file for event parsing, instead of using `factoryService.getContractABI`. (Done)
        *   [X] For period check tests (e.g., `should prevent casting vote if not voting period`), enhance error assertions to expect specific messages (e.g., `/Voting period is not active/i`) if the service throws them. (Done)
*   [NR] **`voteSessionViewService.test.js`:**
    *   [ ] Setup: Deploy session, potentially perform actions like registration/voting to populate data.
    *   [X] Test all getter functions for accuracy:
        *   [X] `isRegistrationOpen`, `getRequiredDeposit`, `isRewardCalculationPeriodActive`, `isDepositClaimPeriodActive`. (Tested)
        *   [F] `getSessionDetails`, `getSessionInfo`. (CONTRACT_API.md outdated. `getSessionDetails` contract method missing, test commented out. `getSessionInfo` service/test updated based on actual contract tuple.)
        *   [X] `getStatus`. (Tested)
        *   [X] `getEncryptedVote`, `getNumberOfVotes`. (Tested)
        *   [X] `getDecryptionShare`, `getNumberOfSubmittedShares`. (Tested)
        *   [X] `getDecryptionParameters`, `getSubmittedValues`. (Tested)
        *   [X] `getSessionOwner`, `getSessionId`, `getParticipantRegistryAddress`, `getTitle`, `getDescription`. (Tested)
    *   [X] **Detailed Sub-Tasks & Review Notes:** (All addressed)
        *   [X] Refactor timestamp generation in `deploySessionForVoteViewTests` helper to use `provider.getBlock('latest').timestamp`.
        *   [X] Review and potentially remove redundant `blockchainProviderService.initialize(provider)` call in `beforeEach`.
        *   [X] Refine `isRegistrationOpen should be false after endDate` test:
            *   [X] Ensure time is advanced past `sessionParams.startDate` (which is `registrationEndDate`) not `sessionParams.endDate` to correctly test `isRegistrationOpen` becoming false. (Addressed)
            *   [X] Consider splitting period checks into distinct tests for each relevant function (`isVotingPeriodActive`, `isSharesCollectionPeriodActive`, etc.) with appropriate time advancements. (Addressed by individual tests for period-dependent functions)
        *   [X] Correct `castEncryptedVote` parameters in the `beforeEach` for 'Vote and Share Data Getters': Ensure parameters passed align with what `voteSessionVotingService.castEncryptedVote` expects and can map to the contract signature (`_ciphertext`, `_g1r`, `_g2r`, `_alpha`, `_threshold`). (Addressed)
        *   [X] Correct `getEncryptedVote` assertion: Change `expect(vote).toBe(ethers.hexlify(mockVoteData))` to `expect(vote.ciphertext).toBe(ethers.hexlify(mockVoteData))` as the service method returns an object. (Addressed)
        *   [X] Implement placeholder `TODO` tests for `isRewardCalculationPeriodActive`, `isDepositClaimPeriodActive`, `getDecryptionShare`, `getNumberOfSubmittedShares`, `getDecryptionParameters`, and `getSubmittedValues` with appropriate time advancements and setup. (All implemented)
        *   [X] Verified: VoteSession.sol does NOT have a public getSessionDetails() method, despite CONTRACT_API.md listing it. Service method requires refactoring/removal.
        *   [X] Corrected data parsing in voteSessionViewService.getSessionInfo based on the actual 10-element tuple returned by VoteSession.sol's getSessionInfo() method (CONTRACT_API.md signature was outdated). Test assertions updated accordingly.

### 6. Testing Utilities and E2E (`frontend/test/`)

This section details the testing strategy for pure JavaScript utilities and a revised approach to End-to-End (E2E) testing.

*   [X] **Setup Vitest Framework:** Ensure Vitest is configured and running for the frontend.
*   [ ] **Mocking Strategy:** (This section is largely deprecated by the live Hardhat node testing for services)
    *   [ ] **Smart Contract Interactions:**
        *   [ ] Develop a robust strategy for mocking `ethers.js.Contract` interactions. This can be achieved by:
            *   [ ] Creating mock JavaScript classes that implement the same interface as `ethers.js.Contract`.
            *   [ ] Using libraries like `jest-ethers` (if compatible with Vitest) or manually mocking provider/signer calls.
            *   [ ] Mock implementations should allow simulating successful calls, reverts with specific error messages, event emissions, and different return values.
        *   [ ] Consider a `MockBlockchainProvider` that can be injected into services during tests.
    *   [ ] **Data Management for Unit Tests:** (This is relevant for utility tests)
        *   [ ] Create sets of mock data for function inputs (e.g., sample keys, ciphertexts, shares) to be used across utility tests.
        *   [ ] Store these directly in test files or in `frontend/test/fixtures/` if they become extensive.

*   [ ] **Unit Tests for Utilities (`frontend/test/utils/`) - (Deprioritized for now, focus on service integration tests first. Revisit for completion later.)**
    *   [ ] Create separate test files for each utility (e.g., `cryptographyUtils.test.js`, `aesUtils.test.js`, `conversionUtils.test.js`). These tests do not interact with the blockchain.
    *   [ ] **`cryptographyUtils.test.js`**: (Refactor to test remaining functions)
        *   [ ] Test `calculateNullifier` for consistent output given same inputs.
        *   [ ] Test `generateZkProof` (mock) returns the defined error or placeholder.
        *   [ ] Test `calculateDecryptionValue` for correct output format and AES interaction.
        *   [ ] Include tests for edge cases and expected failures/error throwing for invalid inputs.
    *   [ ] **`shamirUtils.test.js`**: (New file)
        *   [ ] Test `getKAndSecretShares` with various thresholds and participant counts. Verify share properties.
        *   [ ] Test `recomputeKey` with correct and incorrect sets of shares. Test AES key derivation.
    *   [ ] **`blsCryptoUtils.test.js`**: (New file)
        *   [ ] Test `generateBLSKeyPair` for valid key pair generation.
        *   [ ] Test `calculateDecryptionShareForSubmission` against expected outputs given mock inputs.
        *   [ ] Test `verifyShares` for correct BLS pairing logic.
    *   [ ] **`voteCryptoUtils.test.js`**: (New file)
        *   [ ] Test `encodeVoteToPoint` for consistent output given same inputs.
        *   [ ] Test `decodePointToVote` for correct inverse mapping.
        *   [ ] Test `encryptVoteData` for correct AES-GCM encryption.
        *   [ ] Test `decryptVote` for correct AES-GCM decryption.
    *   [ ] **`aesUtils.test.js`**:
        *   [ ] Test `encryptWithPassword` for correct AES-256 encryption.
        *   [ ] Test `decryptWithPassword` for correct AES-256 decryption.
        *   [ ] Test `encryptAES_GCM` for correct AES-GCM encryption.
        *   [ ] Test `decryptAES_GCM` for correct AES-GCM decryption.
    *   [ ] **`conversionUtils.test.js`**:
        *   [ ] Test `hexToBytes` for correct conversion of hex strings to bytes.
        *   [ ] Test `bytesToHex` for correct conversion of bytes to hex strings.
        *   [ ] Test `bigIntToHex` for correct conversion of BigInt to hex.
        *   [ ] Test `stringToBigInt` for correct conversion of strings to BigInt.
        *   [ ] Test `bigIntTo32Bytes` for correct conversion of BigInt to 32-byte arrays.
        *   [ ] Test `pointToBigint` for correct conversion of point data to BigInt.
    *   [ ] **`blsPointUtils.test.js`**:
        *   [ ] Test `genR` for correct generation of R point.
        *   [ ] Test `getG1R` for correct generation of g1R point.
        *   [ ] Test `getG2R` for correct generation of g2R point.
        *   [ ] Test `computePkRValue` for correct computation of PKR value.
    *   [ ] **`lagrangeUtils.test.js`**:
        *   [ ] Test `modInverse` for correct modular inverse computation.
        *   [ ] Test `lagrangeBasis` for correct Lagrange basis computation.
        *   [ ] Test `lagrangeInterpolate` for correct Lagrange interpolation computation.
    *   [ ] **`constants.test.js`**:
        *   [ ] Test `FIELD_ORDER` definition for correct curve parameter.
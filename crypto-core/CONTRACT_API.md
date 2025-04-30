# Smart Contract API Documentation (Refactored)

This document provides a guide to the functions and events of the refactored smart contract system, consisting of `VoteSessionFactory`, `VoteSession`, and `ParticipantRegistry`.

## Overview

The system now uses a factory pattern:

1.  **`VoteSessionFactory`**: Deploys new timed-release sessions. Each deployment creates a linked pair of `VoteSession` and `ParticipantRegistry` contracts.
2.  **`ParticipantRegistry`**: Manages participant data (holders/voters), deposits, reward funding, share submission status, and claims across all sessions deployed by its associated factory. It is the central hub for participant and fund management.
3.  **`VoteSession`**: Manages the lifecycle, parameters, voting process, and share submission logic for a *single* timed-release session. It interacts with the `ParticipantRegistry` for participant data and status updates.

## `VoteSessionFactory.sol`

**Purpose:** Deploys and tracks linked pairs of `VoteSession` and `ParticipantRegistry` contracts.

### Functions

*   **(constructor)**
    *   `constructor(address initialOwner)`
    *   Sets the initial owner of the factory.
*   **`createSessionPair(...)`**
    *   `createSessionPair(string memory _title, string memory _description, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, string[] memory _options, string memory _metadata, uint256 _requiredDeposit, uint256 _minShareThreshold) external returns (uint256 sessionId, address voteSessionContract, address participantRegistryContract)`
    *   Deploys a new `VoteSession` and `ParticipantRegistry` contract pair.
    *   Links the two contracts together.
    *   Stores the addresses internally, indexed by a new `sessionId`.
    *   Emits `SessionPairDeployed` event.
    *   **Requirements:** Called by any address (consider adding `onlyOwner` if needed).
*   **`getDeployedSessionCount()`**
    *   `getDeployedSessionCount() external view returns (uint256)`
    *   Returns the total number of session pairs deployed by this factory.
*   **`getSessionAddressesById(uint256 _sessionId)`**
    *   `getSessionAddressesById(uint256 _sessionId) external view returns (address voteSessionContract, address participantRegistryContract)`
    *   Returns the deployed addresses for a given `sessionId`.
*   **`getVoteSessionAddressById(uint256 _sessionId)`**
    *   `getVoteSessionAddressById(uint256 _sessionId) external view returns (address)`
    *   Returns the `VoteSession` contract address for a given `sessionId`.
*   **`getRegistryAddressById(uint256 _sessionId)`**
    *   `getRegistryAddressById(uint256 _sessionId) external view returns (address)`
    *   Returns the `ParticipantRegistry` contract address for a given `sessionId`.
*   **`getVoteSessionAddressByIndex(uint256 _index)`**
    *   `getVoteSessionAddressByIndex(uint256 _index) external view returns (address)`
    *   Returns the `VoteSession` contract address for a given deployment index.
*   **`owner()`** (Inherited from Ownable)
    *   `owner() public view returns (address)`
    *   Returns the current owner of the factory.
*   **`transferOwnership(address newOwner)`** (Inherited from Ownable)
    *   `transferOwnership(address newOwner) public onlyOwner`
    *   Transfers ownership of the factory to a new address.

### Events

*   **`SessionPairDeployed(uint256 indexed sessionId, address indexed voteSessionContract, address indexed participantRegistryContract)`**
    *   Emitted when `createSessionPair` successfully deploys a new pair of contracts.
*   **`OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`** (Inherited from Ownable)
    *   Emitted when ownership is transferred.

---

## `ParticipantRegistry.sol`

**Purpose:** Manages participant registration, data, deposits, rewards, and claims across multiple sessions associated with a factory.

### Functions

*   **(constructor)**
    *   `constructor(address initialOwner)`
    *   Sets the initial owner of the registry.
*   **`setVoteSessionContract(uint256 sessionId, address sessionContract)`**
    *   `setVoteSessionContract(uint256 sessionId, address sessionContract) external onlyOwner`
    *   Links a specific `sessionId` to its corresponding `VoteSession` contract address. *Crucial step after deployment if not linked automatically by the factory (current design requires external call).*.\
    *   **Requirements:** `onlyOwner`. `sessionContract` cannot be zero. `sessionId` must not already be set.
*   **`addRewardFunding(uint256 sessionId)`**
    *   `addRewardFunding(uint256 sessionId) external payable onlyOwner`
    *   Allows the owner to add external ETH funding to the reward pool for a specific session.
    *   **Requirements:** `onlyOwner`. Session must exist (`voteSessionContracts[sessionId]` must be set). `msg.value` must be positive.
*   **`joinAsHolder(uint256 sessionId, string memory blsPublicKeyHex)`**
    *   `joinAsHolder(uint256 sessionId, string memory blsPublicKeyHex) external payable nonReentrant`
    *   Allows a user to register as a Holder for a specific session.
    *   Stores participant info (including BLS key) and deposit amount.
    *   **Requirements:** Session must exist. Registration must be open (checked via call to `VoteSession`). User must not be already registered. Must send exact `requiredDeposit` amount (obtained via call to `VoteSession`).
*   **`registerAsVoter(uint256 sessionId)`**
    *   `registerAsVoter(uint256 sessionId) external nonReentrant`
    *   Allows a user to register as a non-depositing Voter for a specific session.
    *   **Requirements:** Session must exist. Registration must be open. User must not be already registered.
*   **`recordShareSubmission(uint256 sessionId, address holder)`**
    *   `recordShareSubmission(uint256 sessionId, address holder) external onlyVoteSession(sessionId)`
    *   Marks a holder as having submitted their shares for a session. Called *by* the corresponding `VoteSession` contract.
    *   **Requirements:** Caller must be the linked `VoteSession` contract. Participant must be a holder. Shares must not have been previously recorded for this holder/session.
*   **`calculateRewards(uint256 sessionId)`**
    *   `calculateRewards(uint256 sessionId) external nonReentrant`
    *   Calculates the reward distribution for a session based on forfeited deposits and external funding.
    *   Assigns `rewardsOwed` to eligible holders (those who submitted shares).
    *   Can be called by the owner *or* the linked `VoteSession` contract (e.g., via `triggerRewardCalculation`).
    *   **Requirements:** Session must exist. Reward calculation period must be active (checked via call to `VoteSession`). Reward pool (forfeits + funding) must be > 0. At least one eligible holder must exist.
*   **`claimReward(uint256 sessionId)`**
    *   `claimReward(uint256 sessionId) external nonReentrant`
    *   Allows an eligible participant (who submitted shares and had rewards calculated) to claim their reward via a pull payment.
    *   **Requirements:** Reward must not have been already claimed. `rewardsOwed` must be > 0 for the caller. Sends ETH via `call`.
*   **`claimDeposit(uint256 sessionId)`**
    *   `claimDeposit(uint256 sessionId) external nonReentrant`
    *   Allows a holder who submitted shares to reclaim their original deposit via a pull payment.
    *   **Requirements:** Session must exist. Deposit claim period must be active (checked via call to `VoteSession`). Caller must be a holder. Deposit must not have been already claimed. Caller must have submitted shares (`hasSubmittedShares == true`). Deposit amount must be > 0. Sends ETH via `call`.
*   **`getParticipantInfo(uint256 sessionId, address participant)`**
    *   `getParticipantInfo(uint256 sessionId, address participant) external view returns (Structs.ParticipantInfo memory)`
    *   Returns the registration status, role, deposit, BLS key, and share submission status for a participant in a session.
*   **`getActiveHolders(uint256 sessionId)`**
    *   `getActiveHolders(uint256 sessionId) external view returns (address[] memory)`
    *   Returns an array of addresses for all registered holders in a session.
*   **`getNumberOfActiveHolders(uint256 sessionId)`**
    *   `getNumberOfActiveHolders(uint256 sessionId) external view returns (uint256)`
    *   Returns the count of registered holders in a session.
*   **`getHolderBlsKeys(uint256 sessionId)`**
    *   `getHolderBlsKeys(uint256 sessionId) external view returns (address[] memory, string[] memory)`
    *   Returns parallel arrays of holder addresses and their corresponding BLS public key hex strings for a session.
*   **`getTotalRewardPool(uint256 sessionId)`**
    *   `getTotalRewardPool(uint256 sessionId) external view returns (uint256)`
    *   Returns the amount of *externally added* reward funding for a session (does not include potential forfeited deposits until calculation).
*   **`participants(uint256 sessionId, address participant)`**
    *   `participants(uint256 sessionId, address participant) public view returns (...)`
    *   Public mapping accessor for participant info.
*   **`voteSessionContracts(uint256 sessionId)`**
    *   `voteSessionContracts(uint256 sessionId) public view returns (address)`
    *   Public mapping accessor for linked `VoteSession` addresses.
*   **`rewardsOwed(uint256 sessionId, address participant)`**
    *   `rewardsOwed(uint256 sessionId, address participant) public view returns (uint256)`
    *   Public mapping accessor for calculated rewards owed.
*   **`rewardClaimed(uint256 sessionId, address participant)`**
    *   `rewardClaimed(uint256 sessionId, address participant) public view returns (bool)`
    *   Public mapping accessor for reward claim status.
*   **`depositClaimed(uint256 sessionId, address participant)`**
    *   `depositClaimed(uint256 sessionId, address participant) public view returns (bool)`
    *   Public mapping accessor for deposit claim status.
*   **`owner()` / `transferOwnership(...)`** (Inherited)

### Events

*   **`VoteSessionContractSet(uint256 indexed sessionId, address indexed sessionContract)`**
*   **`HolderRegistered(uint256 indexed sessionId, address indexed holder, uint256 depositAmount, string blsPublicKeyHex)`**
*   **`VoterRegistered(uint256 indexed sessionId, address indexed voter)`**
*   **`SharesSubmissionRecorded(uint256 indexed sessionId, address indexed holder)`**
*   **`RewardsCalculated(uint256 indexed sessionId, address indexed calculator, uint256 totalRewardPoolCalculated)`**
*   **`RewardClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount)`**
*   **`DepositClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount)`**
*   **`OwnershipTransferred(...)`** (Inherited)

---

## `VoteSession.sol`

**Purpose:** Manages the lifecycle and voting process for a single session.

### Structs (Internal)
*   `EncryptedVote`: Stores data for a single cast vote (ciphertext, voter, threshold, etc.).
*   `DecryptionShare`: Stores data for a single submitted decryption share (voteIndex, holder, share data, etc.).

### Enums (Internal)
*   `SessionStatus`: Defines the different lifecycle states (Created, RegistrationOpen, VotingOpen, SharesCollectionOpen, Completed, Aborted).

### Functions

*   **(constructor)**
    *   `constructor(uint256 _sessionId, address _registryAddress, address _initialOwner, string memory _title, ...)`
    *   Initializes the session with its parameters (title, dates, options, deposit, threshold, etc.).
    *   Stores the associated `sessionId` and `ParticipantRegistry` address.
    *   Sets the initial status based on `block.timestamp` and `startDate`.
*   **`updateSessionStatus()`**
    *   `updateSessionStatus() public`
    *   Advances the `currentStatus` based on `block.timestamp` and the configured `startDate`, `endDate`, `sharesCollectionEndDate`.
    *   Callable by anyone.
*   **`castEncryptedVote(...)`**
    *   `castEncryptedVote(bytes memory ciphertext, bytes memory g1r, bytes memory g2r, bytes[] memory alpha, uint256 threshold) external nonReentrant`
    *   Allows a registered participant (voter or holder) to cast their encrypted vote.
    *   Checks status (`VotingOpen`), voter registration (via call to Registry), `hasVoted` mapping, and threshold.
    *   Stores the `EncryptedVote` data.
    *   Marks the voter as having voted.
*   **`submitDecryptionShares(...)`**
    *   `submitDecryptionShares(uint256[] memory voteIndices, uint256[] memory shareIndices, bytes[] memory shareDataList) external nonReentrant`
    *   Allows a registered holder to submit their decryption shares.
    *   Checks status (`SharesCollectionOpen`), holder status (via call to Registry), if shares already submitted (via call to Registry).
    *   Stores the `DecryptionShare` data.
    *   Calls `participantRegistry.recordShareSubmission()` to mark the holder as having submitted.
*   **`triggerRewardCalculation()`**
    *   `triggerRewardCalculation() external nonReentrant`
    *   Allows anyone to trigger the reward calculation process *in the registry* after the session is completed.
    *   Checks status (`Completed`), prevents multiple triggers.
    *   Calls `participantRegistry.calculateRewards()`.\
*   **`isRegistrationOpen()`**
    *   `isRegistrationOpen() external view returns (bool)`
    *   View function called *by the Registry* to check if registration is allowed based on `block.timestamp` and `registrationEndDate` (`startDate`).
*   **`getRequiredDeposit()`**
    *   `getRequiredDeposit() external view returns (uint256)`
    *   View function called *by the Registry* to get the deposit amount for this session.
*   **`isRewardCalculationPeriodActive()`**
    *   `isRewardCalculationPeriodActive() external view returns (bool)`
    *   View function called *by the Registry* to check if the time is after `sharesCollectionEndDate`.
*   **`isDepositClaimPeriodActive()`**
    *   `isDepositClaimPeriodActive() external view returns (bool)`
    *   View function called *by the Registry* to check if the time is after `sharesCollectionEndDate`.
*   **`getSessionDetails()`**
    *   `getSessionDetails() external view returns (...)`
    *   Returns key details of the session (ID, status, title, dates, deposit, threshold).
*   **`getEncryptedVote(uint256 voteIndex)`**
    *   `getEncryptedVote(uint256 voteIndex) external view returns (EncryptedVote memory)`
    *   Returns the data for a specific encrypted vote by its index.
*   **`getNumberOfVotes()`**
    *   `getNumberOfVotes() external view returns (uint256)`
    *   Returns the total number of encrypted votes cast.
*   **`getDecryptionShare(uint256 shareLogIndex)`**
    *   `getDecryptionShare(uint256 shareLogIndex) external view returns (DecryptionShare memory)`
    *   Returns the data for a specific submitted share by its index in the `decryptionShares` array.
*   **`getNumberOfSubmittedShares()`**
    *   `getNumberOfSubmittedShares() external view returns (uint256)`
    *   Returns the total number of decryption shares submitted.
*   **`getSessionInfo()`**
    *   `getSessionInfo() public view returns (...)`
    *   Returns detailed session parameters.
*   **`getStatus()`**
    *   `getStatus() public view returns (SessionStatus)`
    *   Returns the current calculated status based on time (more accurate than relying solely on `currentStatus` state variable if `updateSessionStatus` hasn't been called recently).
*   **`getParticipantInfo(address participant)`**
    *   `getParticipantInfo(address participant) external view returns (Structs.ParticipantInfo memory)`
    *   Convenience view function that calls the registry to get participant info for this session.
*   **`title()`, `description()`, ... etc.**
    *   Public state variable accessors.
*   **`hasVoted(address voter)`**
    *   `hasVoted(address voter) public view returns (bool)`
    *   Public mapping accessor.
*   **`rewardsCalculatedTriggered()`**
    *   `rewardsCalculatedTriggered() public view returns (bool)`
    *   Public accessor for the trigger flag.
*   **`owner()` / `transferOwnership(...)`** (Inherited)

### Events

*   **`SessionStatusChanged(uint256 indexed sessionId, SessionStatus newStatus)`**
*   **`EncryptedVoteCast(uint256 indexed sessionId, address indexed voter, uint256 voteIndex)`**
*   **`DecryptionShareSubmitted(uint256 indexed sessionId, address indexed holder, uint256 voteIndex, uint256 shareIndex)`**
*   **`RewardsCalculationTriggered(uint256 indexed sessionId, address indexed triggerer)`**
*   **`OwnershipTransferred(...)`** (Inherited)

---

## Interaction Flow Example (High Level)

1.  **Deployment:** Admin/User deploys `VoteSessionFactory`.
2.  **Session Creation:** Admin/User calls `factory.createSessionPair(...)` -> Factory deploys `VoteSession` and `ParticipantRegistry`, emits event with addresses and `sessionId`.
3.  **(Manual Linking):** Admin calls `registry.setVoteSessionContract(sessionId, voteSessionAddress)` (based on event data from step 2).
4.  **Funding (Optional):** Admin calls `registry.addRewardFunding(sessionId)` with ETH.
5.  **Registration:** Users call `registry.joinAsHolder(...)` (with deposit) or `registry.registerAsVoter(...)` for the specific `sessionId`.
6.  **Voting:** Registered users call `voteSession.castEncryptedVote(...)`.
7.  **Share Submission:** Holders call `voteSession.submitDecryptionShares(...)` -> `VoteSession` calls `registry.recordShareSubmission(...)`.
8.  **Reward Trigger:** Anyone calls `voteSession.triggerRewardCalculation()` -> `VoteSession` calls `registry.calculateRewards(...)`.
9.  **Claims:** Eligible holders call `registry.claimReward(sessionId)` and/or `registry.claimDeposit(sessionId)`.

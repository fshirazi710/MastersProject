# Smart Contract API Documentation (Refactored & Upgradeable)

This document provides a guide to the functions, events, and state variables of the refactored, upgradeable smart contract system, consisting of `VoteSessionFactory`, `VoteSession`, and `ParticipantRegistry`.

## Overview

The system uses a factory pattern with upgradeable contracts:

1.  **`VoteSessionFactory`**: A non-upgradeable contract that deploys new timed-release sessions using the EIP-1167 Clones pattern. Each deployment creates a linked pair of *upgradeable* `VoteSession` and `ParticipantRegistry` proxy contracts.
2.  **`ParticipantRegistry`**: An upgradeable contract managing participant data (holders/voters), deposits, reward funding, share submission status, and claims across all sessions deployed by its associated factory. It is the central hub for participant and fund management. Initialized via `initialize(address initialOwner)`.
3.  **`VoteSession`**: An upgradeable contract managing the lifecycle, parameters, voting process, share submission, and decryption coordination logic for a *single* timed-release session. It interacts with its linked `ParticipantRegistry` for participant data and status updates. Initialized via `initialize(...)`.

---

## `VoteSessionFactory.sol`

**Inherits:** `Ownable` (from OpenZeppelin - non-upgradeable version)

**Purpose:** Deploys and tracks linked pairs of `VoteSession` and `ParticipantRegistry` *proxy* contracts using the EIP-1167 Clones pattern.

### State Variables

*   `registryImplementation` (public immutable address): The address of the `ParticipantRegistry` implementation contract used for cloning.
*   `voteSessionImplementation` (public immutable address): The address of the `VoteSession` implementation contract used for cloning.
*   `deployedVoteSessions` (public address[]): An array storing the proxy addresses of all deployed `VoteSession` contracts.
*   `voteSessionAddresses` (public mapping(uint256 => address)): Maps a session ID to the corresponding `VoteSession` proxy address.
*   `registryAddresses` (public mapping(uint256 => address)): Maps a session ID to the corresponding `ParticipantRegistry` proxy address.
*   `nextSessionId` (private uint256): Counter for assigning sequential session IDs.

### Events

*   **`SessionPairDeployed(uint256 indexed sessionId, address indexed voteSessionContract, address indexed participantRegistryContract, address owner)`**
    *   Emitted when `createSessionPair` successfully deploys and initializes a new pair of proxy contracts.
    *   `voteSessionContract`: The *proxy* address of the new `VoteSession` contract.
    *   `participantRegistryContract`: The *proxy* address of the new `ParticipantRegistry` contract.
    *   `owner`: The address set as the owner for both new proxy contracts (factory owner).
*   **`OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`** (Inherited from Ownable)
    *   Emitted when factory ownership is transferred.

### Functions

*   **`(constructor)`**
    *   `constructor(address initialOwner, address _registryImplementation, address _voteSessionImplementation)`
    *   Sets the initial owner of the factory and stores the implementation addresses for the contracts to be cloned.
*   **`createSessionPair(...)`**
    *   `createSessionPair(string memory _title, string memory _description, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, string[] memory _options, string memory _metadata, uint256 _requiredDeposit, uint256 _minShareThreshold) external onlyOwner returns (address voteSessionProxyAddress_, address registryProxyAddress_)`
    *   Deploys clones (proxies) of `ParticipantRegistry` and `VoteSession` using the stored implementation addresses.
    *   Initializes both clones via their respective `initialize` functions, setting the factory owner as the owner of the new contracts and passing the registry proxy address to the vote session initializer.
    *   Assigns the next available `sessionId`.
    *   Stores the proxy addresses in the tracking mappings/array.
    *   Emits the `SessionPairDeployed` event.
    *   **Requirements:** `onlyOwner`. Parameters define the properties of the new `VoteSession`.
    *   **Returns:** The proxy addresses of the newly deployed `VoteSession` and `ParticipantRegistry`.
*   **`getDeployedSessionCount()`**
    *   `getDeployedSessionCount() external view returns (uint256)`
    *   Returns the total number of session pairs deployed by this factory.
*   **`getVoteSessionAddressByIndex(uint256 index)`**
    *   `getVoteSessionAddressByIndex(uint256 index) external view returns (address)`
    *   Returns the `VoteSession` proxy address at a specific index in the `deployedVoteSessions` array. Reverts if index is out of bounds.
*   **`getVoteSessionAddressById(uint256 sessionId_)`**
    *   `getVoteSessionAddressById(uint256 sessionId_) external view returns (address)`
    *   Returns the `VoteSession` proxy address for a given `sessionId`. Reverts if ID not found.
*   **`getRegistryAddressById(uint256 sessionId_)`**
    *   `getRegistryAddressById(uint256 sessionId_) external view returns (address)`
    *   Returns the `ParticipantRegistry` proxy address for a given `sessionId`. Reverts if ID not found.
*   **`owner()`** (Inherited)
    *   `owner() public view returns (address)`
    *   Returns the current owner of the factory.
*   **`transferOwnership(address newOwner)`** (Inherited)
    *   `transferOwnership(address newOwner) public onlyOwner`
    *   Transfers ownership of the factory to a new address.

---

## `ParticipantRegistry.sol`

**Inherits:** `Initializable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` (from OpenZeppelin)

**Purpose:** Manages participant registration, data, deposits, rewards, and claims across multiple sessions associated with a factory. Designed to be deployed as an upgradeable proxy.

### State Variables

*   `participants` (public mapping(uint256 => mapping(address => Structs.ParticipantInfo))): Stores participant details per session.
*   `totalRewardPool` (public mapping(uint256 => uint256)): Stores *externally added* reward funding per session. Does not include forfeited deposits until calculation.
*   `activeHolders` (private mapping(uint256 => EnumerableSet.AddressSet)): Set of registered holders per session.
*   `voteSessionContracts` (public mapping(uint256 => address)): Maps session ID to the linked `VoteSession` contract address.
*   `rewardsOwed` (public mapping(uint256 => mapping(address => uint256))): Calculated rewards owed to participants per session.
*   `rewardClaimed` (public mapping(uint256 => mapping(address => bool))): Tracks if a participant has claimed their reward for a session.
*   `depositClaimed` (public mapping(uint256 => mapping(address => bool))): Tracks if a holder has claimed their deposit for a session.

### Events

*   **`VoteSessionContractSet(uint256 indexed sessionId, address indexed sessionContract)`**
*   **`HolderRegistered(uint256 indexed sessionId, address indexed holder, uint256 depositAmount, string blsPublicKeyHex)`**
*   **`VoterRegistered(uint256 indexed sessionId, address indexed voter)`**
*   **`SharesSubmissionRecorded(uint256 indexed sessionId, address indexed holder)`**
*   **`RewardsCalculated(uint256 indexed sessionId, address indexed calculator, uint256 totalRewardPoolCalculated)`** (Note: `totalRewardPoolCalculated` includes funding + forfeits)
*   **`RewardClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount)`**
*   **`DepositClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount)`**
*   **`Initialized(uint8 version)`** (Inherited from Initializable)
*   **`OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`** (Inherited from OwnableUpgradeable)

### Functions

*   **`(constructor)`**
    *   `constructor()`
    *   Disabled initializer. Used only for the implementation contract deployment.
*   **`initialize(address initialOwner)`**
    *   `initialize(address initialOwner) public initializer`
    *   Initializes the contract instance (proxy), setting the initial owner. Called once per proxy deployment.
*   **`setVoteSessionContract(uint256 sessionId, address sessionContract)`**
    *   `setVoteSessionContract(uint256 sessionId, address sessionContract) external onlyOwner`
    *   Links a specific `sessionId` to its corresponding `VoteSession` contract address. *Needs to be called externally after the factory deploys the pair*, as the registry is initialized before the session address is known by the factory caller.
    *   **Requirements:** `onlyOwner`. `sessionContract` cannot be zero. `sessionId` must not already be set.
*   **`addRewardFunding(uint256 sessionId)`**
    *   `addRewardFunding(uint256 sessionId) external payable onlyOwner`
    *   Allows the owner to add external ETH funding to the reward pool for a specific session.
    *   **Requirements:** `onlyOwner`. Session must exist (`voteSessionContracts[sessionId]` must be set). `msg.value` must be positive.
*   **`joinAsHolder(uint256 sessionId, string memory blsPublicKeyHex)`**
    *   `joinAsHolder(uint256 sessionId, string memory blsPublicKeyHex) external payable nonReentrant`
    *   Allows a user to register as a Holder for a specific session. Stores participant info (including BLS key) and deposit amount. Adds holder to `activeHolders`.
    *   **Requirements:** Session must exist (`voteSessionContracts[sessionId]` must be set). Registration must be open (checked via call to `VoteSession.isRegistrationOpen()`). User must not be already registered. Must send exact `requiredDeposit` amount (obtained via call to `VoteSession.getRequiredDeposit()`).
*   **`registerAsVoter(uint256 sessionId)`**
    *   `registerAsVoter(uint256 sessionId) external nonReentrant`
    *   Allows a user to register as a non-depositing Voter for a specific session.
    *   **Requirements:** Session must exist. Registration must be open. User must not be already registered.
*   **`recordShareSubmission(uint256 sessionId, address holder)`**
    *   `recordShareSubmission(uint256 sessionId, address holder) external onlyVoteSession(sessionId)`
    *   Marks a holder as having submitted their shares for a session. Called *by* the corresponding `VoteSession` contract's `submitDecryptionShare` function.
    *   **Requirements:** Caller must be the linked `VoteSession` contract for the `sessionId`. Participant must be a holder. Shares must not have been previously recorded for this holder/session.
*   **`calculateRewards(uint256 sessionId)`**
    *   `calculateRewards(uint256 sessionId) external nonReentrant`
    *   Calculates the reward distribution for a session. It sums `totalRewardPool[sessionId]` (external funding) and deposits forfeited by holders who didn't submit shares. Distributes this total pool evenly among eligible holders (those who *did* submit shares) by setting their `rewardsOwed`.
    *   **Requirements:** Session must exist. Caller must be owner *or* the linked `VoteSession` contract. Reward calculation period must be active (checked via call to `VoteSession.isRewardCalculationPeriodActive()`). Reward pool (forfeits + funding) must be > 0. At least one eligible holder must exist.
*   **`claimReward(uint256 sessionId)`**
    *   `claimReward(uint256 sessionId) external nonReentrant`
    *   Allows an eligible participant (who submitted shares and had rewards calculated) to claim their reward via a pull payment.
    *   **Requirements:** Reward must not have been already claimed. `rewardsOwed` must be > 0 for the caller. Sends ETH via `call`.
*   **`claimDeposit(uint256 sessionId)`**
    *   `claimDeposit(uint256 sessionId) external nonReentrant`
    *   Allows a holder who *submitted shares* to reclaim their original deposit via a pull payment.
    *   **Requirements:** Session must exist. Deposit claim period must be active (checked via call to `VoteSession.isDepositClaimPeriodActive()`). Caller must be a holder. Deposit must not have been already claimed. Caller must have submitted shares (`hasSubmittedShares == true`). Deposit amount must be > 0. Sends ETH via `call`.
*   **`getParticipantInfo(uint256 sessionId, address participant)`**
    *   `getParticipantInfo(uint256 sessionId, address participant) external view returns (Structs.ParticipantInfo memory)`
    *   Returns the `ParticipantInfo` struct for a participant in a session.
*   **`getActiveHolders(uint256 sessionId)`**
    *   `getActiveHolders(uint256 sessionId) external view returns (address[] memory)`
    *   Returns an array of addresses for all registered holders in a session using `EnumerableSet`.
*   **`getNumberOfActiveHolders(uint256 sessionId)`**
    *   `getNumberOfActiveHolders(uint256 sessionId) external view returns (uint256)`
    *   Returns the count of registered holders in a session using `EnumerableSet`.
*   **`getHolderBlsKeys(uint256 sessionId)`**
    *   `getHolderBlsKeys(uint256 sessionId) external view returns (address[] memory, string[] memory)`
    *   Returns parallel arrays of holder addresses and their corresponding BLS public key hex strings for a session.
*   **`getParticipantIndex(uint256 sessionId, address participant)`**
     *   `getParticipantIndex(uint256 sessionId, address participant) external view returns (uint256)`
     *   Returns the 1-based index of a holder within the `activeHolders` set for a given session. Returns 0 if not found. Used for decryption coordination.
*   **Public Accessors for Mappings:**
    *   `participants(sessionId, participant)` returns `(bool isRegistered, bool isHolder, uint256 depositAmount, string memory blsPublicKeyHex, bool hasSubmittedShares)`
    *   `totalRewardPool(sessionId)` returns `uint256`
    *   `voteSessionContracts(sessionId)` returns `address`
    *   `rewardsOwed(sessionId, participant)` returns `uint256`
    *   `rewardClaimed(sessionId, participant)` returns `bool`
    *   `depositClaimed(sessionId, participant)` returns `bool`
*   **`owner()` / `transferOwnership(...)`** (Inherited from OwnableUpgradeable)

---

## `VoteSession.sol`

**Inherits:** `Initializable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable` (from OpenZeppelin)

**Purpose:** Manages the lifecycle, voting process, share submission, and decryption coordination for a single session. Designed to be deployed as an upgradeable proxy. Interacts heavily with its linked `ParticipantRegistry`.

### Structs (Internal)

*   `EncryptedVote`: Stores data for a single cast vote (`ciphertext`, `g1r`, `g2r`, `alpha`, `voter`, `threshold`).
*   `DecryptionShare`: Stores data for a single submitted decryption share (`voteIndex`, `holderAddress`, `share`, `index`).

### Enums (Internal)

*   `SessionStatus`: Defines the different lifecycle states (`Created`, `RegistrationOpen`, `VotingOpen`, `SharesCollectionOpen`, `Completed`, `Aborted`).

### State Variables

*   **Session Parameters (Set in `initialize`)**
    *   `sessionId` (public uint256)
    *   `participantRegistry` (public IParticipantRegistry): Address of the linked registry contract.
    *   `title` (public string)
    *   `description` (public string)
    *   `registrationEndDate` (public uint256): Timestamp when registration closes (usually equals `startDate`).
    *   `startDate` (public uint256): Timestamp when voting opens.
    *   `endDate` (public uint256): Timestamp when voting closes.
    *   `sharesCollectionEndDate` (public uint256): Timestamp when share submission closes.
    *   `options` (public string[]): Voting options.
    *   `metadata` (public string): Auxiliary data (e.g., for UI).
    *   `requiredDeposit` (public uint256): Deposit amount needed for holders (read by registry).
    *   `minShareThreshold` (public uint256): Minimum threshold required for votes (?). *Note: Review purpose/usage.*
*   **Session State**
    *   `currentStatus` (public SessionStatus): Current lifecycle status, updated by `updateSessionStatus`.
    *   `encryptedVotes` (public EncryptedVote[]): Array storing cast votes.
    *   `decryptionShares` (public DecryptionShare[]): Array storing submitted shares.
    *   `hasVoted` (public mapping(address => bool)): Tracks if a participant has voted.
    *   `rewardsCalculatedTriggered` (public bool): Flag to prevent multiple reward calculation triggers *on the registry*.
*   **Dynamic Threshold State (New)**
    *   `actualMinShareThreshold` (public uint256): Stores the dynamically calculated and finalized minimum share threshold. Initialized to the `minShareThreshold` from `initialize`.
    *   `dynamicThresholdFinalized` (public bool): Flag indicating if `actualMinShareThreshold` has been finalized. Defaults to `false`.
*   **Decryption Coordination State**
    *   `alphas` (public bytes32[]): Decryption parameters set by owner.
    *   `decryptionThreshold` (public uint256): Required number of decryption values, set by owner.
    *   `submittedValues` (public mapping(address => bytes32)): holder => submitted decryption value (v_i).
    *   `submittedValueIndex` (public mapping(address => uint256)): holder => holder's 1-based index from registry.
    *   `hasSubmittedDecryptionValue` (public mapping(address => bool)): Tracks if a holder has submitted their decryption value.
    *   `valueSubmitters` (public address[]): Array storing addresses of holders who submitted values, in order.
    *   `submittedValueCount` (public uint256): Counter for submitted decryption values.
    *   `thresholdReached` (public bool): Flag indicating if the `decryptionThreshold` has been met.

### Events

*   **`SessionStatusChanged(uint256 indexed sessionId, SessionStatus newStatus)`**
*   **`EncryptedVoteCast(uint256 indexed sessionId, address indexed voter, uint256 voteIndex)`**
*   **`DecryptionShareSubmitted(uint256 indexed sessionId, address indexed holder, uint256 voteIndex, uint256 shareIndex)`**
*   **`DecryptionValueSubmitted(uint256 indexed sessionId, address indexed holder, uint256 index, bytes32 value)`**
*   **`DecryptionThresholdReached(uint256 indexed sessionId)`**
*   **`RewardsCalculationTriggered(uint256 indexed sessionId, address indexed triggerer)`**
*   **`DynamicMinShareThresholdSet(uint256 indexed sessionId, uint256 newThreshold, uint256 numberOfHolders)` (New)**
    *   Emitted by `updateSessionStatus` when it successfully calculates and sets the `actualMinShareThreshold` during the transition from `RegistrationOpen` to `VotingOpen`.
*   **`DynamicThresholdFinalizationSkipped(uint256 indexed sessionId, uint256 numberOfHolders, uint256 initialMinThreshold)` (New)**
    *   Emitted by `updateSessionStatus` if the dynamic threshold finalization attempt is skipped because the number of active holders was less than the initial `minShareThreshold` (from `initialize`) at the time of attempted finalization.
*   **`Initialized(uint8 version)`** (Inherited)
*   **`OwnershipTransferred(...)`** (Inherited)

### Functions

*   **`(constructor)`**
    *   `constructor()`
    *   Disabled initializer. Used only for the implementation contract deployment.
*   **`initialize(...)`**
    *   `initialize(uint256 _sessionId, address _registryAddress, address _initialOwner, string memory _title, string memory _description, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, string[] memory _options, string memory _metadata, uint256 _requiredDeposit, uint256 _minShareThreshold) public initializer`
    *   Initializes the contract instance (proxy) with all session parameters. Sets owner, links registry, sets dates, options, etc. Sets initial status to `Created`. `actualMinShareThreshold` is initially set to `_minShareThreshold`. The `_minShareThreshold` must be `>= 2`.
*   **`setDecryptionParameters(bytes32[] calldata _alphas, uint256 _threshold)`**
    *   `setDecryptionParameters(bytes32[] calldata _alphas, uint256 _threshold) external onlyOwner`
    *   Sets the `alphas` and `decryptionThreshold` required for the final decryption coordination phase.
    *   **Requirements:** `onlyOwner`. Can only be called once. Parameters must be valid (>0).
*   **`updateSessionStatus()`**
    *   `updateSessionStatus() public`
    *   Advances the `currentStatus` based on `block.timestamp` and the configured session dates (`startDate`, `endDate`, `sharesCollectionEndDate`). Callable by anyone. Should be called before status-dependent actions.
    *   **Dynamic Threshold Finalization (Integrated):** This logic is attempted *once* within `updateSessionStatus`. It occurs when the function is called and determines that `block.timestamp >= startDate` while the `currentStatus` is `RegistrationOpen` (i.e., the session is due to transition to `VotingOpen`), provided `dynamicThresholdFinalized` is `false`.
        1.  The function retrieves `numberOfActiveHolders` from the linked `ParticipantRegistry`.
        2.  **Viability Check:** It checks if `numberOfActiveHolders >= minShareThreshold` (the value set during `initialize`).
        3.  **If Viable:**
            *   `actualMinShareThreshold` is calculated based on `(numberOfActiveHolders / 2) + 1`.
            *   This calculated value is then adjusted: it will not be less than the initial `minShareThreshold` and not more than `numberOfActiveHolders`.
            *   `dynamicThresholdFinalized` is set to `true`.
            *   The `DynamicMinShareThresholdSet` event is emitted with the `sessionId`, the new `actualMinShareThreshold`, and the `numberOfActiveHolders`.
        4.  **If Not Viable (fewer holders than initial `minShareThreshold`):**
            *   The dynamic calculation is skipped. `actualMinShareThreshold` will effectively remain the value it was initialized with (i.e., the initial `minShareThreshold`).
            *   `dynamicThresholdFinalized` is set to `true` to prevent further attempts.
            *   The `DynamicThresholdFinalizationSkipped` event is emitted, indicating the `sessionId`, the `numberOfActiveHolders` found, and the `initialMinThreshold` that was not met for dynamic adjustment.
*   **`castEncryptedVote(...)`**
    *   `castEncryptedVote(bytes memory ciphertext, bytes memory g1r, bytes memory g2r, bytes[] memory alpha, uint256 threshold) external nonReentrant`
    *   Allows a registered participant (voter or holder) to cast their encrypted vote.
    *   **Requirements:** Status must be `VotingOpen`. Voter must be registered (checked via `Registry.getParticipantInfo`). Voter must not have already voted (`hasVoted` mapping).
    *   Stores the `EncryptedVote` data. Marks the voter as having voted. Emits `EncryptedVoteCast`.
*   **`submitDecryptionShare(uint256 _voteIndex, bytes calldata _share, uint256 _shareIndex)`**
    *   `submitDecryptionShare(uint256 _voteIndex, bytes calldata _share, uint256 _shareIndex) external nonReentrant`
    *   Allows a registered holder to submit their decryption share for a specific vote.
    *   **Requirements:** Status must be `SharesCollectionOpen`. Caller must be a registered holder (checked via Registry). Holder must not have already submitted shares (checked via Registry).
    *   Stores the `DecryptionShare` data. **Calls `participantRegistry.recordShareSubmission()` to mark the holder as having submitted in the registry.** Emits `DecryptionShareSubmitted`.
*   **`submitDecryptionValue(bytes32 _value)`**
    *   `submitDecryptionValue(bytes32 _value) external nonReentrant`
    *   Allows a holder who successfully submitted shares to submit their final decryption value (v_i).
    *   **Requirements:** Status must be `Completed` (or potentially `SharesCollectionOpen`? Check logic). Caller must be registered holder who *has submitted shares* (checked via Registry). Caller must not have submitted a value yet. Decryption parameters (`alphas`, `threshold`) must be set. `thresholdReached` must be false.
    *   Stores the value (`submittedValues`), the holder's index (`submittedValueIndex` - fetched from Registry), adds holder to `valueSubmitters`, increments `submittedValueCount`. Emits `DecryptionValueSubmitted`. Checks if `submittedValueCount` reaches `decryptionThreshold`, sets `thresholdReached = true`, and emits `DecryptionThresholdReached` if so.
*   **`triggerRewardCalculation()`**
    *   `triggerRewardCalculation() external onlyOwner nonReentrant`
    *   Allows the owner of the `VoteSession` contract to trigger rewards calculation on the linked `ParticipantRegistry` contract.
    *   **Requirements:** `onlyOwner`. Status must be `Completed` (i.e., `block.timestamp >= sharesCollectionEndDate`). `rewardsCalculatedTriggered` flag (within `VoteSession`) must be `false`.
    *   Calls `participantRegistry.calculateRewards(sessionId)`. Sets `rewardsCalculatedTriggered = true`. Emits `RewardsCalculationTriggered`.
*   **Interface Functions (Called *by* Registry)**
    *   `isRegistrationOpen() external view returns (bool)`: Checks if `block.timestamp < registrationEndDate`.
    *   `getRequiredDeposit() external view returns (uint256)`: Returns `requiredDeposit`.
    *   `isRewardCalculationPeriodActive() external view returns (bool)`: Checks if `block.timestamp >= sharesCollectionEndDate`.
    *   `isDepositClaimPeriodActive() external view returns (bool)`: Checks if `block.timestamp >= sharesCollectionEndDate`.
*   **View Functions**
    *   `getSessionDetails() external view returns (uint256 id, SessionStatus status, string memory _title, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, uint256 deposit, uint256 threshold)`: Returns key session details.
    *   `getSessionInfo() public view returns (uint256 id, IParticipantRegistry registryAddr, string memory _title, string memory _desc, uint256 _regEndDate, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, string[] memory _options, string memory _meta, uint256 _reqDeposit, uint256 _minThreshold, SessionStatus _status)`: Returns detailed session parameters.
    *   `getStatus() public view returns (SessionStatus)`: Returns the current calculated status based on time (calls internal logic similar to `updateSessionStatus` but doesn't change state).
    *   `getEncryptedVote(uint256 voteIndex) external view returns (EncryptedVote memory)`: Returns data for a specific vote.
    *   `getNumberOfVotes() external view returns (uint256)`: Returns the count of cast votes.
    *   `getDecryptionShare(uint256 shareLogIndex) external view returns (DecryptionShare memory)`: Returns data for a specific submitted share.
    *   `getNumberOfSubmittedShares() external view returns (uint256)`: Returns the count of submitted shares.
    *   `getActualMinShareThreshold() external view returns (uint256)` (New): Returns `actualMinShareThreshold` if finalized; otherwise, returns the initial `minShareThreshold`.
    *   `getDecryptionParameters() external view returns (uint256 threshold, bytes32[] memory alphas)`: Returns the set decryption parameters.
    *   `getSubmittedValues() external view returns (address[] memory submitters, uint256[] memory indexes, bytes32[] memory values)`: Returns the first `decryptionThreshold` submitted decryption values and their submitters/indexes. Reverts if threshold not reached.
*   **Public Accessors for State Variables:** `sessionId`, `participantRegistry`, `title`, `description`, `registrationEndDate`, `startDate`, `endDate`, `sharesCollectionEndDate`, `options`, `metadata`, `requiredDeposit`, `minShareThreshold`, `currentStatus`, `hasVoted`, `rewardsCalculatedTriggered`, `actualMinShareThreshold` (New), `dynamicThresholdFinalized` (New), `alphas`, `decryptionThreshold`, `submittedValues`, `submittedValueIndex`, `hasSubmittedDecryptionValue`, `valueSubmitters`, `submittedValueCount`, `thresholdReached`.
*   **`owner()` / `transferOwnership(...)`** (Inherited from OwnableUpgradeable)

---

## Interaction Flow Example (Updated)

1.  **Deployment:** Admin deploys implementation contracts (`ParticipantRegistry`, `VoteSession`) and then `VoteSessionFactory`, providing implementation addresses.
2.  **Session Creation:** Admin calls `factory.createSessionPair(...)` -> Factory deploys `VoteSession` and `ParticipantRegistry` proxies, calls their respective `initialize` functions, emits `SessionPairDeployed` event with proxy addresses and `sessionId`.
3.  **Linking:** Admin calls `registryProxy.setVoteSessionContract(sessionId, voteSessionProxyAddress)` using data from the event.
4.  **Decryption Params:** Admin calls `voteSessionProxy.setDecryptionParameters(...)`.
5.  **Funding (Optional):** Admin calls `registryProxy.addRewardFunding(sessionId)` with ETH.
6.  **Registration:** Users call `registryProxy.joinAsHolder(...)` (with deposit) or `registryProxy.registerAsVoter(...)` for the specific `sessionId`.
7.  **Voting:** Registered users call `voteSessionProxy.castEncryptedVote(...)`.
8.  **Share Submission:** Holders call `voteSessionProxy.submitDecryptionShare(...)` -> `VoteSession` calls `registryProxy.recordShareSubmission(...)`.
9.  **Decryption Value Submission:** Holders call `voteSessionProxy.submitDecryptionValue(...)` after `sharesCollectionEndDate`. Threshold events are emitted.
10. **Reward Trigger:** After `sharesCollectionEndDate`, anyone *can* call `voteSessionProxy.triggerRewardCalculation()` (sets flag), but the actual calculation requires an external call (e.g., by Admin/Keeper) to `registryProxy.calculateRewards(sessionId)`.
11. **Claims:** Eligible holders call `registryProxy.claimReward(sessionId)` and/or `registryProxy.claimDeposit(sessionId)` after calculation and when the claim period is active.

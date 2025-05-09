// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
// Import Structs library
import "./Structs.sol";
// Import Initializable base
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// --- Locally Defined Structs ---
// Removed locally copied ParticipantInfo struct

/**
 * @title IParticipantRegistry Interface
 * @dev Interface for interacting with the ParticipantRegistry contract.
 */
interface IParticipantRegistry {
    // Functions VoteSession CALLS on Registry
    // Use Structs.ParticipantInfo from the imported library
    function getParticipantInfo(uint256 sessionId, address participant) external view returns (Structs.ParticipantInfo memory);
    function recordShareSubmission(uint256 sessionId, address holder) external;
    function calculateRewards(uint256 sessionId) external;
    function getParticipantIndex(uint256 sessionId, address participant) external view returns (uint256);

    // Functions Registry might CALL on VoteSession
    function isRegistrationOpen() external view returns (bool);
    function getRequiredDeposit() external view returns (uint256);
    function isRewardCalculationPeriodActive() external view returns (bool);
    function isDepositClaimPeriodActive() external view returns (bool);
    function getNumberOfActiveHolders(uint256 sessionId) external view returns (uint256);
}

/**
 * @title VoteSession
 * @dev Manages the core lifecycle and voting process for a single session.
 * Interacts with a ParticipantRegistry contract using Structs.ParticipantInfo.
 * Designed to be cloned using EIP-1167 proxies.
 */
 // Inherit from Initializable FIRST, then others
contract VoteSession is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Using declaration for structs defined in the library (if needed within VoteSession)
    // using Structs for Structs.ParticipantInfo; // Not strictly needed if only used for external calls

    // --- Enums ---
    enum SessionStatus {
        Created,            // 0 Initial state, registration NOT YET open
        RegistrationOpen,   // 1 Registration is active (before startDate)
        VotingOpen,         // 2 Voting is active (startDate to endDate)
        SharesCollectionOpen, // 3 Decryption shares can be submitted (endDate to sharesCollectionEndDate)
        DecryptionOpen,     // 4 NEW: Shares collection ended, decryption values/proofs can be submitted/verified
        Completed,          // 5 Voting, share collection, decryption finished
        Aborted             // 6 Session cancelled (optional)
    }

    // --- Structs ---
    // Represents an encrypted vote/ballot within this session
    struct EncryptedVote {
        bytes ciphertext;
        bytes g1r;
        bytes g2r;
        bytes[] alpha; // These might be specific to the TLE scheme
        address voter; // Voter identified by address
        uint256 threshold; // Threshold for this specific vote (can vary?)
    }

    // Represents a submitted share for decryption within this session
    struct DecryptionShare {
        uint256 voteIndex; // Index of the EncryptedVote this share belongs to
        address holderAddress; // Holder identified by address
        bytes share;
        uint256 index; // Index/identifier for the share itself
    }

    // --- State Variables ---
    // REMOVED immutable
    uint256 public sessionId; // Set via initialize
    IParticipantRegistry public participantRegistry; // Set via initialize

    string public title;
    string public description;
    uint256 public registrationEndDate; // Explicit end for registration (e.g., = startDate)
    uint256 public startDate;
    uint256 public endDate; // End of voting period
    uint256 public sharesCollectionEndDate; // End of share submission period
    string[] public options;
    string public metadata; // For frontend hints / config storage
    uint256 public requiredDeposit; // Deposit required for holders
    uint256 public minShareThreshold; // Minimum threshold required for submitted shares

    SessionStatus public currentStatus;

    EncryptedVote[] public encryptedVotes;
    DecryptionShare[] public decryptionShares;

    // Mapping: voterAddress => hasVoted
    mapping(address => bool) public hasVoted;

    // Flag to prevent multiple reward calculation triggers
    bool public rewardsCalculatedTriggered;

    // --- Dynamic Threshold State ---
    uint256 public actualMinShareThreshold; // Stores the dynamically calculated threshold
    bool public dynamicThresholdFinalized; // Flag to ensure finalization happens once

    // --- Decryption Coordination State ---
    // Parameters set by owner
    bytes32[] public alphas;
    uint256 public decryptionThreshold; // Required number of decryption values

    // Tracking submitted values
    mapping(address => bytes32) public submittedValues; // holder => submitted decryption value (v_i)
    mapping(address => uint256) public submittedValueIndex; // holder => holder's 1-based index from registry
    mapping(address => bool) public hasSubmittedDecryptionValue; // holder => submitted status
    address[] public valueSubmitters; // Order of submission
    uint256 public submittedValueCount;
    bool public thresholdReached;

    // --- Events ---
    event SessionStatusChanged(uint256 indexed sessionId, SessionStatus newStatus);
    event EncryptedVoteCast(uint256 indexed sessionId, address indexed voter, uint256 voteIndex);
    event DecryptionShareSubmitted(uint256 indexed sessionId, address indexed holder, uint256 voteIndex, uint256 shareIndex);
    event DecryptionValueSubmitted(uint256 indexed sessionId, address indexed holder, uint256 index, bytes32 value);
    event DecryptionThresholdReached(uint256 indexed sessionId);
    event RewardsCalculationTriggered(uint256 indexed sessionId, address indexed triggerer);
    event DynamicMinShareThresholdSet(uint256 indexed sessionId, uint256 newThreshold, uint256 numberOfHolders);
    event DynamicThresholdFinalizationSkipped(uint256 indexed sessionId, uint256 numberOfHolders, uint256 initialMinThreshold);

    // --- Disabled Constructor for Implementation Contract ---
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // --- Initializer Function ---
    function initialize(
        uint256 _sessionId,
        address _registryAddress,
        address _initialOwner,
        string memory _title,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _sharesEndDate,
        string[] memory _options,
        string memory _metadata,
        uint256 _requiredDeposit,
        uint256 _minShareThreshold
    ) public initializer {
        // Initialize Ownable, ReentrancyGuard, and other base contracts
        __Ownable_init(_initialOwner);
        __ReentrancyGuard_init(); // Re-enabled
        // Note: Initializable itself doesn't have an __init function

        // Validation checks from original constructor
        require(_registryAddress != address(0), "Session: Invalid registry address");
        require(_startDate < _endDate, "Session: Start must be before end");
        require(_endDate < _sharesEndDate, "Session: Voting end must be before shares end");
        // Note: Cannot check block.timestamp reliably here as initialization is a separate tx
        // Consider adding a separate check or owner action if needed to confirm future start time.
        // require(_startDate > block.timestamp, "Session: Start must be in the future");
        require(_requiredDeposit > 0, "Session: Deposit must be positive");
        require(_minShareThreshold >= 2, "Session: Threshold must be at least 2");

        // Set state variables
        sessionId = _sessionId;
        participantRegistry = IParticipantRegistry(_registryAddress);
        title = _title;
        description = _description;
        registrationEndDate = _startDate; // Registration ends when voting starts
        startDate = _startDate;
        endDate = _endDate;
        sharesCollectionEndDate = _sharesEndDate;
        options = _options;
        metadata = _metadata;
        requiredDeposit = _requiredDeposit;
        minShareThreshold = _minShareThreshold;

        // Set initial status (assume Created, let updateSessionStatus handle transition)
        // If block.timestamp check was possible, we could set RegistrationOpen directly
        currentStatus = SessionStatus.Created;
        emit SessionStatusChanged(_sessionId, currentStatus);
        // Initialize actualMinShareThreshold to the initial minShareThreshold
        actualMinShareThreshold = _minShareThreshold; 
        // dynamicThresholdFinalized remains false by default
    }

    // --- Owner Functions ---
    /**
     * @dev Sets the decryption parameters (alphas and threshold).
     * Can only be called once by the owner, preferably before the session starts.
     */
    function setDecryptionParameters(bytes32[] calldata _alphas, uint256 _threshold) external onlyOwner {
        // Ensure parameters are not already set
        require(alphas.length == 0, "Session: Decryption parameters already set");
        require(decryptionThreshold == 0, "Session: Decryption parameters already set");
        // Basic validation
        require(_alphas.length > 0, "Session: Alphas cannot be empty");
        require(_threshold > 0, "Session: Decryption threshold must be positive");
        // Consider adding state check? e.g., require(currentStatus == SessionStatus.Created || currentStatus == SessionStatus.RegistrationOpen, "Session: Cannot set params now");

        alphas = _alphas;
        decryptionThreshold = _threshold;

        // Optional: Emit an event
        // emit DecryptionParametersSet(sessionId, _threshold, _alphas.length);
    }

    // --- Status Management Functions ---

    /**
     * @dev Updates the session status based on block timestamp.
     * This function should be called before actions that depend on the current state.
     * It's designed to be idempotent.
     */
    function updateSessionStatus() public {
        SessionStatus initialStatus = currentStatus;

        if (currentStatus == SessionStatus.Created) {
            // If current status is Created, determine the correct state based on time
            if (block.timestamp < startDate) { // startDate is also registrationEndDate
                currentStatus = SessionStatus.RegistrationOpen;
            } else if (block.timestamp < endDate) { // startDate <= block.timestamp < endDate
                currentStatus = SessionStatus.VotingOpen;
            } else if (block.timestamp < sharesCollectionEndDate) { // endDate <= block.timestamp < sharesCollectionEndDate
                currentStatus = SessionStatus.SharesCollectionOpen;
            } else { // sharesCollectionEndDate <= block.timestamp
                currentStatus = SessionStatus.DecryptionOpen;
            }
        } else if (currentStatus == SessionStatus.RegistrationOpen && block.timestamp >= startDate) {
            // --- BEGIN DYNAMIC THRESHOLD FINALIZATION LOGIC ---
            if (!dynamicThresholdFinalized) {
                uint256 numberOfActiveHolders = participantRegistry.getNumberOfActiveHolders(sessionId);

                if (numberOfActiveHolders >= minShareThreshold) { // Viability check: enough holders compared to initial min threshold
                    uint256 calculatedThresholdBasedOnHolders = (numberOfActiveHolders / 2) + 1;
                    uint256 newActualThreshold = calculatedThresholdBasedOnHolders;

                    if (newActualThreshold < minShareThreshold) {
                        newActualThreshold = minShareThreshold; // Floor by initial minThreshold
                    }
                    if (newActualThreshold > numberOfActiveHolders) {
                        newActualThreshold = numberOfActiveHolders; // Cap by actual number of holders
                    }
                     // Ensure it's at least 2 if somehow numberOfActiveHolders was 0 or 1 and minShareThreshold was bypassed (should not happen due to initialize and viability check)
                    if (newActualThreshold < 2 && numberOfActiveHolders > 0) { // if newActualThreshold is 1 (e.g. 1 holder), make it 1. If 0 holders, it's caught by viability. If it was calculated to less than 2 for some reason.
                        if (numberOfActiveHolders == 1) newActualThreshold = 1; // A 1-of-1 scheme is trivial but possible if minShareThreshold allowed it
                        else newActualThreshold = 2; // Default to 2 if calculation led to <2 for >1 holders
                    }
                     if (numberOfActiveHolders == 0 && minShareThreshold >=2) { // This case should be caught by 'numberOfActiveHolders >= minShareThreshold'
                         // If it gets here, it implies minShareThreshold was somehow not met, yet we proceed.
                         // This path indicates a logic flaw if minShareThreshold is the absolute minimum.
                         // For safety, stick to initial minShareThreshold.
                         newActualThreshold = minShareThreshold;
                     }


                    actualMinShareThreshold = newActualThreshold;
                    dynamicThresholdFinalized = true;
                    emit DynamicMinShareThresholdSet(sessionId, actualMinShareThreshold, numberOfActiveHolders);
                } else {
                    // Not enough holders to meet the initial viability criteria for dynamic adjustment.
                    // actualMinShareThreshold remains its initial value (minShareThreshold from initialize).
                    // dynamicThresholdFinalized remains false, or set to true to prevent re-attempts on subsequent status updates in this state.
                    // Let's set it to true to avoid re-querying and re-evaluating this block unnecessarily if updateSessionStatus is called multiple times in this window.
                    dynamicThresholdFinalized = true; 
                    emit DynamicThresholdFinalizationSkipped(sessionId, numberOfActiveHolders, minShareThreshold);
                }
            }
            // --- END DYNAMIC THRESHOLD FINALIZATION LOGIC ---

            if (block.timestamp < endDate) {
                currentStatus = SessionStatus.VotingOpen;
            } else if (block.timestamp < sharesCollectionEndDate) {
                currentStatus = SessionStatus.SharesCollectionOpen;
            } else {
                 // Should go to DecryptionOpen
                 currentStatus = SessionStatus.DecryptionOpen;
            }
        } else if (currentStatus == SessionStatus.VotingOpen && block.timestamp >= endDate) {
            if (block.timestamp < sharesCollectionEndDate) {
                 currentStatus = SessionStatus.SharesCollectionOpen;
            } else {
                // Should go to DecryptionOpen
                currentStatus = SessionStatus.DecryptionOpen;
            }
        } else if (currentStatus == SessionStatus.SharesCollectionOpen && block.timestamp >= sharesCollectionEndDate) {
            // Should go to DecryptionOpen
            currentStatus = SessionStatus.DecryptionOpen;
        }
        // Note: No automatic transition *from* DecryptionOpen or Completed/Aborted here.
        // Transition to Completed happens only via triggerRewardCalculation.

        if (currentStatus != initialStatus) {
            emit SessionStatusChanged(sessionId, currentStatus);
        }
    }

    // --- View Functions for Status ---

    function isRegistrationPeriodActive() public view returns (bool) {
        // Call updateSessionStatus? No, view functions shouldn't change state.
        // Rely on external calls to updateSessionStatus before calling views.
        // Or, calculate dynamically based on timestamps:
        return block.timestamp < registrationEndDate;
        // Alternatively, if using state machine strictly:
        // return currentStatus == SessionStatus.RegistrationOpen || currentStatus == SessionStatus.Created; // If Created allows registration
    }

    function isVotingPeriodActive() public view returns (bool) {
        // return currentStatus == SessionStatus.VotingOpen;
        return block.timestamp >= startDate && block.timestamp < endDate;
    }

     function isSharesCollectionPeriodActive() public view returns (bool) {
        // return currentStatus == SessionStatus.SharesCollectionOpen;
         return block.timestamp >= endDate && block.timestamp < sharesCollectionEndDate;
    }

     function isSessionComplete() public view returns (bool) {
        // return currentStatus == SessionStatus.Completed;
         return block.timestamp >= sharesCollectionEndDate;
     }

    // --- Core Functions ---

    /**
     * @dev Casts an encrypted vote. Requires participant to be registered.
     * Checks session status and if the participant has already voted.
     * Stores the encrypted vote details.
     */
    function castEncryptedVote(
        bytes calldata _ciphertext,
        bytes calldata _g1r,
        bytes calldata _g2r,
        bytes[] calldata _alpha, // Per-vote parameters
        uint256 _threshold // Per-vote threshold
    ) external nonReentrant {
        updateSessionStatus(); // Ensure status is current
        require(currentStatus == SessionStatus.VotingOpen, "Session: Voting not open");
        require(!hasVoted[msg.sender], "Session: Already voted");

        // Check registration status via Registry contract
        Structs.ParticipantInfo memory voterInfo = participantRegistry.getParticipantInfo(sessionId, msg.sender);
        require(voterInfo.isRegistered, "Session: Voter not registered");

        // Store vote
        encryptedVotes.push(EncryptedVote({
            ciphertext: _ciphertext,
            g1r: _g1r,
            g2r: _g2r,
            alpha: _alpha,
            voter: msg.sender,
            threshold: _threshold
        }));
        hasVoted[msg.sender] = true;

        emit EncryptedVoteCast(sessionId, msg.sender, encryptedVotes.length - 1);
    }

    /**
     * @dev Submits a decryption share. Requires participant to be a holder who has submitted shares.
     * Checks session status.
     * Stores the decryption share details.
     */
    function submitDecryptionShare(
        uint256 _voteIndex,
        bytes calldata _shareData,
        uint256 _shareIndex
    ) external nonReentrant {
        updateSessionStatus(); // Ensure status is current
        require(currentStatus == SessionStatus.SharesCollectionOpen, "Session: Share collection not open");

        // Check holder status via Registry contract
        Structs.ParticipantInfo memory holderInfoForShares = participantRegistry.getParticipantInfo(sessionId, msg.sender);
        require(holderInfoForShares.isRegistered && holderInfoForShares.isHolder, "Session: Not a registered holder");

        // Check vote index validity (optional but good practice)
        require(_voteIndex < encryptedVotes.length, "Session: Invalid vote index");

        // Store share locally in VoteSession
        decryptionShares.push(DecryptionShare({
            voteIndex: _voteIndex,
            holderAddress: msg.sender,
            share: _shareData,
            index: _shareIndex
        }));

        // Call Registry to record that shares were submitted for this holder
        participantRegistry.recordShareSubmission(sessionId, msg.sender);

        emit DecryptionShareSubmitted(sessionId, msg.sender, _voteIndex, decryptionShares.length - 1);
    }

    /**
     * @dev Submits a decryption value (v_i) for the threshold decryption scheme.
     * Requires participant to be a holder who has submitted shares and hasn't submitted a value yet.
     * Checks session status and decryption parameter readiness.
     */
    function submitDecryptionValue(bytes32 _value) external nonReentrant {
        // updateSessionStatus(); // Ensure status is current - should this be shares collection or completed? Let's allow during SharesCollectionOpen or Completed.
        require(isSharesCollectionPeriodActive() || isSessionComplete(), "Session: Decryption value submission not allowed now");
        require(decryptionThreshold > 0, "Session: Decryption parameters not set"); // Check if params are set
        require(!hasSubmittedDecryptionValue[msg.sender], "Session: Decryption value already submitted");

        // Check holder status and share submission via Registry contract
        Structs.ParticipantInfo memory holderInfoForValue = participantRegistry.getParticipantInfo(sessionId, msg.sender);
        require(holderInfoForValue.isRegistered && holderInfoForValue.isHolder, "Session: Not a registered holder");
        require(holderInfoForValue.hasSubmittedShares, "Session: Shares not submitted to registry");

        // Get participant index from Registry
        uint256 pIndex = participantRegistry.getParticipantIndex(sessionId, msg.sender);
        require(pIndex > 0, "Session: Participant index not found"); // Index should be 1-based

        // Store value and mark as submitted
        submittedValues[msg.sender] = _value;
        submittedValueIndex[msg.sender] = pIndex; // Store the 1-based index
        hasSubmittedDecryptionValue[msg.sender] = true;
        valueSubmitters.push(msg.sender);
        submittedValueCount++;

        emit DecryptionValueSubmitted(sessionId, msg.sender, pIndex, _value);

        // Check if threshold is reached
        if (!thresholdReached && submittedValueCount >= decryptionThreshold) {
            thresholdReached = true;
            emit DecryptionThresholdReached(sessionId);
        }
    }

    /**
     * @dev Owner can trigger reward calculation in the registry.
     * Best called after voting ends and before claims start.
     */
    function triggerRewardCalculation() external onlyOwner nonReentrant {
        // We now require that updateSessionStatus() must be called first to set status to DecryptionOpen (4)
        // And then triggerRewardCalculation will transition it to Completed (5)
        // Optional: Could call updateSessionStatus() here, but better to require caller coordination.
        
        // First guard against duplicate calls ...
        require(!rewardsCalculatedTriggered, "Session: Rewards already calculated");
        // ... then be sure we are in the right phase
        require(currentStatus == SessionStatus.DecryptionOpen, "Session: Not DecryptionOpen");

        rewardsCalculatedTriggered = true;
        // Call the registry to calculate rewards
        participantRegistry.calculateRewards(sessionId);

        // Explicitly set status to Completed and emit event
        // The require above ensures we are coming from DecryptionOpen
        currentStatus = SessionStatus.Completed;
        emit SessionStatusChanged(sessionId, currentStatus); 

        emit RewardsCalculationTriggered(sessionId, msg.sender);
    }

    // --- View Functions for Data Retrieval ---

    function getNumberOfVotes() external view returns (uint256) {
        return encryptedVotes.length;
    }

    function getEncryptedVote(uint256 index) external view returns (EncryptedVote memory) {
        require(index < encryptedVotes.length, "Index out of bounds");
        return encryptedVotes[index];
    }

    function getNumberOfDecryptionShares() external view returns (uint256) {
        return decryptionShares.length;
    }

    function getDecryptionShare(uint256 index) external view returns (DecryptionShare memory) {
        require(index < decryptionShares.length, "Index out of bounds");
        return decryptionShares[index];
    }

    function getSessionInfo() external view returns (
        string memory _title,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _sharesEndDate,
        string[] memory _options,
        string memory _metadata,
        uint256 _requiredDeposit,
        uint256 _minShareThreshold,
        SessionStatus _currentStatus
    ) {
        return (
            title,
            description,
            startDate,
            endDate,
            sharesCollectionEndDate,
            options,
            metadata,
            requiredDeposit,
            minShareThreshold, // This returns the initial one
            currentStatus
        );
    }

    /**
     * @dev Returns the actual minimum share threshold.
     * If the dynamic threshold has been finalized, it returns that.
     * Otherwise, it returns the initial minShareThreshold set during session creation.
     */
    function getActualMinShareThreshold() external view returns (uint256) {
        if (dynamicThresholdFinalized) {
            return actualMinShareThreshold;
        }
        return minShareThreshold; // Return initial if not finalized yet
    }

    // --- View Functions for Decryption Data Retrieval ---

     /**
     * @dev Returns the decryption parameters set by the owner.
     */
    function getDecryptionParameters() external view returns (uint256 threshold, bytes32[] memory alphas_) {
        return (decryptionThreshold, alphas);
    }

    /**
     * @dev Returns the submitted decryption values, limited to the threshold count if reached.
     * Provides the submitter addresses, their 1-based indices, and the values (v_i).
     */
    function getSubmittedDecryptionValues() external view returns (
        address[] memory submitters,
        uint256[] memory indices,
        bytes32[] memory values
    ) {
        uint256 count = thresholdReached ? decryptionThreshold : submittedValueCount;
        submitters = new address[](count);
        indices = new uint256[](count);
        values = new bytes32[](count);

        for (uint256 i = 0; i < count; i++) {
            address submitter = valueSubmitters[i];
            submitters[i] = submitter;
            indices[i] = submittedValueIndex[submitter]; // Retrieve stored 1-based index
            values[i] = submittedValues[submitter];
        }

        return (submitters, indices, values);
    }

    // --- Interface Compliance View Functions (Called by Registry) ---

     /**
     * @dev Interface compliance for Registry: checks if registration is open.
     */
    function isRegistrationOpen() external view returns (bool) {
         // Update status potentially needed? No, should reflect current state based on time.
        // return currentStatus == SessionStatus.RegistrationOpen;
         return block.timestamp < registrationEndDate;
    }

     /**
     * @dev Interface compliance for Registry: gets required deposit.
     */
    function getRequiredDeposit() external view returns (uint256) {
        return requiredDeposit;
    }

    /**
     * @dev Interface compliance for Registry: checks if reward calculation *period* is active.
     * This is subtly different from whether calculation *has been triggered*.
     * Rewards should be calculated AFTER shares collection ends.
     */
    function isRewardCalculationPeriodActive() external view returns (bool) {
        // return block.timestamp >= endDate && block.timestamp < sharesCollectionEndDate; // Old logic
        return block.timestamp >= sharesCollectionEndDate; // Corrected logic
    }

     /**
     * @dev Interface compliance for Registry: checks if deposit claim *period* is active.
     * Let's define this period as after shares collection ends.
     */
    function isDepositClaimPeriodActive() external view returns (bool) {
         // return currentStatus == SessionStatus.Completed;
         return block.timestamp >= sharesCollectionEndDate;
    }


} 
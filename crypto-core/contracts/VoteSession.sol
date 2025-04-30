// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Import Structs library
import "./Structs.sol";

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

    // Functions Registry might CALL on VoteSession
    function isRegistrationOpen() external view returns (bool);
    function getRequiredDeposit() external view returns (uint256);
    function isRewardCalculationPeriodActive() external view returns (bool);
    function isDepositClaimPeriodActive() external view returns (bool);
}

/**
 * @title VoteSession
 * @dev Manages the core lifecycle and voting process for a single session.
 * Interacts with a ParticipantRegistry contract using Structs.ParticipantInfo.
 */
contract VoteSession is Ownable, ReentrancyGuard {
    // Using declaration for structs defined in the library (if needed within VoteSession)
    // using Structs for Structs.ParticipantInfo; // Not strictly needed if only used for external calls

    // --- Enums ---
    enum SessionStatus {
        Created,            // Initial state, registration NOT YET open
        RegistrationOpen,   // Registration is active (before startDate)
        VotingOpen,         // Voting is active (startDate to endDate)
        SharesCollectionOpen, // Decryption shares can be submitted (endDate to sharesCollectionEndDate)
        Completed,          // Voting and share collection finished
        Aborted             // Session cancelled (optional)
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
    uint256 public immutable sessionId; // Set at creation
    IParticipantRegistry public immutable participantRegistry; // Use interface type

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

    // --- Events ---
    event SessionStatusChanged(uint256 indexed sessionId, SessionStatus newStatus);
    event EncryptedVoteCast(uint256 indexed sessionId, address indexed voter, uint256 voteIndex);
    event DecryptionShareSubmitted(uint256 indexed sessionId, address indexed holder, uint256 voteIndex, uint256 shareIndex);
    event RewardsCalculationTriggered(uint256 indexed sessionId, address indexed triggerer);

    // --- Constructor ---
    constructor(
        uint256 _sessionId,
        address _registryAddress, // Pass registry address
        address _initialOwner,
        string memory _title,
        string memory _description,
        uint256 _startDate, // Renamed from _registrationEndDate for clarity
        uint256 _endDate,
        uint256 _sharesEndDate,
        string[] memory _options,
        string memory _metadata,
        uint256 _requiredDeposit,
        uint256 _minShareThreshold
    ) Ownable(_initialOwner) {
        require(_registryAddress != address(0), "Session: Invalid registry address");
        require(_startDate < _endDate, "Session: Start must be before end");
        require(_endDate < _sharesEndDate, "Session: Voting end must be before shares end");
        // Registration ends when voting starts
        require(_startDate > block.timestamp, "Session: Start must be in the future");
        require(_requiredDeposit > 0, "Session: Deposit must be positive");
        require(_minShareThreshold >= 2, "Session: Threshold must be at least 2"); // Basic check

        sessionId = _sessionId;
        participantRegistry = IParticipantRegistry(_registryAddress); // Assign interface type

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

        // Start in RegistrationOpen state if current time allows
        if (block.timestamp < registrationEndDate) {
             currentStatus = SessionStatus.RegistrationOpen;
        } else {
            // Should not happen due to require above, but safety check
            currentStatus = SessionStatus.Created; // Or determine appropriate initial state
        }
        emit SessionStatusChanged(_sessionId, currentStatus);
    }

    // --- Status Management Functions ---

    /**
     * @dev Updates the session status based on block timestamp.
     * Can be called by anyone to advance the state.
     */
    function updateSessionStatus() public {
        SessionStatus oldStatus = currentStatus;

        // Created -> RegistrationOpen (Handled in constructor now)

        // RegistrationOpen -> VotingOpen
        if (currentStatus == SessionStatus.RegistrationOpen && block.timestamp >= startDate) {
             currentStatus = SessionStatus.VotingOpen;
        }
        // VotingOpen -> SharesCollectionOpen
        if (currentStatus == SessionStatus.VotingOpen && block.timestamp > endDate) {
            currentStatus = SessionStatus.SharesCollectionOpen;
        }
        // SharesCollectionOpen -> Completed
        if (currentStatus == SessionStatus.SharesCollectionOpen && block.timestamp > sharesCollectionEndDate) {
            currentStatus = SessionStatus.Completed;
        }

        if (currentStatus != oldStatus) {
            emit SessionStatusChanged(sessionId, currentStatus);
        }
    }

    // --- Core Voting / Shares Functions ---

    /**
     * @dev Submits an encrypted vote for the calling address.
     * Uses Structs.ParticipantInfo via the interface.
     */
    function castEncryptedVote(
        bytes memory ciphertext,
        bytes memory g1r,
        bytes memory g2r,
        bytes[] memory alpha,
        uint256 threshold
    ) external nonReentrant {
        updateSessionStatus();
        require(currentStatus == SessionStatus.VotingOpen, "Session: Voting not open");
        address voter = msg.sender;
        require(!hasVoted[voter], "Session: Voter already voted");

        // Use Structs.ParticipantInfo from the imported library
        Structs.ParticipantInfo memory participant = participantRegistry.getParticipantInfo(sessionId, voter);
        require(participant.isRegistered, "Session: Voter not registered");

        require(threshold >= minShareThreshold, "Session: Submitted threshold too low");

        // Store vote
        uint256 voteIndex = encryptedVotes.length;
        encryptedVotes.push(
            EncryptedVote({
                ciphertext: ciphertext,
                g1r: g1r,
                g2r: g2r,
                alpha: alpha,
                voter: voter,
                threshold: threshold
            })
        );

        hasVoted[voter] = true;
        emit EncryptedVoteCast(sessionId, voter, voteIndex);
    }

    /**
     * @dev Submits decryption shares for one or more encrypted votes.
     * Uses Structs.ParticipantInfo via the interface.
     */
    function submitDecryptionShares(
        uint256[] memory voteIndices,
        uint256[] memory shareIndices,
        bytes[] memory shareDataList
    ) external nonReentrant {
        updateSessionStatus();
        require(currentStatus == SessionStatus.SharesCollectionOpen, "Session: Share collection not open");
        require(voteIndices.length == shareIndices.length && voteIndices.length == shareDataList.length, "Session: Input array lengths mismatch");
        address holder = msg.sender;

        // Use Structs.ParticipantInfo from the imported library
        Structs.ParticipantInfo memory participant = participantRegistry.getParticipantInfo(sessionId, holder);
        require(participant.isHolder, "Session: Caller is not a holder");
        require(!participant.hasSubmittedShares, "Session: Shares already submitted (via Registry)");

        for (uint i = 0; i < voteIndices.length; i++) {
            uint256 voteIndex = voteIndices[i];
            require(voteIndex < encryptedVotes.length, "Session: Invalid vote index");

            decryptionShares.push(
                DecryptionShare({
                    voteIndex: voteIndex,
                    holderAddress: holder,
                    share: shareDataList[i],
                    index: shareIndices[i]
                })
            );
            emit DecryptionShareSubmitted(sessionId, holder, voteIndex, shareIndices[i]);
        }

        // Call using the interface type directly
        participantRegistry.recordShareSubmission(sessionId, holder);
    }

    // --- Reward Trigger ---

    /**
     * @dev Triggers the reward calculation in the ParticipantRegistry.
     * Can be called by anyone after the shares collection period.
     * Added check to prevent multiple triggers.
     */
    function triggerRewardCalculation() external nonReentrant {
        updateSessionStatus();
        require(currentStatus == SessionStatus.Completed, "Session: Not completed yet");
        require(!rewardsCalculatedTriggered, "Session: Rewards already triggered"); // Check flag

        rewardsCalculatedTriggered = true; // Set flag
        // Call using the interface type directly
        participantRegistry.calculateRewards(sessionId);
        emit RewardsCalculationTriggered(sessionId, msg.sender);
    }

    // --- View Functions for ParticipantRegistry Interaction ---
    // These are called *by* the registry
    /**
     * @dev Checks if registration is currently open for this session.
     * Called by ParticipantRegistry.
     */
    function isRegistrationOpen() external view returns (bool) {
        // Registration is open if current time is before the registration end date (which is startDate)
        return block.timestamp < registrationEndDate;
        // Alternative: Check status? return currentStatus == SessionStatus.RegistrationOpen;
        // Time-based is likely more robust against missed status updates.
    }

    /**
     * @dev Gets the required deposit amount for holders in this session.
     * Called by ParticipantRegistry.
     */
    function getRequiredDeposit() external view returns (uint256) {
        return requiredDeposit;
    }

    /**
     * @dev Checks if the period for reward calculation is active.
     * Placeholder logic: Assumes rewards can be calculated once completed.
     * Called by ParticipantRegistry.
     */
    function isRewardCalculationPeriodActive() external view returns (bool) {
        // Rewards can be calculated once the share collection period is over
        return block.timestamp > sharesCollectionEndDate;
        // Alternative: Check status? return currentStatus == SessionStatus.Completed;
    }

    /**
     * @dev Checks if the period for deposit claims is active.
     * Placeholder logic: Assumes deposits can be claimed once completed.
     * Called by ParticipantRegistry.
     */
    function isDepositClaimPeriodActive() external view returns (bool) {
        // Deposits can be claimed once the share collection period is over
        return block.timestamp > sharesCollectionEndDate;
        // Alternative: Check status? return currentStatus == SessionStatus.Completed;
    }

    // --- General View Functions ---

    function getSessionDetails() external view returns (
        uint256 _sessionId, SessionStatus _status, string memory _title, uint256 _startDate, uint256 _endDate, uint256 _sharesEndDate, uint256 _requiredDeposit, uint256 _minThreshold
    ) {
        return (sessionId, currentStatus, title, startDate, endDate, sharesCollectionEndDate, requiredDeposit, minShareThreshold);
    }

    function getEncryptedVote(uint256 voteIndex) external view returns (EncryptedVote memory) {
        require(voteIndex < encryptedVotes.length, "Session: Invalid vote index");
        return encryptedVotes[voteIndex];
    }

    function getNumberOfVotes() external view returns (uint256) {
        return encryptedVotes.length;
    }

    function getDecryptionShare(uint256 shareLogIndex) external view returns (DecryptionShare memory) {
        require(shareLogIndex < decryptionShares.length, "Session: Invalid share log index");
        return decryptionShares[shareLogIndex];
    }

     function getNumberOfSubmittedShares() external view returns (uint256) {
        return decryptionShares.length;
    }

    // --- View Functions ---

    function getSessionInfo() public view returns (string memory, string memory, uint256, uint256, uint256, string[] memory, string memory, uint256, uint256) {
        return (title, description, startDate, endDate, sharesCollectionEndDate, options, metadata, requiredDeposit, minShareThreshold);
    }

    function getStatus() public view returns (SessionStatus) {
        if (block.timestamp < startDate) return SessionStatus.RegistrationOpen;
        if (block.timestamp < endDate) return SessionStatus.VotingOpen;
        if (block.timestamp < sharesCollectionEndDate) return SessionStatus.SharesCollectionOpen;
        if (!rewardsCalculatedTriggered) return SessionStatus.Completed;
        // Consider adding a Closed/Completed status if needed after claims?
        return SessionStatus.Completed;
    }

    // Clients should query the ParticipantRegistry directly for BLS keys using its getHolderBlsKeys function.

    function getParticipantInfo(address participant) external view returns (Structs.ParticipantInfo memory) {
        return participantRegistry.getParticipantInfo(sessionId, participant);
    }

} 
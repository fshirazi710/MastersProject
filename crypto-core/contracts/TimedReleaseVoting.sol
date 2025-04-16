// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import Reentrancy Guard (Correct path for OpenZeppelin v5.x)
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Import EnumerableSet for managing holder lists
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title TimedReleaseVoting
 * @dev Implements a voting system with timed release encryption, deposits, and rewards.
 * Uses VoteSession instead of Election terminology.
 */
contract TimedReleaseVoting is ReentrancyGuard { // Inherit ReentrancyGuard

    // Use EnumerableSet for AddressSet
    using EnumerableSet for EnumerableSet.AddressSet;

    // For debugging
    event LogMessage(string message);
    event LogUint(string label, uint256 value);
    event LogAddress(address addr);

    // ======== Struct Definitions ========\n\n    // Represents a Vote Session (formerly Election)
    struct VoteSession {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string[] options;
        uint256 rewardPool; // ETH deposited for rewards
        uint256 requiredDeposit; // ETH required for holders to deposit (formerly electionDeposit)
        string metadata; // Added for frontend hints / config storage
    }

    // Represents an encrypted vote/ballot
    struct EncryptedVote { // Renamed from Vote
        address[] holderAddresses; // Addresses of holders responsible for this vote/ballot
        bytes ciphertext;
        bytes g1r;
        bytes g2r;
        bytes[] alpha;
        address voter; // Voter identified by address
        uint256 threshold;
    }

    // Represents a submitted share for decryption
    struct DecryptionShare { // Renamed from Shares
        uint256 voteIndex; // Index of the EncryptedVote this share belongs to
        address holderAddress; // Holder identified by address
        bytes share;
        uint256 index; // Index/identifier for the share itself (e.g., its position in the threshold scheme)
    }

    // Represents a holder's data specific to a vote session
    // Note: Much of this is now tracked in mappings like isHolderActiveForVoteSession, holderDeposits
    struct VoteSessionHolder { // Renamed from Holder
        address holderAddress;
        uint256 voteSessionId;
        bool active;
    }
    
    // ======== Constants ========\n

    // Ensure MIN_HOLDERS constant is defined correctly
    uint256 public constant MIN_HOLDERS = 3;
    // ======== State Variables ========\n\n    // Renamed from electionCount
    uint256 public voteSessionCount;
    // Renamed from election; voteSessionId => VoteSession Data
    mapping(uint256 => VoteSession) public voteSession;

    // Renamed from votes; voteSessionId => array of submitted EncryptedVotes
    mapping(uint256 => EncryptedVote[]) public encryptedVotes;

    // Renamed from shares; voteSessionId => array of submitted DecryptionShares
    mapping(uint256 => DecryptionShare[]) public decryptionShares;

    // Mapping: voteSessionId => array of secret keys
    // Remove secret_keys feature
    // mapping(uint256 => string[]) public secret_keys;

    // --- Status Tracking Mappings ---\n    // Renamed; voteSessionId => holderAddress => isActive
    mapping(uint256 => mapping(address => bool)) public isHolderActiveForVoteSession;
    // Renamed; voteSessionId => holderAddress => hasSubmitted
    mapping(uint256 => mapping(address => bool)) public hasSubmittedSharesForVoteSession;
    // voteSessionId => holderAddress => depositAmount
    mapping(uint256 => mapping(address => uint256)) public holderDeposits; // Kept name
    // Add mapping to track if voter has voted in a session
    mapping(uint256 => mapping(address => bool)) public hasVotedInSession;
    // Add mapping to track if rewards have been distributed for a session
    mapping(uint256 => bool) public rewardsHaveBeenDistributed;

    // --- Holder Set per Vote Session ---\n    // voteSessionId => set of active holder addresses
    mapping(uint256 => EnumerableSet.AddressSet) private _activeHolders; // Kept name

    // --- Accounting Mappings (Optional but helpful) ---\n    // voteSessionId => total ETH deposited by holders
    mapping(uint256 => uint256) public totalDepositsHeld; // Kept name
    // voteSessionId => total ETH held for rewards
    mapping(uint256 => uint256) public totalRewardsHeld; // Kept name

    // ======== Events ========\n\n    // Renamed parameter electionId -> voteSessionId
    event HolderJoined(address indexed holderAddress, uint256 indexed voteSessionId, uint256 depositAmount);
    // Renamed event and parameter
    event VoteSessionCreated(uint256 indexed id, string title);
    // Renamed event and parameters, added metadata
    event VoteSessionCreatedDetailed (
        uint256 id,
        string title,
        string description,
        uint256 startDate,
        uint256 endDate,
        string[] options,
        uint256 rewardPool,
        uint256 requiredDeposit, // Renamed from electionDeposit
        string metadata // Added metadata
    );
    // Renamed event and parameter
    event EncryptedVoteSubmitted(
        uint256 indexed voteSessionId,
        address[] holderAddresses,
        address indexed voter,
        uint256 threshold
    );
    // Renamed event and parameter
    event DecryptionShareSubmitted (
        uint256 indexed voteSessionId,
        address indexed holderAddress,
        uint256 voteIndex,
        uint256 shareIndex
    );
    // Renamed parameter electionId -> voteSessionId
    event DepositClaimed(address indexed holderAddress, uint256 indexed voteSessionId, uint256 amount);
    // Renamed parameter electionId -> voteSessionId
    event RewardsDistributed(uint256 indexed voteSessionId, uint256 totalRewardAmount, uint256 eligibleHolderCount);

    // ======== Constructor ========\n    // constructor() { } // Add if needed

    // ======== Vote Session Management ========\n\n    // Renamed function, parameters, added metadata
    function createVoteSession(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string[] memory options,
        uint256 requiredDeposit, // Renamed parameter
        string memory _metadata // Added metadata parameter
    ) public payable returns (uint256) { // Added payable
        uint256 currentId = voteSessionCount; // Use renamed counter
        // Validate inputs
        require(bytes(title).length > 0, "Title required");
        require(startDate < endDate, "Start date must be before end date");
        require(startDate > block.timestamp, "Start date must be in the future");
        require(requiredDeposit > 0, "Required deposit must be positive"); // Use renamed param
        require(msg.value > 0, "Reward pool must be funded"); // Check reward pool funding

        // Use renamed mapping and struct, add metadata
        voteSession[currentId] = VoteSession(
            currentId,
            title,
            description,
            startDate,
            endDate,
            options,
            msg.value, // Store sent ETH as reward pool
            requiredDeposit, // Use renamed param
            _metadata // Store metadata
        );
        totalRewardsHeld[currentId] = msg.value; // Track rewards held

        // Emit renamed events, add metadata to detailed event
        emit VoteSessionCreated(currentId, title);
        emit VoteSessionCreatedDetailed(
            currentId, title, description, startDate, endDate, options, msg.value, requiredDeposit, _metadata
        );
        voteSessionCount++; // Increment renamed counter
        return currentId;
    }

    // Renamed function, parameter, return type, internal logic
    function getVoteSession(uint256 voteSessionId) public view returns (VoteSession memory) {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist");
        return voteSession[voteSessionId];
    }

    // ======== Holder Management & Deposits ========\n\n    // Renamed parameter electionId -> voteSessionId
    function joinAsHolder(uint256 voteSessionId) external payable nonReentrant {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        VoteSession storage currentSession = voteSession[voteSessionId]; // Use renamed mapping, local var name
        require(block.timestamp < currentSession.startDate, "Vote Session already started"); // Use renamed var
        address holderAddress = msg.sender;
        uint256 requiredDeposit = currentSession.requiredDeposit; // Use renamed field

        require(requiredDeposit > 0, "Deposit not set for session"); // Updated message
        require(msg.value == requiredDeposit, "Incorrect deposit amount sent");

        bool added = _activeHolders[voteSessionId].add(holderAddress);
        require(added, "Holder already active for this session"); // Updated message

        // Store deposit amount
        holderDeposits[voteSessionId][holderAddress] = msg.value;
        totalDepositsHeld[voteSessionId] += msg.value; // Track total deposits

        // Mark as active (using the map for potentially faster single checks if needed)
        isHolderActiveForVoteSession[voteSessionId][holderAddress] = true; // Use renamed mapping

        // Emit renamed event
        emit HolderJoined(holderAddress, voteSessionId, msg.value);
    }

    // --- Deposit Claim Function ---
    // Renamed parameter electionId -> voteSessionId
    function claimDeposit(uint256 voteSessionId) external nonReentrant {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        // Add check: Ensure the session has ended before claiming deposit
        require(block.timestamp > voteSession[voteSessionId].endDate, "Vote Session not ended"); // Ensure semicolon and standard format
        address holderAddress = msg.sender;

        // Eligibility Check 1: Must have submitted shares
        require(hasSubmittedSharesForVoteSession[voteSessionId][holderAddress], "Shares not submitted"); // Use renamed mapping

        // Eligibility Check 2: Deposit must exist
        uint256 depositAmount = holderDeposits[voteSessionId][holderAddress];
        require(depositAmount > 0, "No deposit found or already claimed");

        // Effects: Reset deposit *before* transfer
        holderDeposits[voteSessionId][holderAddress] = 0;
        totalDepositsHeld[voteSessionId] -= depositAmount; // Update total held

        // Interactions: Transfer deposit back
        (bool success, ) = holderAddress.call{value: depositAmount}(bytes(""));
        require(success, "Deposit transfer failed");

        // Emit renamed event
        emit DepositClaimed(holderAddress, voteSessionId, depositAmount);
    }

    // --- Holder Set Accessors ---\n    // Renamed function and parameter
    function getNumHoldersByVoteSession(uint256 voteSessionId) public view returns (uint256) {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        return _activeHolders[voteSessionId].length();
    }

    // Renamed function and parameter
    function getHoldersByVoteSession(uint256 voteSessionId) public view returns (address[] memory) {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        return _activeHolders[voteSessionId].values();
    }

    // Renamed function and parameter
    function isHolderInVoteSession(uint256 voteSessionId, address holderAddress) public view returns (bool) {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        return _activeHolders[voteSessionId].contains(holderAddress);
        // Alternative: return isHolderActiveForVoteSession[voteSessionId][holderAddress]; // If map is kept synced
    }

    // --- Holder Status Views ---
    // Update comment: Explain why EnumerableSet iteration is acceptable here.
    // NOTE: getNumHoldersByVoteSession / getHoldersByVoteSession rely on EnumerableSet iteration.
    // While potentially gas-heavy if called ON-CHAIN, these view functions are typically called OFF-CHAIN
    // by backends/frontends where gas cost is not a direct issue. EnumerableSet provides
    // efficient off-chain retrieval and standard set management (add, remove, contains).
    // A redesign (e.g., manual counters) would add complexity primarily for on-chain call optimization
    // which is not the expected use case here.
    // Renamed parameter electionId -> voteSessionId
    // Note: This function now returns status based on renamed mappings
    function getHolderStatus(uint256 voteSessionId, address holderAddress)
        public
        view
        returns (bool isActive, bool hasSubmitted, uint256 deposit)
    {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        isActive = isHolderActiveForVoteSession[voteSessionId][holderAddress]; // Use renamed mapping
        hasSubmitted = hasSubmittedSharesForVoteSession[voteSessionId][holderAddress]; // Use renamed mapping
        deposit = holderDeposits[voteSessionId][holderAddress];
        return (isActive, hasSubmitted, deposit);
    }


    // ======== Voting ========\n\n    // Renamed function and parameter electionId -> voteSessionId
    function submitEncryptedVote( // Renamed from submitVote
        uint256 voteSessionId,
        address[] memory _holderAddresses,
        bytes memory ciphertext,
        bytes memory g1r,
        bytes memory g2r,
        bytes[] memory alpha,
        uint256 threshold
    ) public nonReentrant {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        VoteSession storage currentSession = voteSession[voteSessionId]; // Use renamed mapping
        require(block.timestamp >= currentSession.startDate, "Vote Session not started"); // Use renamed var
        require(block.timestamp <= currentSession.endDate, "Vote Session ended"); // Use renamed var
        require(_holderAddresses.length >= MIN_HOLDERS, "Not enough holders selected"); // Use constant

        // Check if voter has already voted (Iterates through potentially large array - GAS HEAVY!)
        // Replace loop check with mapping check for gas efficiency
        require(!hasVotedInSession[voteSessionId][msg.sender], "Voter already voted");
        // EncryptedVote[] storage submittedVotes = encryptedVotes[voteSessionId]; // Use renamed mapping
        // for (uint i = 0; i < submittedVotes.length; i++) {
        //     require(submittedVotes[i].voter != msg.sender, "Voter already voted");
        // }

        // Add the vote
        encryptedVotes[voteSessionId].push( // Use renamed mapping and struct
            EncryptedVote({
                holderAddresses: _holderAddresses,
                ciphertext: ciphertext,
                g1r: g1r,
                g2r: g2r,
                alpha: alpha,
                voter: msg.sender,
                threshold: threshold
            })
        );

        // Mark voter as having voted in this session
        hasVotedInSession[voteSessionId][msg.sender] = true;

        // Emit renamed event
        emit EncryptedVoteSubmitted(voteSessionId, _holderAddresses, msg.sender, threshold);
    }

    // Renamed function and parameter electionId -> voteSessionId
    function getEncryptedVotes(uint256 voteSessionId) // Renamed from getVotes
        public
        view
        returns (EncryptedVote[] memory) // Use renamed struct
    {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        return encryptedVotes[voteSessionId]; // Use renamed mapping
    }


    // ======== Share Submission ========\n\n    // Renamed function and parameter electionId -> voteSessionId
    function submitDecryptionShares( // Renamed from submitShares
        uint256 voteSessionId,
        uint256[] memory voteIndices, // Index of the EncryptedVote within the session
        uint256[] memory shareIndices, // Index identifier for the share itself
        bytes[] memory shareDataList // The actual share data
    ) public nonReentrant {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        require(voteIndices.length == shareIndices.length && voteIndices.length == shareDataList.length, "Input array lengths mismatch");
        address holderAddress = msg.sender;

        // Check if holder is active for this session
        require(isHolderActiveForVoteSession[voteSessionId][holderAddress], "Not an active holder for this session"); // Use renamed mapping
        // Check if shares already submitted (Prevents overwriting/double submission)
        require(!hasSubmittedSharesForVoteSession[voteSessionId][holderAddress], "Shares already submitted"); // Use renamed mapping

        for (uint i = 0; i < voteIndices.length; i++) {
            // Add boundary check for voteIndex?
            require(voteIndices[i] < encryptedVotes[voteSessionId].length, "Invalid vote index");

            // Add the share
            decryptionShares[voteSessionId].push( // Use renamed mapping and struct
                DecryptionShare({
                    voteIndex: voteIndices[i],
                    holderAddress: holderAddress,
                    share: shareDataList[i], // Store bytes
                    index: shareIndices[i]
                })
            );
            // Emit event for each share? Or one aggregate event? Emitting per share for now.
            emit DecryptionShareSubmitted(voteSessionId, holderAddress, voteIndices[i], shareIndices[i]); // Use renamed event
        }

        // Mark holder as having submitted shares
        hasSubmittedSharesForVoteSession[voteSessionId][holderAddress] = true; // Use renamed mapping
    }


    // Renamed function and parameter electionId -> voteSessionId
    function getDecryptionShares(uint256 voteSessionId) // Renamed from getShares
        public
        view
        returns (DecryptionShare[] memory) // Use renamed struct
    {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        return decryptionShares[voteSessionId]; // Use renamed mapping
    }

    // ======== Reward Distribution ========\n\n    // Renamed parameter electionId -> voteSessionId
    function distributeRewards(uint256 voteSessionId) external nonReentrant {
        require(voteSessionId < voteSessionCount, "Vote Session does not exist"); // Use renamed counter
        // Guard: Check if already distributed
        require(!rewardsHaveBeenDistributed[voteSessionId], "Rewards already distributed");
        // Guard: Check if session has ended AND grace period is over
        require(block.timestamp > (voteSession[voteSessionId].endDate + 15 minutes), "Session ended, but grace period not over");

        uint256 totalReward = totalRewardsHeld[voteSessionId]; // Use kept mapping name
        require(totalReward > 0, "No rewards available or already distributed");

        address[] memory activeHolderAddresses = _activeHolders[voteSessionId].values(); // Use kept mapping name
        uint256 eligibleHolderCount = 0;

        // First pass: Count eligible holders (those who submitted shares)
        for (uint i = 0; i < activeHolderAddresses.length; i++) {
            if (hasSubmittedSharesForVoteSession[voteSessionId][activeHolderAddresses[i]]) { // Use renamed mapping
                eligibleHolderCount++;
            }
        }

        require(eligibleHolderCount > 0, "No eligible holders found for rewards");

        uint256 rewardPerHolder = totalReward / eligibleHolderCount;
        require(rewardPerHolder > 0, "Reward per holder is zero"); // Prevent division by zero or negligible rewards

        uint256 actualDistributed = 0;

        // Effects: Reset reward pool *before* transfers
        totalRewardsHeld[voteSessionId] = 0; // Assuming full distribution or dust is acceptable loss

        // Second pass: Distribute rewards
        for (uint i = 0; i < activeHolderAddresses.length; i++) {
            address holder = activeHolderAddresses[i];
            if (hasSubmittedSharesForVoteSession[voteSessionId][holder]) { // Use renamed mapping
                // Interactions: Transfer reward
                (bool success, ) = holder.call{value: rewardPerHolder}(bytes(""));
                // Note: If a single transfer fails, the whole function reverts.
                // Consider alternative patterns if partial distribution is acceptable.
                require(success, "Reward transfer failed");
                actualDistributed += rewardPerHolder;
            }
        }

        // Mark rewards as distributed
        rewardsHaveBeenDistributed[voteSessionId] = true;

        emit RewardsDistributed(voteSessionId, actualDistributed, eligibleHolderCount); // Use renamed event
    }

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import Reentrancy Guard (Correct path for OpenZeppelin v5.x)
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Import EnumerableSet for managing holder lists
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title TimedReleaseVoting
 * @dev Implements a voting system with timed release encryption, deposits, and rewards.
 */
contract TimedReleaseVoting is ReentrancyGuard { // Inherit ReentrancyGuard

    // Use EnumerableSet for AddressSet
    using EnumerableSet for EnumerableSet.AddressSet;

    // For debugging
    event LogMessage(string message);
    event LogUint(string label, uint256 value);
    event LogAddress(address addr);

    // ======== Struct Definitions ========

    // Renaming to VoteSession is a future task
    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string[] options;
        uint256 rewardPool; // ETH deposited for rewards
        uint256 electionDeposit; // ETH required for holders to deposit
    }

    // Represents an encrypted vote/ballot
    struct Vote {
        // string[] publicKey; // Keep as string if these are non-address keys? Or also address[]? Assume address[] for now.
        address[] holderAddresses; // Addresses of holders responsible for this vote/ballot
        string ciphertext; // Consider bytes?
        string g1r; // Consider bytes?
        string g2r; // Consider bytes?
        string[] alpha; // Consider bytes[]?
        address voter; // Voter identified by address
        uint256 threshold;
    }

    // Represents a submitted share
    struct Shares {
        uint256 voteIndex; // Index of the Vote/Ballot this share belongs to within the election
        address holderAddress; // Holder identified by address
        string share; // Consider bytes?
        uint256 index; // Index/identifier for the share itself (e.g., its position in the threshold scheme)
    }

    // Less necessary now, but kept for potential future use or clarity
    struct Holder {
        address holderAddress;
        uint256 electionId;
        bool active;
    }

    struct SecretKey {
        string secretkey;
    }

    // ======== Constants ========
    uint256 public constant MIN_HOLDERS = 3; // Example constant

    // ======== State Variables ========

    uint256 public electionCount;
    mapping(uint256 => Election) public election; // electionId => Election Data

    // Mapping: electionId => array of submitted Ballots/Votes
    mapping(uint256 => Vote[]) public votes;

    // Mapping: electionId => array of submitted Shares
    mapping(uint256 => Shares[]) public shares;

    // Mapping: electionId => array of secret keys (purpose unclear from context)
    mapping(uint256 => string[]) public secret_keys;

    // --- Status Tracking Mappings ---
    // electionId => holderAddress => isActive
    mapping(uint256 => mapping(address => bool)) public isHolderActiveForElection;
    // electionId => holderAddress => hasSubmitted
    mapping(uint256 => mapping(address => bool)) public hasSubmittedSharesForElection;
    // electionId => holderAddress => depositAmount
    mapping(uint256 => mapping(address => uint256)) public holderDeposits;

    // --- Holder Set per Election ---
    mapping(uint256 => EnumerableSet.AddressSet) private _activeHolders; // electionId => set of active holder addresses

    // --- Accounting Mappings (Optional but helpful) ---
    mapping(uint256 => uint256) public totalDepositsHeld;
     // electionId => total ETH held for rewards
    mapping(uint256 => uint256) public totalRewardsHeld;

    // ======== Events ========

    event HolderJoined(address indexed holderAddress, uint256 indexed electionId, uint256 depositAmount);
    event ElectionCreated(uint256 indexed id, string title); // Keep simple event
    event ElectionCreatedEvent ( // Keep detailed event if needed off-chain
        uint256 id,
        string title,
        string description,
        uint256 startDate,
        uint256 endDate,
        string[] options,
        uint256 rewardPool,
        uint256 electionDeposit
    );
    event VoteSubmitted( // Using address now
        uint256 indexed electionId,
        address[] holderAddresses, // Maybe don't emit large arrays?
        address indexed voter,
        uint256 threshold
    );
    event ShareSubmitted ( // Using address now
        uint256 indexed electionId,
        address indexed holderAddress,
        uint256 voteIndex, // Added voteIndex for context
        uint256 shareIndex // Renamed 'index' to 'shareIndex' for clarity
    );
    event SecretKeyEvent( // Keep as is
        uint256 electionId,
        string secretkey
    );
    event DepositClaimed(address indexed holderAddress, uint256 indexed electionId, uint256 amount);
    event RewardsDistributed(uint256 indexed electionId, uint256 totalRewardAmount, uint256 eligibleHolderCount);

    // ======== Constructor ========
    // constructor() { } // Add if needed

    // ======== Election Management ========

    function createElection(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string[] memory options,
        uint256 electionDeposit // Deposit amount required per holder
    ) public payable returns (uint256) { // Added payable
        uint256 currentId = electionCount;
        // Validate inputs
        require(bytes(title).length > 0, "Title required");
        require(startDate < endDate, "Start date must be before end date");
        require(startDate > block.timestamp, "Start date must be in the future");
        require(electionDeposit > 0, "Election deposit must be positive");
        require(msg.value > 0, "Reward pool must be funded"); // Check reward pool funding

        election[currentId] = Election(
            currentId,
            title,
            description,
            startDate,
            endDate,
            options,
            msg.value, // Store sent ETH as reward pool
            electionDeposit
        );
        totalRewardsHeld[currentId] = msg.value; // Track rewards held

        emit ElectionCreated(currentId, title);
        emit ElectionCreatedEvent(
            currentId, title, description, startDate, endDate, options, msg.value, electionDeposit
        );
        electionCount++;
        return currentId;
    }

    function getElection(uint256 electionId) public view returns (Election memory) {
        require(electionId < electionCount, "Election does not exist");
        return election[electionId];
    }

    // ======== Holder Management & Deposits ========

    function joinAsHolder(uint256 electionId) external payable nonReentrant {
        require(electionId < electionCount, "Election does not exist");
        Election storage currentElection = election[electionId]; // Use storage pointer
        require(block.timestamp < currentElection.startDate, "Election already started"); // Can only join before start
        address holderAddress = msg.sender;
        uint256 requiredDeposit = currentElection.electionDeposit;

        require(requiredDeposit > 0, "Deposit not set for election"); // Sanity check
        require(msg.value == requiredDeposit, "Incorrect deposit amount sent");
        // require(!isHolderActiveForElection[electionId][holderAddress], "Already active for this election"); // This check is implicitly done by EnumerableSet.add
        bool added = _activeHolders[electionId].add(holderAddress);
        require(added, "Holder already active for this election"); // Replicate require check

        // Store deposit amount
        holderDeposits[electionId][holderAddress] = msg.value;
        totalDepositsHeld[electionId] += msg.value; // Track total deposits

        // Mark as active (using the map for potentially faster single checks if needed)
        isHolderActiveForElection[electionId][holderAddress] = true;

        emit HolderJoined(holderAddress, electionId, msg.value);
    }

    // --- Deposit Claim Function ---
    function claimDeposit(uint256 electionId) external nonReentrant {
        require(electionId < electionCount, "Election does not exist");
        // Require election to be ended? Optional check.
        // require(block.timestamp > election[electionId].endDate, "Election not ended");
        address holderAddress = msg.sender;

        // Eligibility Check 1: Must have submitted shares
        require(hasSubmittedSharesForElection[electionId][holderAddress], "Shares not submitted");

        // Eligibility Check 2: Deposit must exist
        uint256 depositAmount = holderDeposits[electionId][holderAddress];
        require(depositAmount > 0, "No deposit found or already claimed");

        // Effects: Reset deposit *before* transfer
        holderDeposits[electionId][holderAddress] = 0;
        totalDepositsHeld[electionId] -= depositAmount; // Update total held

        // Interactions: Transfer deposit back
        (bool success, ) = holderAddress.call{value: depositAmount}(""); // Use call for safer transfer
        require(success, "Deposit transfer failed");

        emit DepositClaimed(holderAddress, electionId, depositAmount);
    }

    // --- Holder Set Accessors ---
    function getNumHoldersByElection(uint256 electionId) public view returns (uint256) {
        require(electionId < electionCount, "Election does not exist");
        return _activeHolders[electionId].length();
    }

    function getHoldersByElection(uint256 electionId) public view returns (address[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return _activeHolders[electionId].values();
    }

    function isHolderInElection(uint256 electionId, address holderAddress) public view returns (bool) {
        require(electionId < electionCount, "Election does not exist");
        return _activeHolders[electionId].contains(holderAddress);
        // Alternative: return isHolderActiveForElection[electionId][holderAddress]; // If map is kept synced
    }

    // --- Holder Status Views ---
    // NOTE: getNumHoldersByElection / getHoldersByElection that rely on iteration
    // need significant redesign if accurate on-chain counts/lists are required.
    // Requires adding per-election lists/counts updated during join/leave actions.
    // Example view function for a single holder:
    function getHolderStatus(uint256 electionId, address holderAddress)
        public view
        returns (bool isActive, bool hasSubmitted, uint256 deposit)
    {
         require(electionId < electionCount, "Election does not exist");
         isActive = isHolderActiveForElection[electionId][holderAddress];
         hasSubmitted = hasSubmittedSharesForElection[electionId][holderAddress];
         deposit = holderDeposits[electionId][holderAddress];
         return (isActive, hasSubmitted, deposit);
    }

    // ======== Voting / Ballot Submission ========

    function submitVote(
        uint256 electionId,
        address[] memory _holderAddresses,
        string memory ciphertext,
        string memory g1r,
        string memory g2r,
        string[] memory alpha,
        uint256 threshold
    ) public { // Removed voter parameter, it's msg.sender
        require(electionId < electionCount, "Election does not exist");
        Election storage currentElection = election[electionId];
        require(block.timestamp >= currentElection.startDate && block.timestamp <= currentElection.endDate, "Election not active");

        // Consider adding check if voter already voted (requires iterating votes[electionId])

        votes[electionId].push(Vote(
            _holderAddresses, ciphertext, g1r, g2r, alpha, msg.sender, threshold
        ));

        emit VoteSubmitted(electionId, _holderAddresses, msg.sender, threshold);
    }

    function getVotes(uint256 electionId) public view returns (Vote[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return votes[electionId];
    }


    // ======== Share Submission ========

    function submitShares(
        uint256 electionId,
        uint256[] memory voteIndices, // Indices of the Votes/Ballots these shares correspond to
        uint256[] memory shareIndices, // Indices of the shares themselves (e.g., 1 to k)
        string[] memory shareDataList // The actual share data
    ) public nonReentrant {
        require(electionId < electionCount, "Election does not exist");
        // Optional: Check if election is ended or in share submission phase
        // require(block.timestamp > election[electionId].endDate, "Voting not ended");

        address holderAddress = msg.sender;
        require(isHolderActiveForElection[electionId][holderAddress], "Not an active holder for this election");
        require(!hasSubmittedSharesForElection[electionId][holderAddress], "Shares already submitted for this election");
        require(voteIndices.length == shareIndices.length && voteIndices.length == shareDataList.length, "Input array lengths mismatch");

        // Store shares - consider gas implications if many shares submitted at once
        for (uint256 j = 0; j < shareDataList.length; j++) {
            // Add validation? e.g., voteIndices[j] < votes[electionId].length?
            shares[electionId].push(Shares(
                voteIndices[j],
                holderAddress,
                shareDataList[j],
                shareIndices[j] // Use provided share index
            ));
            emit ShareSubmitted(electionId, holderAddress, voteIndices[j], shareIndices[j]);
        }

        // Mark shares as submitted for this holder
        hasSubmittedSharesForElection[electionId][holderAddress] = true;
    }

     function getShares(uint256 electionId) public view returns (Shares[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return shares[electionId];
    }


    // ======== Reward Distribution ========

    function distributeRewards(uint256 electionId) external nonReentrant {
        require(electionId < electionCount, "Election does not exist");
        Election storage currentElection = election[electionId];
        require(block.timestamp > currentElection.endDate, "Election not ended");

        uint256 rewardPool = totalRewardsHeld[electionId];
        require(rewardPool > 0, "No rewards available or already distributed");

        // Get active holders using EnumerableSet
        address[] memory activeHolders = _activeHolders[electionId].values();
        uint256 totalHolderCount = activeHolders.length;
        require(totalHolderCount > 0, "No active holders found for this election");

        // Find eligible holders (those who submitted shares)
        address[] memory eligibleHolders = new address[](totalHolderCount); // Max possible size
        uint256 eligibleCount = 0;

        for (uint i = 0; i < totalHolderCount; i++) {
            if (hasSubmittedSharesForElection[electionId][activeHolders[i]]) {
                eligibleHolders[eligibleCount] = activeHolders[i];
                eligibleCount++;
            }
        }

        require(eligibleCount > 0, "No eligible holders found for rewards");

        uint256 rewardPerHolder = rewardPool / eligibleCount;
        require(rewardPerHolder > 0, "Reward per holder is zero"); // Prevent division errors / dust

        // Effects: Mark rewards as distributed *before* transfer loops
        totalRewardsHeld[electionId] = 0; // Reset pool tracking

        emit RewardsDistributed(electionId, rewardPool, eligibleCount);

        // Interactions: Transfer rewards
        // Loop only up to eligibleCount
        for (uint i = 0; i < eligibleCount; i++) {
            address recipient = eligibleHolders[i];
            (bool success, ) = recipient.call{value: rewardPerHolder}("");
            if (!success) {
                // Optionally emit an event for failed transfers
                // emit RewardTransferFailed(electionId, recipient, rewardPerHolder);
            }
        }
    }

    // ======== Secret Key Management ========
    // (Keep submitSecretKey, getSecretKeys as is for now)
     function submitSecretKey(uint256 electionId, string memory secretKey) public {
        require(electionId < electionCount, "Election does not exist");
        secret_keys[electionId].push(secretKey);
        emit SecretKeyEvent(electionId, secretKey);
    }

    function getSecretKeys(uint256 electionId) public view returns (string[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return secret_keys[electionId];
    }


    // ======== Fallback Function ========
    // receive() external payable {
    //     // Optional: handle plain ETH transfers if needed
    // }

}
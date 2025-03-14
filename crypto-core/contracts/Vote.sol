// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

/** 
 * @title Vote
 * @dev Implements voting creation and retrieval
 */
contract Vote {
    struct VoteStruct {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string status;
        uint256 participantCount;
        string[] options;
    }

    mapping(uint256 => VoteStruct) public votes; // Mapping for easy lookup
    mapping(uint256 => address[]) public secretHolders; // Mapping for secret holders of each vote
    uint256 public voteCount;

    event VoteCreated(uint256 id, string title);
    event SecretHolderAdded(uint256 voteId, address secretHolder);

    function createVote(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) public returns (uint256) {
        votes[voteCount] = VoteStruct(voteCount, title, description, startDate, endDate, status, participantCount, options);
        emit VoteCreated(voteCount, title);
        voteCount++;
        return voteCount - 1;
    }

    function getVote(uint256 voteId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) {
        require(voteId < voteCount, "Vote does not exist");
        VoteStruct memory v = votes[voteId];
        return (v.id, v.title, v.description, v.startDate, v.endDate, v.status, v.participantCount, v.options);
    }

    function addSecretHolder(uint256 voteId, address secretHolder) public {
        require(voteId < voteCount, "Vote does not exist");
        secretHolders[voteId].push(secretHolder);
        emit SecretHolderAdded(voteId, secretHolder);
    }

    function getSecretHolders(uint256 voteId) public view returns (address[] memory) {
        require(voteId < voteCount, "Vote does not exist");
        return secretHolders[voteId];
    }
}

// SPDX-License-Identifier: MITvoteCount1
pragma solidity ^0.8.0;

/**
 * @title TimedReleaseVoting
 * @dev Implements a voting system with timed release encryption
 * This contract combines vote management with threshold cryptography
 * to ensure votes remain secret until a predetermined time.
 */
contract TimedReleaseVoting {

    struct VoteStruct {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string status;
        uint256 participantCount;
        string[] options;
    }

    mapping(uint256 => VoteStruct) public votes1; // Mapping for easy lookup
    mapping(uint256 => address[]) public secretHolders; // Mapping for secret holders of each vote
    uint256 public voteCount1;

    event VoteCreated(uint256 id, string title);
    event SecretHolderAdded(uint256 voteId, address secretHolder);

    function createVote(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) public returns (uint256) {
        votes1[voteCount] = VoteStruct(voteCount1, title, description, startDate, endDate, status, participantCount, options);
        emit VoteCreated(voteCount1, title);
        voteCount1++;
        return voteCount1 - 1;
    }
    
    function getVote1(uint256 voteId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) {
        require(voteId < voteCount1, "Vote does not exist");
        VoteStruct memory v = votes1[voteId];
        return (v.id, v.title, v.description, v.startDate, v.endDate, v.status, v.participantCount, v.options);
    }

    // ======== State Variables ========
    
    // Holder management
    struct Holder {
        uint256[2] publicKey;  // BLS12-381 G1 point (x, y)
        uint256 deposit;
        bool active;
        uint256 rewards;  // Accumulated rewards for the holder
    }
    
    // Vote data structure
    struct Vote {
        bytes ciphertext;
        bytes nonce;
        uint256 decryptionTime;
        uint256[2] g2r;  // BLS12-381 G2 point for verification
        mapping(address => uint256[2]) shares;  // Submitted shares
        address[] shareSubmitters;  // List of addresses that submitted shares
        bool exists;
        uint256 reward;  // Reward amount for this vote
        bool rewardDistributed;  // Whether the reward has been distributed
        uint256 threshold;  // Minimum number of shares needed for decryption
    }
    
    // Constants
    uint256 public constant REQUIRED_DEPOSIT = 1 ether;  // Required deposit to become a holder
    uint256 public constant MIN_HOLDERS = 3;  // Minimum number of holders required for a vote
    uint256 public constant REWARD_PER_VOTE = 0.1 ether;  // Reward amount per vote to be distributed
    
    // State
    mapping(address => Holder) public holders;
    address[] public holderAddresses;
    mapping(uint256 => Vote) public votes;
    uint256 public voteCount;
    
    // ======== Events ========
    
    event HolderJoined(address indexed holderAddress, uint256[2] publicKey);
    event HolderExited(address indexed holderAddress);
    event VoteSubmitted(uint256 indexed voteId, uint256 decryptionTime, uint256 threshold);
    event ShareSubmitted(uint256 indexed voteId, address indexed holderAddress);
    event RewardDistributed(uint256 indexed voteId, uint256 totalReward, uint256 numRecipients);
    event RewardClaimed(address indexed holderAddress, uint256 amount);
    
    // ======== Modifiers ========
    
    modifier onlyHolder() {
        require(holders[msg.sender].active, "Caller is not a registered holder");
        _;
    }
    
    modifier voteExists(uint256 voteId) {
        require(votes[voteId].exists, "Vote does not exist");
        _;
    }
    
    modifier afterDecryptionTime(uint256 voteId) {
        require(block.timestamp >= votes[voteId].decryptionTime, "Decryption time not reached");
        _;
    }
    
    // ======== Core Functions ========
    
    /**
     * @dev Join as a secret holder by staking a deposit
     * @param publicKey The BLS12-381 public key of the holder
     */
    function joinAsHolder(uint256[2] memory publicKey) external payable {
        require(!holders[msg.sender].active, "Already a holder");
        require(msg.value >= REQUIRED_DEPOSIT, "Insufficient deposit");
        
        holders[msg.sender] = Holder({
            publicKey: publicKey,
            deposit: msg.value,
            active: true,
            rewards: 0
        });
        
        holderAddresses.push(msg.sender);
        
        emit HolderJoined(msg.sender, publicKey);
    }
    
    /**
     * @dev Exit as a secret holder and withdraw deposit
     */
    function exitAsHolder() external onlyHolder {
        // Check if holder has pending shares to submit for votes that have reached decryption time
        for (uint256 i = 0; i < voteCount; i++) {
            if (votes[i].exists && votes[i].decryptionTime <= block.timestamp) {
                // For votes that have reached decryption time, check if holder has submitted their share
                bool hasSubmitted = false;
                for (uint256 j = 0; j < votes[i].shareSubmitters.length; j++) {
                    if (votes[i].shareSubmitters[j] == msg.sender) {
                        hasSubmitted = true;
                        break;
                    }
                }
                require(hasSubmitted, "Must submit shares for all past votes");
            } else if (votes[i].exists && votes[i].decryptionTime > block.timestamp) {
                // For future votes, holder cannot exit
                revert("Cannot exit with pending future votes");
            }
        }
        
        // Mark as inactive
        holders[msg.sender].active = false;
        
        // Return deposit
        uint256 depositAmount = holders[msg.sender].deposit;
        holders[msg.sender].deposit = 0;
        payable(msg.sender).transfer(depositAmount);
        
        emit HolderExited(msg.sender);
    }
    
    /**
     * @dev Submit an encrypted vote
     * @param ciphertext The encrypted vote data
     * @param nonce The encryption nonce
     * @param decryptionTime The time when the vote can be decrypted
     * @param g2r The G2 point used for share verification
     * @param threshold The minimum number of shares needed for decryption
     */
    function submitVote(
        bytes calldata ciphertext,
        bytes calldata nonce,
        uint256 decryptionTime,
        uint256[2] calldata g2r,
        uint256 threshold
    ) external payable {
        require(getNumHolders() >= MIN_HOLDERS, "Not enough holders");
        require(decryptionTime > block.timestamp, "Decryption time must be in the future");
        require(threshold >= 2, "Threshold must be at least 2");
        require(threshold <= getNumHolders(), "Threshold cannot exceed number of holders");
        
        uint256 voteId = voteCount++;
        
        // Initialize the vote
        votes[voteId].ciphertext = ciphertext;
        votes[voteId].nonce = nonce;
        votes[voteId].decryptionTime = decryptionTime;
        votes[voteId].g2r = g2r;
        votes[voteId].exists = true;
        votes[voteId].reward = msg.value > 0 ? msg.value : REWARD_PER_VOTE;
        votes[voteId].rewardDistributed = false;
        votes[voteId].threshold = threshold;  // Store the threshold
        
        emit VoteSubmitted(voteId, decryptionTime, threshold);
    }
    
    /**
     * @dev Submit a share for a vote
     * @param voteId The ID of the vote
     * @param shareIndex The index of the share
     * @param shareValue The value of the share
     */
    function submitShare(
        uint256 voteId,
        uint256 shareIndex,
        uint256 shareValue
    ) external onlyHolder voteExists(voteId) afterDecryptionTime(voteId) {
        // Store the share
        votes[voteId].shares[msg.sender] = [shareIndex, shareValue];
        votes[voteId].shareSubmitters.push(msg.sender);
        
        emit ShareSubmitted(voteId, msg.sender);
        
        // Distribute rewards if all holders have submitted their shares
        if (votes[voteId].shareSubmitters.length == getNumHolders() && !votes[voteId].rewardDistributed) {
            distributeRewards(voteId);
        }
    }
    
    /**
     * @dev Manually trigger reward distribution for a vote
     * @param voteId The ID of the vote
     */
    function triggerRewardDistribution(uint256 voteId) external voteExists(voteId) afterDecryptionTime(voteId) {
        // Ensure some time has passed after decryption time to give holders a chance to submit
        require(block.timestamp >= votes[voteId].decryptionTime + 1 hours, "Wait at least 1 hour after decryption time");
        require(!votes[voteId].rewardDistributed, "Rewards already distributed");
        require(votes[voteId].shareSubmitters.length > 0, "No shares submitted");
        
        distributeRewards(voteId);
    }
    
    /**
     * @dev Distribute rewards for a vote
     * @param voteId The ID of the vote
     */
    function distributeRewards(uint256 voteId) internal voteExists(voteId) {
        require(!votes[voteId].rewardDistributed, "Rewards already distributed");
        require(votes[voteId].shareSubmitters.length > 0, "No shares submitted");
        
        uint256 totalReward = votes[voteId].reward;
        uint256 numRecipients = votes[voteId].shareSubmitters.length;
        
        // If all holders submitted their shares, distribute evenly
        if (numRecipients == getNumHolders()) {
            uint256 rewardPerHolder = totalReward / numRecipients;
            
            for (uint256 i = 0; i < numRecipients; i++) {
                address holderAddress = votes[voteId].shareSubmitters[i];
                holders[holderAddress].rewards += rewardPerHolder;
            }
        } else {
            // If some holders didn't submit, distribute only to those who did
            uint256 rewardPerHolder = totalReward / numRecipients;
            
            for (uint256 i = 0; i < numRecipients; i++) {
                address holderAddress = votes[voteId].shareSubmitters[i];
                holders[holderAddress].rewards += rewardPerHolder;
            }
        }
        
        votes[voteId].rewardDistributed = true;
        
        emit RewardDistributed(voteId, totalReward, numRecipients);
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external onlyHolder {
        uint256 rewardAmount = holders[msg.sender].rewards;
        require(rewardAmount > 0, "No rewards to claim");
        
        holders[msg.sender].rewards = 0;
        payable(msg.sender).transfer(rewardAmount);
        
        emit RewardClaimed(msg.sender, rewardAmount);
    }
    
    /**
     * @dev Force exit a holder who failed to submit shares
     * @param holderAddress The address of the holder to force exit
     * @param voteId The ID of the vote for which the holder failed to submit a share
     */
    function forceExitHolder(address holderAddress, uint256 voteId) external voteExists(voteId) {
        require(votes[voteId].decryptionTime <= block.timestamp, "Decryption time not reached");
        require(holders[holderAddress].active, "Not an active holder");
        
        // Check if holder has submitted their share
        bool hasSubmitted = false;
        for (uint256 i = 0; i < votes[voteId].shareSubmitters.length; i++) {
            if (votes[voteId].shareSubmitters[i] == holderAddress) {
                hasSubmitted = true;
                break;
            }
        }
        
        // If holder has submitted, they cannot be force exited
        require(!hasSubmitted, "Holder has submitted their share");
        
        // Mark as inactive
        holders[holderAddress].active = false;
        
        // Forfeit deposit - it stays in the contract
        holders[holderAddress].deposit = 0;
        
        emit HolderExited(holderAddress);
    }
    
    // ======== View Functions ========
    
    /**
     * @dev Get the number of registered holders
     * @return The number of holders
     */
    function getNumHolders() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < holderAddresses.length; i++) {
            if (holders[holderAddresses[i]].active) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get the public key of a holder
     * @param holderAddress The address of the holder
     * @return The public key of the holder
     */
    function getHolderPublicKey(address holderAddress) external view returns (uint256[2] memory) {
        require(holders[holderAddress].active, "Not an active holder");
        return holders[holderAddress].publicKey;
    }
    
    /**
     * @dev Get all registered holders
     * @return Array of holder addresses
     */
    function getHolders() external view returns (address[] memory) {
        uint256 activeCount = getNumHolders();
        address[] memory activeHolders = new address[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < holderAddresses.length; i++) {
            if (holders[holderAddresses[i]].active) {
                activeHolders[index] = holderAddresses[i];
                index++;
            }
        }
        
        return activeHolders;
    }
    
    /**
     * @dev Get vote data
     * @param voteId The ID of the vote
     * @return ciphertext The encrypted vote data
     * @return nonce The encryption nonce
     * @return decryptionTime The time when the vote can be decrypted
     * @return g2r The G2 point used for share verification
     * @return threshold The minimum number of shares needed for decryption
     */
    function getVote(uint256 voteId) external view voteExists(voteId) returns (
        bytes memory ciphertext,
        bytes memory nonce,
        uint256 decryptionTime,
        uint256[2] memory g2r,
        uint256 threshold
    ) {
        return (
            votes[voteId].ciphertext,
            votes[voteId].nonce,
            votes[voteId].decryptionTime,
            votes[voteId].g2r,
            votes[voteId].threshold
        );
    }
    
    /**
     * @dev Get submitted shares for a vote
     * @param voteId The ID of the vote
     * @return submitters Array of holder addresses that submitted shares
     * @return shares Array of shares submitted by holders
     */
    function getSubmittedShares(uint256 voteId) external view voteExists(voteId) returns (
        address[] memory submitters,
        uint256[2][] memory shares
    ) {
        submitters = votes[voteId].shareSubmitters;
        shares = new uint256[2][](submitters.length);
        
        for (uint256 i = 0; i < submitters.length; i++) {
            shares[i] = votes[voteId].shares[submitters[i]];
        }
        
        return (submitters, shares);
    }
    
    /**
     * @dev Check if an address is a registered holder
     * @param holderAddress The address to check
     * @return True if the address is a registered holder
     */
    function isHolder(address holderAddress) external view returns (bool) {
        return holders[holderAddress].active;
    }
    
    /**
     * @dev Get the required deposit amount
     * @return The required deposit amount in wei
     */
    function requiredDeposit() external pure returns (uint256) {
        return REQUIRED_DEPOSIT;
    }
    
    /**
     * @dev Get the accumulated rewards for a holder
     * @param holderAddress The address of the holder
     * @return The accumulated rewards for the holder
     */
    function getHolderRewards(address holderAddress) external view returns (uint256) {
        return holders[holderAddress].rewards;
    }
    
    /**
     * @dev Get vote reward amount
     * @param voteId The ID of the vote
     * @return The reward amount for the vote
     */
    function getVoteReward(uint256 voteId) external view voteExists(voteId) returns (uint256) {
        return votes[voteId].reward;
    }
} 
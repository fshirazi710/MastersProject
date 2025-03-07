// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TimedReleaseVoting
 * @dev Implements a voting system with timed release encryption
 * This contract combines vote management with threshold cryptography
 * to ensure votes remain secret until a predetermined time.
 */
contract TimedReleaseVoting {
    // ======== State Variables ========
    
    // Holder management
    struct Holder {
        uint256[2] publicKey;  // BLS12-381 G1 point (x, y)
        uint256 deposit;
        bool active;
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
    }
    
    // Constants
    uint256 public constant REQUIRED_DEPOSIT = 1 ether;  // Required deposit to become a holder
    uint256 public constant MIN_HOLDERS = 3;  // Minimum number of holders required for a vote
    
    // State
    mapping(address => Holder) public holders;
    address[] public holderAddresses;
    mapping(uint256 => Vote) public votes;
    uint256 public voteCount;
    
    // ======== Events ========
    
    event HolderJoined(address indexed holderAddress, uint256[2] publicKey);
    event HolderExited(address indexed holderAddress);
    event VoteSubmitted(uint256 indexed voteId, uint256 decryptionTime);
    event ShareSubmitted(uint256 indexed voteId, address indexed holderAddress);
    
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
            active: true
        });
        
        holderAddresses.push(msg.sender);
        
        emit HolderJoined(msg.sender, publicKey);
    }
    
    /**
     * @dev Exit as a secret holder and withdraw deposit
     */
    function exitAsHolder() external onlyHolder {
        // Check if holder has pending shares to submit
        // This is a simplified check - in production, you'd want more sophisticated logic
        for (uint256 i = 0; i < voteCount; i++) {
            if (votes[i].decryptionTime > block.timestamp) {
                require(votes[i].shares[msg.sender][0] != 0, "Pending shares to submit");
            }
        }
        
        // Mark as inactive
        holders[msg.sender].active = false;
        
        // Return deposit
        payable(msg.sender).transfer(holders[msg.sender].deposit);
        
        emit HolderExited(msg.sender);
    }
    
    /**
     * @dev Submit an encrypted vote
     * @param ciphertext The encrypted vote data
     * @param nonce The encryption nonce
     * @param decryptionTime The time when the vote can be decrypted
     * @param g2r The G2 point used for share verification
     */
    function submitVote(
        bytes calldata ciphertext,
        bytes calldata nonce,
        uint256 decryptionTime,
        uint256[2] calldata g2r
    ) external {
        require(getNumHolders() >= MIN_HOLDERS, "Not enough holders");
        require(decryptionTime > block.timestamp, "Decryption time must be in the future");
        
        uint256 voteId = voteCount++;
        
        // Initialize the vote
        votes[voteId].ciphertext = ciphertext;
        votes[voteId].nonce = nonce;
        votes[voteId].decryptionTime = decryptionTime;
        votes[voteId].g2r = g2r;
        votes[voteId].exists = true;
        
        emit VoteSubmitted(voteId, decryptionTime);
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
     */
    function getVote(uint256 voteId) external view voteExists(voteId) returns (
        bytes memory ciphertext,
        bytes memory nonce,
        uint256 decryptionTime,
        uint256[2] memory g2r
    ) {
        return (
            votes[voteId].ciphertext,
            votes[voteId].nonce,
            votes[voteId].decryptionTime,
            votes[voteId].g2r
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
} 
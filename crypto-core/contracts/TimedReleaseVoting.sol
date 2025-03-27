// SPDX-License-Identifier: MITelectionCount
pragma solidity ^0.8.0;

/**
 * @title TimedReleaseVoting
 * @dev Implements a voting system with timed release encryption
 * This contract combines vote management with threshold cryptography
 * to ensure votes remain secret until a predetermined time.
 */
contract TimedReleaseVoting {

    // ======== State Variables ========

    struct Vote {
        string[] publicKey;
        string ciphertext;
        string g1r;
        string g2r;
        string[] alpha;
        uint256 threshold;
    }

    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string[] options;
        uint256 rewardPool;
        uint256 electionDeposit;
    }

    struct Holder {
        string publicKey;
        uint256 electionId;
        bool active;
        uint256 rewards;
    }
    
    struct SecretKey {
        string secretkey;
    }

    // Constants
    uint256 public constant REQUIRED_DEPOSIT = 1 ether;  // Required deposit to become a holder
    uint256 public constant MIN_HOLDERS = 3;  // Minimum number of holders required for a vote
    uint256 public constant REWARD_PER_VOTE = 0.1 ether;  // Reward amount per vote to be distributed
    
    // State
    string[] public holderAddresses;
    uint256 public electionCount;
    uint256 public voteCount;
    mapping(string => Holder) public holders;
    mapping(uint256 => Election) public election;
    mapping(uint256 => Vote[]) public votes;
    mapping(uint256 => string[]) public secret_keys; 
    
    // ======== Events ========
    
    event HolderJoined(string indexed publicKey, uint256 electionId);
    event ElectionCreated(uint256 id, string title);
    event VoteSubmitted(
        uint256 electionId,
        string[] publicKey,
        string ciphertext,
        string g1r,
        string g2r,
        string[] alpha,
        uint256 threshold
    );
    event SecretKeyEvent(
        uint256 electionId,
        string secretkey
    );

    // ======== Core Functions ========
    
    function submitSecretKey(uint256 electionId, string memory secretKey) public {
        require(electionId < electionCount, "Election does not exist");
        secret_keys[electionId].push(secretKey);
        emit SecretKeyEvent(electionId, secretKey);
    }

    function getSecretKeys(uint256 electionId) public view returns (string[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return secret_keys[electionId];
    }

    function createElection(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string[] memory options,
        uint256 rewardPool,
        uint256 electionDeposit
    ) public returns (uint256) {
        election[electionCount] = Election(electionCount, title, description, startDate, endDate, options, rewardPool, electionDeposit);
        emit ElectionCreated(electionCount, title);
        electionCount++;
        return electionCount - 1;
    }
    
    function getElection(uint256 voteId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string[] memory options,
        uint256 rewardPool,
        uint256 electionDeposit
    ) {
        require(voteId < electionCount, "Election does not exist");
        Election memory v = election[voteId];
        return (v.id, v.title, v.description, v.startDate, v.endDate, v.options, v.rewardPool, v.electionDeposit);
    }

    function submitVote(
        uint256 electionId,
        string[] memory publicKey,
        string memory ciphertext,
        string memory g1r,
        string memory g2r,
        string[] memory alpha,
        uint256 threshold
    ) public {
        require(electionId < electionCount, "Election does not exist");

        votes[electionId].push(Vote(publicKey, ciphertext, g1r, g2r, alpha, threshold));

        emit VoteSubmitted(electionId, publicKey, ciphertext, g1r, g2r, alpha, threshold);
    }

    function getVotes(uint256 electionId) public view returns (Vote[] memory) {
        require(electionId < electionCount, "Election does not exist");
        return votes[electionId];
    }
    
    function joinAsHolder(uint256 electionId, string memory publicKey) external payable {
        require(!holders[publicKey].active, "Already a holder");

        holders[publicKey] = Holder({
            publicKey: publicKey,
            electionId: electionId,
            active: true,
            rewards: 0
        });

        holderAddresses.push(publicKey);

        emit HolderJoined(publicKey, electionId);
    }
    
    function getNumHoldersByElection(uint256 electionId) public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < holderAddresses.length; i++) {
            if (holders[holderAddresses[i]].active && holders[holderAddresses[i]].electionId == electionId) {
                count++;
            }
        }
        return count;
    }
    
    function getHoldersByElection(uint256 electionId) external view returns (string[] memory) {
        uint256 activeCount = getNumHoldersByElection(electionId);
        string[] memory activeHolders = new string[](activeCount);

        uint256 index = 0;
        for (uint256 i = 0; i < holderAddresses.length; i++) {
            if (holders[holderAddresses[i]].active && holders[holderAddresses[i]].electionId == electionId) {
                activeHolders[index] = holderAddresses[i];
                index++;
            }
        }

        return activeHolders;
    }
}
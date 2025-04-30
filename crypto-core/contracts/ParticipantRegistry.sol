// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Structs library
import "./Structs.sol";
// Import Interfaces
import "./interfaces/IVoteSession.sol"; // Corrected interface import
// Import OpenZeppelin contracts
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
// Import Initializable base
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ParticipantRegistry
 * @dev Manages participants using Structs.ParticipantInfo.
 * Designed to be cloned using EIP-1167 proxies.
 */
contract ParticipantRegistry is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    // Using declaration for structs defined in the library
    using Structs for Structs.ParticipantInfo;

    // --- Structs ---
    // Removed local ParticipantInfo struct definition - now imported from Structs.sol

    // --- State Variables ---
    // Use Structs.ParticipantInfo in mapping
    mapping(uint256 => mapping(address => Structs.ParticipantInfo)) public participants;
    mapping(uint256 => uint256) public totalRewardPool;
    mapping(uint256 => EnumerableSet.AddressSet) private activeHolders;
    mapping(uint256 => address) public voteSessionContracts;
    mapping(uint256 => mapping(address => uint256)) public rewardsOwed;
    mapping(uint256 => mapping(address => bool)) public rewardClaimed;
    mapping(uint256 => mapping(address => bool)) public depositClaimed;

    // --- Events ---
    event VoteSessionContractSet(uint256 indexed sessionId, address indexed sessionContract);
    event HolderRegistered(uint256 indexed sessionId, address indexed holder, uint256 depositAmount, string blsPublicKeyHex);
    event VoterRegistered(uint256 indexed sessionId, address indexed voter);
    event SharesSubmissionRecorded(uint256 indexed sessionId, address indexed holder);
    event RewardsCalculated(uint256 indexed sessionId, address indexed calculator, uint256 totalRewardPoolCalculated);
    event RewardClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount);
    event DepositClaimed(uint256 indexed sessionId, address indexed claimer, uint256 amount);

    // --- Modifiers ---
    modifier onlyVoteSession(uint256 sessionId) {
        require(voteSessionContracts[sessionId] != address(0), "Registry: Session contract not set");
        require(msg.sender == voteSessionContracts[sessionId], "Registry: Caller is not the VoteSession contract");
        _;
    }

    // --- REMOVED Constructor --- //
    // constructor(address initialOwner) Ownable(initialOwner) {}

    // --- Disabled Constructor for Implementation Contract ---
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() /* Ownable(address(0)) - Removed */ {
        _disableInitializers();
    }

    // --- Initializer Function ---
    /**
     * @dev Initializes the contract, setting the initial owner.
     * Can only be called once.
     */
    function initialize(address initialOwner) public initializer {
        // Initialize Ownable, ReentrancyGuard
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        // Removed: _transferOwnership(initialOwner);
    }

    // --- Owner Functions ---
    function setVoteSessionContract(uint256 sessionId, address sessionContract) external onlyOwner {
        require(sessionContract != address(0), "Registry: Session contract cannot be zero address");
        require(voteSessionContracts[sessionId] == address(0), "Registry: Session contract already set");
        voteSessionContracts[sessionId] = sessionContract;
        emit VoteSessionContractSet(sessionId, sessionContract);
    }

    /**
     * @dev Allows the owner to add external funding to the reward pool for a session.
     */
    function addRewardFunding(uint256 sessionId) external payable onlyOwner {
        require(voteSessionContracts[sessionId] != address(0), "Registry: Session does not exist");
        require(msg.value > 0, "Registry: Funding amount must be positive");
        totalRewardPool[sessionId] += msg.value;
        // Optional: Emit an event for funding added
        // emit RewardFundingAdded(sessionId, msg.sender, msg.value);
    }

    // --- Registration Functions ---
    function joinAsHolder(uint256 sessionId, string memory blsPublicKeyHex) external payable nonReentrant {
        address participant = msg.sender;
        address sessionContractAddress = voteSessionContracts[sessionId];
        require(sessionContractAddress != address(0), "Registry: Session contract not set");
        IVoteSession sessionContract = IVoteSession(sessionContractAddress);

        require(sessionContract.isRegistrationOpen(), "Registry: Registration closed");
        require(!participants[sessionId][participant].isRegistered, "Registry: Already registered");
        uint256 requiredDeposit = sessionContract.getRequiredDeposit();
        require(msg.value == requiredDeposit, "Registry: Incorrect deposit amount");

        participants[sessionId][participant] = Structs.ParticipantInfo({
            isRegistered: true,
            isHolder: true,
            depositAmount: msg.value,
            blsPublicKeyHex: blsPublicKeyHex,
            hasSubmittedShares: false
        });
        bool added = activeHolders[sessionId].add(participant);
        require(added, "Registry: Failed to add holder to set");

        emit HolderRegistered(sessionId, participant, msg.value, blsPublicKeyHex);
    }

    function registerAsVoter(uint256 sessionId) external nonReentrant {
        address participant = msg.sender;
        address sessionContractAddress = voteSessionContracts[sessionId];
        require(sessionContractAddress != address(0), "Registry: Session contract not set");
        IVoteSession sessionContract = IVoteSession(sessionContractAddress);

        require(sessionContract.isRegistrationOpen(), "Registry: Registration closed");
        require(!participants[sessionId][participant].isRegistered, "Registry: Already registered");

        participants[sessionId][participant] = Structs.ParticipantInfo({
            isRegistered: true,
            isHolder: false,
            depositAmount: 0,
            blsPublicKeyHex: "",
            hasSubmittedShares: false
        });

        emit VoterRegistered(sessionId, participant);
    }

    // --- Vote Session Interaction Functions ---
    function recordShareSubmission(uint256 sessionId, address holder) external onlyVoteSession(sessionId) {
        require(participants[sessionId][holder].isHolder, "Registry: Participant is not a holder");
        require(!participants[sessionId][holder].hasSubmittedShares, "Registry: Shares already recorded");

        participants[sessionId][holder].hasSubmittedShares = true;
        emit SharesSubmissionRecorded(sessionId, holder);
    }

    function calculateRewards(uint256 sessionId) external nonReentrant {
        address sessionContractAddress = voteSessionContracts[sessionId];
        require(sessionContractAddress != address(0), "Registry: Session contract not set");
        require(msg.sender == owner() || msg.sender == sessionContractAddress, "Registry: Not authorized");
        IVoteSession sessionContract = IVoteSession(sessionContractAddress);

        require(sessionContract.isRewardCalculationPeriodActive(), "Registry: Not time for reward calculation");

        // Start with externally added funds
        uint256 currentRewardPool = totalRewardPool[sessionId];
        uint256 eligibleHolderCount = 0;
        uint256 totalForfeitedDeposits = 0;

        address[] memory holders = activeHolders[sessionId].values();
        for (uint i = 0; i < holders.length; i++) {
            Structs.ParticipantInfo storage participant = participants[sessionId][holders[i]];
            if (participant.isHolder) { // Double check they are still marked as holder
                if (participant.hasSubmittedShares) {
                    eligibleHolderCount++;
                } else {
                    // Add deposit of non-submitters to the reward pool
                    totalForfeitedDeposits += participant.depositAmount;
                }
            }
        }

        currentRewardPool += totalForfeitedDeposits;

        require(currentRewardPool > 0, "Registry: No reward pool available (no funding or forfeits)");
        require(eligibleHolderCount > 0, "Registry: No eligible holders for rewards");

        uint256 rewardPerEligibleHolder = currentRewardPool / eligibleHolderCount;
        // The remainder (dust) from the division remains in the contract, implicitly undistributed.

        for (uint i = 0; i < holders.length; i++) {
            address holder = holders[i];
            // Only assign rewards to eligible holders who haven't been assigned yet
            if (participants[sessionId][holder].hasSubmittedShares && rewardsOwed[sessionId][holder] == 0) {
                rewardsOwed[sessionId][holder] = rewardPerEligibleHolder;
            }
        }
        // Note: We emit the *total calculated* pool, not just initial funding
        emit RewardsCalculated(sessionId, msg.sender, currentRewardPool);
    }

    // --- Claim Functions ---
    function claimReward(uint256 sessionId) external nonReentrant {
        address payable claimer = payable(msg.sender);
        uint256 rewardAmount = rewardsOwed[sessionId][claimer];

        // Check claimed status *before* checking amount
        require(!rewardClaimed[sessionId][claimer], "Registry: Reward already claimed");
        require(rewardAmount > 0, "Registry: No reward owed or calculation pending");

        // Checks-Effects-Interaction Pattern
        rewardsOwed[sessionId][claimer] = 0; // Effect: Clear owed amount first
        rewardClaimed[sessionId][claimer] = true; // Effect: Mark as claimed

        // Interaction: Transfer funds
        (bool success, ) = claimer.call{value: rewardAmount}("");
        require(success, "Registry: Reward transfer failed");
        emit RewardClaimed(sessionId, claimer, rewardAmount);
    }

    function claimDeposit(uint256 sessionId) external nonReentrant {
        address sessionContractAddress = voteSessionContracts[sessionId];
        require(sessionContractAddress != address(0), "Registry: Session contract not set");
        IVoteSession sessionContract = IVoteSession(sessionContractAddress);

        require(sessionContract.isDepositClaimPeriodActive(), "Registry: Not time for deposit claim");

        address payable claimer = payable(msg.sender);
        Structs.ParticipantInfo storage participant = participants[sessionId][claimer];
        uint256 depositAmount = participant.depositAmount;

        // Check eligibility & claimed status *before* checking amount > 0
        require(participant.isHolder, "Registry: Not a holder");
        require(!depositClaimed[sessionId][claimer], "Registry: Deposit already claimed");
        require(participant.hasSubmittedShares, "Registry: Shares not submitted");
        require(depositAmount > 0, "Registry: No deposit to claim");

        participant.depositAmount = 0;
        depositClaimed[sessionId][claimer] = true;

        (bool success, ) = claimer.call{value: depositAmount}("");
        require(success, "Registry: Deposit transfer failed");
        emit DepositClaimed(sessionId, claimer, depositAmount);
    }

    // --- View Functions ---
    function getParticipantInfo(uint256 sessionId, address participant) external view returns (Structs.ParticipantInfo memory) {
        return participants[sessionId][participant];
    }

    function getActiveHolders(uint256 sessionId) external view returns (address[] memory) {
        return activeHolders[sessionId].values();
    }

    function getNumberOfActiveHolders(uint256 sessionId) external view returns (uint256) {
        return activeHolders[sessionId].length();
    }

    /**
     * @dev Returns the 1-based index of a participant within the activeHolders set for a session.
     * Returns 0 if the participant is not found in the active set.
     * Note: Iteration can be gas-intensive for large sets.
     */
    function getParticipantIndex(uint256 sessionId, address participant) external view returns (uint256) {
        EnumerableSet.AddressSet storage holders = activeHolders[sessionId];
        uint256 holderCount = holders.length();
        for (uint256 i = 0; i < holderCount; i++) {
            if (holders.at(i) == participant) {
                return i + 1; // Return 1-based index
            }
        }
        return 0; // Not found
    }

    function getHolderBlsKeys(uint256 sessionId) external view returns (address[] memory, string[] memory) {
        address[] memory holders = activeHolders[sessionId].values();
        string[] memory blsKeys = new string[](holders.length);
        for (uint i = 0; i < holders.length; i++) {
            blsKeys[i] = participants[sessionId][holders[i]].blsPublicKeyHex;
        }
        return (holders, blsKeys);
    }

    function getTotalRewardPool(uint256 sessionId) external view returns (uint256) {
        return totalRewardPool[sessionId];
    }
} 
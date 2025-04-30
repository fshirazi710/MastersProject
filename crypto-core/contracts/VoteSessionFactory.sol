// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ParticipantRegistry.sol";
import "./VoteSession.sol";

/**
 * @title VoteSessionFactory
 * @dev Factory contract to deploy new VoteSession and ParticipantRegistry instances.
 */
contract VoteSessionFactory is Ownable {

    // Array to keep track of deployed VoteSession contract addresses
    address[] public deployedVoteSessions;
    // Mapping from session ID to VoteSession address
    mapping(uint256 => address) public voteSessionAddresses;
    // Mapping from session ID to ParticipantRegistry address
    mapping(uint256 => address) public registryAddresses;

    // Event emitted when a new pair of contracts is deployed
    event SessionPairDeployed(
        uint256 indexed sessionId,
        address indexed voteSessionContract,
        address indexed participantRegistryContract,
        address owner // The owner of the new contracts
    );

    // Track the next session ID
    uint256 private nextSessionId = 0;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Deploys a new ParticipantRegistry and a new VoteSession.
     * The caller (owner of this factory) becomes the owner of both new contracts.
     * Linking (Registry -> Session) must be done externally by the owner calling setVoteSessionContract on the registry.
     * @param _title Title for the new VoteSession.
     * @param _description Description for the new VoteSession.
     * @param _startDate Start date (timestamp) for voting.
     * @param _endDate End date (timestamp) for voting.
     * @param _sharesEndDate End date (timestamp) for share submission.
     * @param _options Array of voting options (strings).
     * @param _metadata Metadata string (e.g., JSON) for UI hints.
     * @param _requiredDeposit Deposit amount required for holders in the new session.
     * @param _minShareThreshold Minimum share threshold for votes in the new session.
     * @return voteSessionAddress_ The address of the newly deployed VoteSession contract.
     * @return registryAddress_ The address of the newly deployed ParticipantRegistry contract.
     */
    function createSessionPair(
        string memory _title,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _sharesEndDate,
        string[] memory _options,
        string memory _metadata,
        uint256 _requiredDeposit,
        uint256 _minShareThreshold
    ) external onlyOwner returns (address voteSessionAddress_, address registryAddress_) {

        uint256 currentSessionId = nextSessionId;
        address deployer = owner(); // Factory owner will own the new contracts

        // 1. Deploy ParticipantRegistry
        ParticipantRegistry newRegistry = new ParticipantRegistry(deployer);
        registryAddress_ = address(newRegistry);

        // 2. Deploy VoteSession, passing the new registry address and session ID
        VoteSession newVoteSession = new VoteSession(
            currentSessionId,
            registryAddress_,
            deployer,
            _title,
            _description,
            _startDate,
            _endDate,
            _sharesEndDate,
            _options,
            _metadata,
            _requiredDeposit,
            _minShareThreshold
        );
        voteSessionAddress_ = address(newVoteSession);

        // 3. LINKING REMOVED - Must be done externally by the owner
        // newRegistry.setVoteSessionContract(currentSessionId, voteSessionAddress_);

        // 4. Store addresses and update counter
        deployedVoteSessions.push(voteSessionAddress_);
        voteSessionAddresses[currentSessionId] = voteSessionAddress_;
        registryAddresses[currentSessionId] = registryAddress_;
        nextSessionId++;

        // 5. Emit event
        emit SessionPairDeployed(currentSessionId, voteSessionAddress_, registryAddress_, deployer);

        // Return addresses
        // return (voteSessionAddress_, registryAddress_); // Return values are named
    }

    /**
     * @dev Gets the number of deployed VoteSession contracts.
     */
    function getDeployedSessionCount() external view returns (uint256) {
        return deployedVoteSessions.length;
    }

     /**
     * @dev Gets the address of a deployed VoteSession contract by its index.
     */
    function getVoteSessionAddressByIndex(uint256 index) external view returns (address) {
        require(index < deployedVoteSessions.length, "Index out of bounds");
        return deployedVoteSessions[index];
    }

     /**
     * @dev Gets the address of a deployed VoteSession contract by its session ID.
     */
    function getVoteSessionAddressById(uint256 sessionId_) external view returns (address) {
        require(voteSessionAddresses[sessionId_] != address(0), "Session ID not found");
        return voteSessionAddresses[sessionId_];
    }

    /**
     * @dev Gets the address of a deployed ParticipantRegistry contract by its session ID.
     */
    function getRegistryAddressById(uint256 sessionId_) external view returns (address) {
         require(registryAddresses[sessionId_] != address(0), "Session ID not found");
        return registryAddresses[sessionId_];
    }
} 
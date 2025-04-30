// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol"; // Import Clones
import "./ParticipantRegistry.sol";
import "./VoteSession.sol";
// Need interfaces for initialization calls
import "./interfaces/IParticipantRegistryInitializable.sol";
import "./interfaces/IVoteSessionInitializable.sol";

/**
 * @title VoteSessionFactory
 * @dev Factory contract to deploy VoteSession and ParticipantRegistry clones (EIP-1167).
 */
contract VoteSessionFactory is Ownable {
    // Implementation contract addresses
    address public immutable registryImplementation;
    address public immutable voteSessionImplementation;

    // Array to keep track of deployed VoteSession proxy addresses
    address[] public deployedVoteSessions;
    // Mapping from session ID to VoteSession proxy address
    mapping(uint256 => address) public voteSessionAddresses;
    // Mapping from session ID to ParticipantRegistry proxy address
    mapping(uint256 => address) public registryAddresses;

    // Event emitted when a new pair of proxies is deployed
    event SessionPairDeployed(
        uint256 indexed sessionId,
        address indexed voteSessionContract, // Proxy address
        address indexed participantRegistryContract, // Proxy address
        address owner // The owner of the new proxies
    );

    // Track the next session ID
    uint256 private nextSessionId = 0;

    constructor(address initialOwner, address _registryImplementation, address _voteSessionImplementation) Ownable(initialOwner) {
        require(_registryImplementation != address(0), "Factory: Invalid registry implementation");
        require(_voteSessionImplementation != address(0), "Factory: Invalid session implementation");
        registryImplementation = _registryImplementation;
        voteSessionImplementation = _voteSessionImplementation;
    }

    /**
     * @dev Deploys clones of ParticipantRegistry and VoteSession, initializes them, and links them.
     * The caller (owner of this factory) becomes the owner of both new proxy contracts.
     * @param _title Title for the new VoteSession.
     * @param _description Description for the new VoteSession.
     * @param _startDate Start date (timestamp) for voting.
     * @param _endDate End date (timestamp) for voting.
     * @param _sharesEndDate End date (timestamp) for share submission.
     * @param _options Array of voting options (strings).
     * @param _metadata Metadata string (e.g., JSON) for UI hints.
     * @param _requiredDeposit Deposit amount required for holders in the new session.
     * @param _minShareThreshold Minimum share threshold for votes in the new session.
     * @return voteSessionProxyAddress_ The address of the newly deployed VoteSession proxy.
     * @return registryProxyAddress_ The address of the newly deployed ParticipantRegistry proxy.
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
    ) external onlyOwner returns (address voteSessionProxyAddress_, address registryProxyAddress_) {

        uint256 currentSessionId = nextSessionId;
        address deployer = owner(); // Factory owner will own the new contracts

        // 1. Deploy Clones (Proxies)
        registryProxyAddress_ = Clones.clone(registryImplementation);
        voteSessionProxyAddress_ = Clones.clone(voteSessionImplementation);

        // 2. Initialize Clones
        IParticipantRegistryInitializable(registryProxyAddress_).initialize(deployer);

        IVoteSessionInitializable(voteSessionProxyAddress_).initialize(
            currentSessionId,
            registryProxyAddress_, // Pass registry PROXY address
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

        // 4. Store proxy addresses and update counter
        deployedVoteSessions.push(voteSessionProxyAddress_);
        voteSessionAddresses[currentSessionId] = voteSessionProxyAddress_;
        registryAddresses[currentSessionId] = registryProxyAddress_;
        nextSessionId++;

        // 5. Emit event with PROXY addresses
        emit SessionPairDeployed(currentSessionId, voteSessionProxyAddress_, registryProxyAddress_, deployer);

        // Return proxy addresses
        // return (voteSessionProxyAddress_, registryProxyAddress_); // Return values are named
    }

    /**
     * @dev Gets the number of deployed VoteSession proxies.
     */
    function getDeployedSessionCount() external view returns (uint256) {
        return deployedVoteSessions.length;
    }

     /**
     * @dev Gets the address of a deployed VoteSession proxy by its index.
     */
    function getVoteSessionAddressByIndex(uint256 index) external view returns (address) {
        require(index < deployedVoteSessions.length, "Index out of bounds");
        return deployedVoteSessions[index];
    }

     /**
     * @dev Gets the address of a deployed VoteSession proxy by its session ID.
     */
    function getVoteSessionAddressById(uint256 sessionId_) external view returns (address) {
        require(voteSessionAddresses[sessionId_] != address(0), "Session ID not found");
        return voteSessionAddresses[sessionId_];
    }

    /**
     * @dev Gets the address of a deployed ParticipantRegistry proxy by its session ID.
     */
    function getRegistryAddressById(uint256 sessionId_) external view returns (address) {
         require(registryAddresses[sessionId_] != address(0), "Session ID not found");
        return registryAddresses[sessionId_];
    }
} 
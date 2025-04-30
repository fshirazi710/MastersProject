// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVoteSessionInitializable
 * @dev Interface for initializing VoteSession clones.
 */
interface IVoteSessionInitializable {
    /**
     * @dev Initializes the VoteSession clone with all its parameters.
     */
    function initialize(
        uint256 _sessionId,
        address _registryAddress, // Expecting ParticipantRegistry PROXY address
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
    ) external;

    // Add other functions if the factory needs to call them,
    // but currently only initialize is needed.
} 
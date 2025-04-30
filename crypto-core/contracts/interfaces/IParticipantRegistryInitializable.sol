// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IParticipantRegistryInitializable
 * @dev Interface for initializing ParticipantRegistry clones.
 */
interface IParticipantRegistryInitializable {
    /**
     * @dev Initializes the registry clone.
     * @param initialOwner The initial owner of the registry proxy.
     */
    function initialize(address initialOwner) external;

    /**
     * @dev Sets the corresponding VoteSession contract address for a session.
     * Called by the factory after both clones are deployed and initialized.
     * @param sessionId The ID of the session.
     * @param sessionContract The address of the VoteSession proxy contract.
     */
    function setVoteSessionContract(uint256 sessionId, address sessionContract) external;
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVoteSession Interface
 * @dev Defines the functions that ParticipantRegistry needs to call on an initialized VoteSession contract.
 */
interface IVoteSession {
    /**
     * @dev Checks if the registration period for the session is currently active.
     * @return bool True if registration is open, false otherwise.
     */
    function isRegistrationOpen() external view returns (bool);

    /**
     * @dev Gets the required ETH deposit amount for participants registering as holders in this session.
     * @return uint256 The required deposit amount in wei.
     */
    function getRequiredDeposit() external view returns (uint256);

    /**
     * @dev Checks if the designated period for calculating rewards is active (e.g., after voting ends).
     * @return bool True if the reward calculation period is active, false otherwise.
     */
    function isRewardCalculationPeriodActive() external view returns (bool);

    /**
     * @dev Checks if the designated period for claiming deposits is active (e.g., after shares collection ends).
     * @return bool True if the deposit claim period is active, false otherwise.
     */
    function isDepositClaimPeriodActive() external view returns (bool);
} 
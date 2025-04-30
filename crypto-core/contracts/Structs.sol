// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Structs
 * @dev Defines shared data structures used across different contracts.
 */
library Structs {
    // Moved from ParticipantRegistry.sol
    struct ParticipantInfo {
        bool isRegistered;
        bool isHolder;
        uint256 depositAmount;
        string blsPublicKeyHex;
        bool hasSubmittedShares;
    }

    // Add other shared structs here if needed in the future
} 
import { ethers } from 'ethers';

// Remove internal logs
// console.log('[registryService.js] __dirname:', __dirname);
// console.log('[registryService.js] __filename:', __filename);
// Try to resolve path manually
/*
try {
  const resolvedPath = require.resolve('../ethersBase.js');
  console.log('[registryService.js] require.resolve worked:', resolvedPath);
} catch (e) {
  console.error('[registryService.js] require.resolve failed:', e.message);
}
*/

import { ethersBaseService } from './ethersBase.js';
import { factoryService } from './factoryService.js'; // Needed to get registry address
// Remove voteSessionService import, we'll call VoteSession directly
// import { voteSessionService } from './voteSessionService.js'; // Need VoteSession service to get deposit

// Import Registry ABI
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json'; // Need VoteSession ABI

// Basic check for ABI loading
if (!ParticipantRegistryABI_File?.abi) {
  console.error("CRITICAL: Failed to load ParticipantRegistry ABI.");
  // throw new Error("Missing ParticipantRegistry ABI");
}
const registryAbi = ParticipantRegistryABI_File.abi;
const sessionAbi = VoteSessionABI_File.abi; // Load VoteSession ABI

if (!sessionAbi) { console.error("CRITICAL: Failed to load VoteSession ABI."); }

class RegistryService {
  constructor() {
    this.registryAbi = registryAbi;
  }

  // Helper to get the specific registry address
  async _getRegistryAddress(sessionId) {
      const { registryAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!registryAddress) {
          throw new Error(`Could not find Participant Registry address for session ID ${sessionId}.`);
      }
      return registryAddress;
  }

  /**
   * Registers the connected user for a specific vote session.
   * Fetches the required deposit from the session's registry contract.
   * Requires wallet connection.
   * @param {number} sessionId - The ID of the session to register for.
   * @param {string} blsPublicKeyHex - The participant's BLS public key as a hex string.
   * @returns {Promise<object>} - The transaction receipt.
   */
  async registerParticipant(sessionId, blsPublicKeyHex) {
    if (sessionId === undefined || blsPublicKeyHex === undefined) {
        throw new Error('Session ID and BLS Public Key Hex String are required for registration.');
    }

    console.log(`Registering for session ${sessionId} ...`);

    try {
      // 1. Get Registry and Session addresses
      const { registryAddress, sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!registryAddress || !sessionAddress) {
          throw new Error(`Could not find registry or session address for session ID ${sessionId}.`);
      }
      console.log(`Found Registry: ${registryAddress}, Session: ${sessionAddress}`);

      // 2. Get required deposit directly FROM VOTE SESSION contract
      console.log(`Fetching required deposit from VoteSession contract ${sessionAddress}...`);
      const requiredDepositWei = await ethersBaseService.readContract(
          sessionAddress,    // Target VoteSession contract
          sessionAbi,        // Use VoteSession ABI
          'getRequiredDeposit', // Call the function on VoteSession
          []
      );
      if (requiredDepositWei === undefined || requiredDepositWei === null) {
           throw new Error(`Failed to fetch required deposit from session ${sessionId}`);
      }
      console.log(`Required deposit: ${requiredDepositWei.toString()} Wei`);

      if (requiredDepositWei < 0n) { // Use BigInt comparison
           console.error(`Error: Required deposit for session ${sessionId} is negative: ${requiredDepositWei.toString()}`);
           throw new Error('Invalid negative required deposit found for session.');
      }
      if (requiredDepositWei === 0n) {
           console.warn(`Session ${sessionId} requires zero deposit for registration.`);
      }

      // 3. Send the registration transaction TO THE REGISTRY CONTRACT
      console.log(`Sending joinAsHolder transaction to registry ${registryAddress}...`);
      const txReceipt = await ethersBaseService.sendTransaction(
        registryAddress,
        this.registryAbi,
        'joinAsHolder', 
        [ sessionId, blsPublicKeyHex ], // Pass sessionId and the hex string
        { value: requiredDepositWei } 
      );

      console.log(`Registration transaction successful for session ${sessionId}`, txReceipt);
      return txReceipt;

    } catch (error) {
        console.error(`Error registering participant for session ${sessionId}:`, error);
        throw error;
    }
  }

  /**
   * Allows the connected user to claim their deposit and/or reward for a session.
   * Requires wallet connection.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<object>} - The transaction receipt.
   */
  async claimDepositOrReward(sessionId) {
    if (sessionId === undefined) {
      throw new Error('Session ID is required to claim.');
    }

    console.log(`Attempting to claim deposit/reward for session ${sessionId}...`);

    try {
      // 1. Get the specific registry contract address
      const registryAddress = await this._getRegistryAddress(sessionId);
      console.log(`Found Registry address for session ${sessionId}: ${registryAddress}`);

      // 2. Send the transaction using the base service
      console.log(`Sending claim transaction to registry ${registryAddress}...`);
      const txReceipt = await ethersBaseService.sendTransaction(
        registryAddress,
        this.registryAbi,
        'claimDepositOrReward', // Function name in ParticipantRegistry.sol
        [], // No arguments needed
        {} // No value needed
      );

      console.log(`Claim transaction successful for session ${sessionId}`, txReceipt);
      return txReceipt;

    } catch (error) {
      console.error(`Error claiming deposit/reward for session ${sessionId}:`, error);
      // Error is likely already processed by sendTransaction, re-throw
      // Specific reverts could be: 'Not registered', 'Claim already processed', 'Session not ended' etc.
      throw error;
    }
  }

  /**
   * Retrieves details for a specific participant in a session.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<object|null>} - Participant details object or null if not found/error.
   */
  async getParticipantDetails(sessionId, participantAddress) {
    if (sessionId === undefined || !participantAddress) {
      throw new Error('Session ID and participant address are required.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const details = await ethersBaseService.readContract(
        registryAddress,
        this.registryAbi,
        'getParticipantInfo',
        [participantAddress]
      );

      // The contract returns a struct. Ethers v6 usually converts it to an object.
      // We might need to format it depending on how components use it.
      // Example formatting (adjust based on actual struct fields returned by ethers):
      if (details && details.isRegistered) { // Check if participant exists
        return {
          blsPubKeyX: details.blsPubKeyX.toString(),
          blsPubKeyY: details.blsPubKeyY.toString(),
          isRegistered: details.isRegistered,
          hasSubmittedShares: details.hasSubmittedShares,
          hasSubmittedDecryptionValue: details.hasSubmittedDecryptionValue,
          hasVoted: details.hasVoted,
          hasClaimed: details.hasClaimed,
          depositAmount: ethers.formatEther(details.depositAmount) + ' ETH' // Format Wei to ETH string
        };
      } else {
          console.log(`Participant ${participantAddress} not found or not registered in session ${sessionId}.`);
          return null; // Indicate not found
      }
    } catch (error) {
      console.error(`Error getting participant details for ${participantAddress} in session ${sessionId}:`, error);
      // Don't throw, return null to indicate failure to retrieve
      return null; 
    }
  }

  /**
   * Checks if a participant has already claimed their deposit/reward.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<boolean>}
   */
  async hasClaimed(sessionId, participantAddress) {
     if (sessionId === undefined || !participantAddress) {
      throw new Error('Session ID and participant address are required.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const claimedStatus = await ethersBaseService.readContract(
        registryAddress,
        this.registryAbi,
        'hasClaimed',
        [participantAddress]
      );
      return Boolean(claimedStatus);
    } catch (error) {
      console.error(`Error checking claim status for ${participantAddress} in session ${sessionId}:`, error);
      throw error; // Re-throw error as status is critical
    }
  }

  /**
   * Gets the number of active (registered) participants in a session.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<number>}
   */
  async getNumberOfActiveParticipants(sessionId) {
     if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const count = await ethersBaseService.readContract(
        registryAddress,
        this.registryAbi,
        'getNumberOfActiveParticipants',
        []
      );
      return Number(count); // Convert BigInt to number
    } catch (error) {
      console.error(`Error getting participant count for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a participant has submitted their decryption value.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<boolean>}
   */
  async hasSubmittedDecryptionValue(sessionId, participantAddress) {
     if (sessionId === undefined || !participantAddress) {
      throw new Error('Session ID and participant address are required.');
    }
    try {
      // Use getParticipantDetails which already fetches this info
      const details = await this.getParticipantDetails(sessionId, participantAddress);
      return details ? details.hasSubmittedDecryptionValue : false;
    } catch (error) {
      console.error(`Error checking decryption value status for ${participantAddress} in session ${sessionId}:`, error);
      throw error; // Re-throw error as status might be important
    }
  }

  /**
   * Gets the BLS public keys (as hex strings) of all registered participants.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<string[]>} - Array of hex strings representing BLS public keys ["0x...", ...]
   */
  async getAllParticipantKeys(sessionId) {
    if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      // Assuming the contract has a function like 'getAllParticipantBlsKeys'
      // Adjust the function name if it's different in ParticipantRegistry.sol
      const keysResult = await ethersBaseService.readContract(
        registryAddress,
        this.registryAbi,
        'getAllParticipantBlsKeys', // Check this function name in the contract!
        []
      );
      
      // The contract likely returns an array of structs or tuples.
      // We need to extract the hex representation of each key.
      // Assuming the result is an array of objects like { x: BigInt, y: BigInt }
      // or directly an array of hex strings if the contract pre-formats them.
      // Adjust parsing based on actual return type.
      if (Array.isArray(keysResult)) {
          // Example: If contract returns array of structs { x: bigint, y: bigint }
          // Need to convert Point(x, y) to hex. Requires bls12_381 library here?
          // Or ideally, the contract returns hex strings directly.
          // For now, assume it returns hex strings directly:
          return keysResult.map(key => String(key)); // Ensure strings
      } else {
          console.error(`Unexpected result type from getAllParticipantBlsKeys for session ${sessionId}:`, keysResult);
          return [];
      }
    } catch (error) {
      console.error(`Error getting all participant keys for session ${sessionId}:`, error);
      throw error; // Re-throw error
    }
  }

  // --- Placeholder for future Registry specific methods ---
  // async getClaimableAmount(sessionId, participantAddress) { ... }

}

// Export a single instance
export const registryService = new RegistryService(); 
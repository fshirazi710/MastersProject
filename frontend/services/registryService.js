import { ethers } from 'ethers';
import { ethersBaseService } from './ethersBase.js';
import { factoryService } from './factoryService.js'; // Needed to get registry address

// Import Registry ABI
import ParticipantRegistryABI_File from '../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';

// Basic check for ABI loading
if (!ParticipantRegistryABI_File?.abi) {
  console.error("CRITICAL: Failed to load ParticipantRegistry ABI.");
  // throw new Error("Missing ParticipantRegistry ABI");
}
const registryAbi = ParticipantRegistryABI_File.abi;

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
   * @param {string|BigInt} blsPubKeyX - The X coordinate of the participant's BLS public key.
   * @param {string|BigInt} blsPubKeyY - The Y coordinate of the participant's BLS public key.
   * @returns {Promise<object>} - The transaction receipt.
   */
  async registerParticipant(sessionId, blsPubKeyX, blsPubKeyY) {
    if (sessionId === undefined || blsPubKeyX === undefined || blsPubKeyY === undefined) {
        throw new Error('Session ID and BLS Public Key coordinates are required for registration.');
    }

    console.log(`Registering for session ${sessionId} with BLS Key X: ${blsPubKeyX}, Y: ${blsPubKeyY}`);

    try {
      // 1. Get the specific registry contract address for this session
      const registryAddress = await this._getRegistryAddress(sessionId);
      console.log(`Found Registry address for session ${sessionId}: ${registryAddress}`);

      // 2. Read the required deposit using the base service
      console.log(`Reading requiredDeposit from registry: ${registryAddress}`);
      const requiredDepositWei = await ethersBaseService.readContract(
          registryAddress,
          this.registryAbi,
          'requiredDeposit' // Function name in ParticipantRegistry.sol
      );
      console.log(`Required deposit for session ${sessionId}: ${requiredDepositWei.toString()} Wei (${ethers.formatEther(requiredDepositWei)} ETH)`);

      if (requiredDepositWei < 0) { // Should technically be >= 0
           console.error(`Error: Required deposit for session ${sessionId} is negative: ${requiredDepositWei.toString()}`);
           throw new Error('Invalid negative required deposit found for session.');
      }
      if (requiredDepositWei == 0) {
           console.warn(`Session ${sessionId} requires zero deposit for registration.`);
           // Proceeding with zero value transaction
      }

      // 3. Send the transaction using the base service
      console.log(`Sending registration transaction to registry ${registryAddress}...`);
      const txReceipt = await ethersBaseService.sendTransaction(
        registryAddress,
        this.registryAbi,
        'registerParticipant', // Function name in ParticipantRegistry.sol
        [blsPubKeyX, blsPubKeyY], // Arguments for registerParticipant
        { value: requiredDepositWei } // Attach deposit as transaction value
      );

      console.log(`Registration transaction successful for session ${sessionId}`, txReceipt);
      return txReceipt;

    } catch (error) {
        console.error(`Error registering participant for session ${sessionId}:`, error);
        // Error is likely already processed by sendTransaction/readContract, re-throw
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

  // --- Placeholder for future Registry specific methods ---
  // async getClaimableAmount(sessionId, participantAddress) { ... }

}

// Export a single instance
export const registryService = new RegistryService(); 
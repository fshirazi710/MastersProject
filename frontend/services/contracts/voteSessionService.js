import { ethers } from 'ethers';
import { ethersBaseService } from './ethersBase.js';
import { factoryService } from './factoryService.js'; // Needed to get session address

// Import Session ABI
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

// Basic check for ABI loading
if (!VoteSessionABI_File?.abi) {
  console.error("CRITICAL: Failed to load VoteSession ABI.");
  // throw new Error("Missing VoteSession ABI");
}
const sessionAbi = VoteSessionABI_File.abi;

class VoteSessionService {
  constructor() {
    this.sessionAbi = sessionAbi;
  }

  // Helper to get the specific session address (could be cached later if needed)
  async _getSessionAddress(sessionId) {
      const { sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!sessionAddress) {
          throw new Error(`Could not find VoteSession address for session ID ${sessionId}.`);
      }
      return sessionAddress;
  }

  /**
   * Casts an encrypted vote for a specific session.
   * Requires wallet connection.
   * @param {number} sessionId - The ID of the session to vote in.
   * @param {ethers.BytesLike} encryptedVote - The encrypted vote payload.
   * @param {ethers.BytesLike} nullifierHash - The nullifier hash to prevent double voting.
   * @param {object} proof - The ZK-SNARK proof object (needs structure matching contract).
   * @param {ethers.BigNumberish[]} proof.a - The first element of the proof (pi_a).
   * @param {ethers.BigNumberish[][]} proof.b - The second element of the proof (pi_b).
   * @param {ethers.BigNumberish[]} proof.c - The third element of the proof (pi_c).
   * @returns {Promise<object>} - The transaction receipt.
   */
  async castVote(sessionId, encryptedVote, nullifierHash, proof) {
      if (sessionId === undefined || !encryptedVote || !nullifierHash || !proof || !proof.a || !proof.b || !proof.c) {
          throw new Error('Session ID, encrypted vote, nullifier hash, and a valid ZK proof object (a, b, c) are required to cast a vote.');
      }

      console.log(`Casting vote for session ${sessionId}...`);

      try {
          // 1. Get the specific VoteSession contract address
          const sessionAddress = await this._getSessionAddress(sessionId);
          console.log(`Found VoteSession address for session ${sessionId}: ${sessionAddress}`);

          // 2. Prepare the proof arguments in the format expected by the contract
          const proofArgs = [proof.a, proof.b, proof.c];

          // 3. Send the transaction using the base service
          console.log(`Sending vote transaction to VoteSession ${sessionAddress}...`);
          const txReceipt = await ethersBaseService.sendTransaction(
              sessionAddress,
              this.sessionAbi,
              'castVote', // Function name in VoteSession.sol
              [encryptedVote, nullifierHash, proofArgs], // Arguments for castVote
              {} // No value needed for vote transaction
          );

          console.log(`Vote transaction successful for session ${sessionId}`, txReceipt);
          return txReceipt;

      } catch (error) {
          console.error(`Error casting vote for session ${sessionId}:`, error);
          // Error is likely already processed by sendTransaction, re-throw
          throw error; 
      }
  }

  /**
   * Submits decryption shares for a specific session.
   * Requires wallet connection.
   * @param {number} sessionId - The ID of the session.
   * @param {number} voteIndex - The index of the vote being decrypted (likely 0).
   * @param {string} shareDataHex - The calculated share data as a hex string.
   * @param {number} shareIndex - The index for the share (likely 0, contract handles). 
   * @returns {Promise<object>} - The transaction receipt.
   */
  async submitShares(sessionId, voteIndex, shareDataHex, shareIndex) {
    // Validate inputs
    if (sessionId === undefined || typeof sessionId !== 'number') {
        throw new Error('Session ID (number) is required.');
    }
    if (voteIndex === undefined || typeof voteIndex !== 'number') {
        throw new Error('Vote Index (number) is required.');
    }
    if (typeof shareDataHex !== 'string' || !shareDataHex.startsWith('0x')) {
        throw new Error('Share Data (hex string) is required.');
    }
    if (shareIndex === undefined || typeof shareIndex !== 'number') {
        throw new Error('Share Index (number) is required.');
    }

    console.log(`Submitting share for session ${sessionId}, voteIndex ${voteIndex}, shareIndex ${shareIndex}...`);
    console.log(`Share data: ${shareDataHex.substring(0, 20)}...`); // Log truncated share data

    try {
        const sessionAddress = await this._getSessionAddress(sessionId);
        console.log(`Found VoteSession address: ${sessionAddress}`);

        console.log(`Sending submitShares transaction to ${sessionAddress}...`);
        const txReceipt = await ethersBaseService.sendTransaction(
            sessionAddress,
            this.sessionAbi,
            'submitShares',
            // Arguments match the contract function signature
            [voteIndex, shareDataHex, shareIndex],
            {} // No ETH value needed
        );

        console.log(`submitShares transaction successful for session ${sessionId}`, txReceipt);
        return txReceipt;

    } catch (error) {
        console.error(`Error in submitShares for session ${sessionId}:`, error);
        throw error; // Re-throw after logging
    }
  }

  /**
   * Submits the connected user's decryption value for a specific session.
   * Requires wallet connection.
   * @param {number} sessionId - The ID of the session.
   * @param {ethers.BytesLike} decryptionValue - The user's decryption value.
   * @returns {Promise<object>} - The transaction receipt.
   */
  async submitDecryptionValue(sessionId, decryptionValue) {
    if (sessionId === undefined || !decryptionValue) {
        throw new Error('Session ID and decryption value are required.');
    }

    console.log(`Submitting decryption value for session ${sessionId}...`);

    try {
        // 1. Get the specific VoteSession contract address
        const sessionAddress = await this._getSessionAddress(sessionId);
        console.log(`Found VoteSession address for session ${sessionId}: ${sessionAddress}`);

        // 2. Send the transaction using the base service
        console.log(`Sending decryption value transaction to VoteSession ${sessionAddress}...`);
        const txReceipt = await ethersBaseService.sendTransaction(
            sessionAddress,
            this.sessionAbi,
            'submitDecryptionValue', // Function name in VoteSession.sol
            [decryptionValue], // Arguments for submitDecryptionValue
            {} // No value needed
        );

        console.log(`Decryption value submission successful for session ${sessionId}`, txReceipt);
        return txReceipt;

    } catch (error) {
        console.error(`Error submitting decryption value for session ${sessionId}:`, error);
        // Error is likely already processed by sendTransaction, re-throw
        throw error;
    }
  }

  // --- Read Methods ---

  /**
   * Retrieves general information about the session.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<object|null>} - Session info object or null if error.
   */
  async getSessionInfo(sessionId) {
    if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      const info = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'getSessionInfo',
        []
      );
      
      // Format the returned struct (assuming Ethers v6 returns an object-like structure)
      // Adjust field names based on the actual struct definition in Structs.sol
      if (info) {
        return {
          title: info.title,
          description: info.description,
          startDate: Number(info.startDate),
          endDate: Number(info.endDate),
          sharesEndDate: Number(info.sharesEndDate),
          options: info.options,
          metadata: info.metadata,
          // Conditionally format deposit only if it exists and is valid
          requiredDeposit: (info.requiredDeposit !== null && info.requiredDeposit !== undefined) 
              ? ethers.formatEther(info.requiredDeposit) 
              : '0', // Or null, or throw an error, depending on desired behavior
          minShareThreshold: Number(info.minShareThreshold),
          participantRegistry: info.participantRegistry,
          sessionStatus: Number(info.sessionStatus)
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting session info for session ${sessionId}:`, error);
      return null; // Indicate failure
    }
  }

  /**
   * Gets the total number of encrypted votes cast in the session.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<number>}
   */
  async getNumberOfVotes(sessionId) {
     if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      const count = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'getNumberOfVotes',
        []
      );
      return Number(count);
    } catch (error) {
      console.error(`Error getting number of votes for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a specific encrypted vote by its index.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @param {number} index - The index of the vote.
   * @returns {Promise<ethers.BytesLike|null>} - The encrypted vote bytes or null if error.
   */
  async getEncryptedVote(sessionId, index) {
    if (sessionId === undefined || index === undefined) {
      throw new Error('Session ID and vote index are required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      const vote = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'getEncryptedVote',
        [index]
      );
      return vote; // Should be bytes-like
    } catch (error) {
      console.error(`Error getting encrypted vote at index ${index} for session ${sessionId}:`, error);
      return null; // Indicate failure
    }
  }

  /**
   * Gets the total number of decryption shares submitted.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<number>}
   */
  async getNumberOfShares(sessionId) {
    if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      const count = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'getNumberOfDecryptionShares',
        []
      );
      return Number(count);
    } catch (error) {
      console.error(`Error getting number of shares for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a specific decryption share by its index.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @param {number} index - The index of the share.
   * @returns {Promise<ethers.BytesLike|null>} - The share bytes or null if error.
   */
  async getDecryptionShare(sessionId, index) {
    if (sessionId === undefined || index === undefined) {
      throw new Error('Session ID and share index are required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      const share = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'getDecryptionShare',
        [index]
      );
      return share; // Should be bytes-like
    } catch (error) {
      console.error(`Error getting decryption share at index ${index} for session ${sessionId}:`, error);
      return null; // Indicate failure
    }
  }

  /**
   * Retrieves parameters related to the voting round, like g1r and g2r.
   * Uses read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<{g1r: string, g2r: string}|null>} - Object with hex strings or null if error.
   */
  async getVoteRoundParameters(sessionId) {
    if (sessionId === undefined) {
      throw new Error('Session ID is required.');
    }
    try {
      const sessionAddress = await this._getSessionAddress(sessionId);
      // Check contract for the correct function name! Examples:
      // - getRoundParams()
      // - g1r() and g2r() as separate public variables/functions
      // Assuming separate functions for this example:
      console.log(`Reading g1r from VoteSession: ${sessionAddress}`);
      const g1r = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'g1r', // !!! CHECK CONTRACT FUNCTION NAME !!!
        []
      );
      console.log(`Reading g2r from VoteSession: ${sessionAddress}`);
      const g2r = await ethersBaseService.readContract(
        sessionAddress,
        this.sessionAbi,
        'g2r', // !!! CHECK CONTRACT FUNCTION NAME !!!
        []
      );
      
      // Ensure results are valid hex strings (or bytes-like)
      if (g1r && g2r) {
          // Convert potential BytesLike to hex strings if needed
          return {
              g1r: ethers.hexlify(g1r),
              g2r: ethers.hexlify(g2r)
          };
      } else {
          console.error(`Failed to retrieve g1r/g2r for session ${sessionId}`);
          return null;
      }
    } catch (error) {
      console.error(`Error getting vote round parameters for session ${sessionId}:`, error);
      return null; // Indicate failure
    }
  }

}

// Export a single instance
export const voteSessionService = new VoteSessionService(); 
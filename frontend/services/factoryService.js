import { ethers } from 'ethers';
import { config } from '../config';
import { ethersBaseService } from './ethersBase.js';

// Import Factory ABI
import VoteSessionFactoryABI_File from '../../crypto-core/artifacts/contracts/VoteSessionFactory.sol/VoteSessionFactory.json';

// Basic check for ABI loading
if (!VoteSessionFactoryABI_File?.abi) {
  console.error("CRITICAL: Failed to load VoteSessionFactory ABI.");
  // Optionally throw an error to prevent service initialization if ABI is missing
  // throw new Error("Missing VoteSessionFactory ABI");
}
const factoryAbi = VoteSessionFactoryABI_File.abi;

// Get Factory address from config
const factoryAddress = config.blockchain.voteSessionFactoryAddress;
if (!factoryAddress) {
    console.error("CRITICAL: VoteSessionFactory address not found in config.");
    // throw new Error("Missing VoteSessionFactory address in config");
}

class FactoryService {
  constructor() {
    this.factoryAbi = factoryAbi;
    this.factoryAddress = factoryAddress;

    // Placeholders for contract instances (lazy loaded)
    this._factoryContract = null;
    this._factoryContractSigner = null;
  }

  // Helper to get factory contract instance (read-only)
  _getFactoryContract() {
      const provider = ethersBaseService.getProvider();
      if (!provider) {
         // Base service handles attempting default provider, just check if it ultimately failed
         throw new Error('Provider unavailable for factory contract.');
      }
      // Use memoization
      if (!this._factoryContract || this._factoryContract.runner !== provider) {
          if (!this.factoryAddress || !this.factoryAbi) {
              throw new Error('Factory address or ABI missing.');
          }
          this._factoryContract = new ethers.Contract(this.factoryAddress, this.factoryAbi, provider);
          // Reset signer instance if provider changed
          this._factoryContractSigner = null; 
      }
      return this._factoryContract;
  }

  // Helper to get factory contract instance with signer (for transactions)
  _getFactoryContractWithSigner() {
      const signer = ethersBaseService.getSigner();
      if (!signer) {
          throw new Error('Wallet not connected or signer not available for factory transaction.');
      }
      // Use memoization and ensure it uses the current signer
      if (!this._factoryContractSigner || this._factoryContractSigner.runner !== signer) {
           if (!this.factoryAddress || !this.factoryAbi) {
              throw new Error('Factory address or ABI missing.');
           }
           this._factoryContractSigner = new ethers.Contract(this.factoryAddress, this.factoryAbi, signer);
           // If we create a signer instance, ensure the read-only instance is also available
           if (!this._factoryContract || this._factoryContract.runner !== signer.provider) {
               this._factoryContract = this._factoryContractSigner.connect(signer.provider);
           }
      }
      return this._factoryContractSigner;
  }

  /**
   * Gets the deployed VoteSession and ParticipantRegistry addresses for a given session ID.
   * Uses a read-only call.
   * @param {number} sessionId - The ID of the session.
   * @returns {Promise<{sessionAddress: string|null, registryAddress: string|null}>}
   */
  async getSessionAddresses(sessionId) {
      try {
          // Use readContract from base service for consistency
          console.log(`Reading factory ${this.factoryAddress} -> getVoteSessionAddressById(${sessionId})`);
          const sessionAddress = await ethersBaseService.readContract(
              this.factoryAddress,
              this.factoryAbi,
              'getVoteSessionAddressById',
              [sessionId]
          );

          console.log(`Reading factory ${this.factoryAddress} -> getRegistryAddressById(${sessionId})`);
          const registryAddress = await ethersBaseService.readContract(
              this.factoryAddress,
              this.factoryAbi,
              'getRegistryAddressById',
              [sessionId]
          );

          // Basic check for zero address
          if (!sessionAddress || sessionAddress === ethers.ZeroAddress || !registryAddress || registryAddress === ethers.ZeroAddress) {
              console.warn(`Session ID ${sessionId} returned zero address from factory.`);
              // Return nulls explicitly if addresses are zero or invalid
              return { sessionAddress: null, registryAddress: null };
          }

          return { sessionAddress, registryAddress };
      } catch (error) {
          console.error(`Error fetching addresses for session ${sessionId} from factory:`, error);
          // Rethrow or handle specific errors (e.g., session ID not found)
          throw new Error(`Failed to get addresses for session ${sessionId}. ${error.message}`);
      }
  }

  /**
   * Creates a new VoteSession and ParticipantRegistry pair via the factory.
   * Requires wallet connection (sends transaction).
   * @param {object} params - Session parameters.
   * @param {string} params.title
   * @param {string} params.description
   * @param {number} params.startDate - Unix Timestamp
   * @param {number} params.endDate - Unix Timestamp
   * @param {number} params.sharesEndDate - Unix Timestamp
   * @param {string[]} params.options
   * @param {string} params.metadata - JSON string or other metadata format
   * @param {string} params.requiredDeposit - Deposit amount in ETH (will be converted to Wei)
   * @param {number} params.minShareThreshold
   * @returns {Promise<object>} - { sessionId, voteSessionContract, participantRegistryContract }
   */
  async createVoteSession(params) {
    // Ensure signer is available (checked by sendTransaction)
    const factory = this._getFactoryContractWithSigner(); // Get instance for ABI parsing

    try {
      // Convert deposit from ETH string/number to Wei BigInt
      const requiredDepositWei = ethers.parseEther(params.requiredDeposit.toString());

      const args = [
        params.title,
        params.description,
        params.startDate, // Expecting timestamp number
        params.endDate,   // Expecting timestamp number
        params.sharesEndDate, // Expecting timestamp number
        params.options,   // Expecting array of strings
        params.metadata,  // Expecting string
        requiredDepositWei, // Pass BigInt Wei amount
        params.minShareThreshold // Expecting number/BigInt
      ];

      // Use base service to send transaction
      const txReceipt = await ethersBaseService.sendTransaction(
          this.factoryAddress,
          this.factoryAbi,
          'createSessionPair',
          args,
          {}
      );

      // --- Event Parsing ---
      let deployedSessionInfo = null;
      // Use the ethers.Interface to parse logs from the receipt
      const factoryInterface = new ethers.Interface(this.factoryAbi);

      for (const log of txReceipt.logs) {
          // Ensure the log belongs to our factory contract
          if (log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
              try {
                  const parsedLog = factoryInterface.parseLog(log);
                  if (parsedLog && parsedLog.name === "SessionPairDeployed") {
                      console.log("Parsed SessionPairDeployed event:", parsedLog.args);
                      deployedSessionInfo = {
                          // Convert BigInt session ID to number if safe, otherwise keep as string/BigInt
                          sessionId: Number(parsedLog.args.sessionId),
                          voteSessionContract: parsedLog.args.voteSessionContract,
                          participantRegistryContract: parsedLog.args.participantRegistryContract
                      };
                      break; // Found the event
                  }
              } catch (e) {
                  // Ignore logs that don't match the factory interface
                  // console.debug("Log parsing skipped (doesn't match factory interface):", e.message);
              }
          }
      }

      if (!deployedSessionInfo) {
           console.error("Could not find SessionPairDeployed event in transaction receipt logs.", txReceipt.logs);
           throw new Error("Failed to parse session creation event from transaction logs.");
      }

      return deployedSessionInfo;

    } catch (error) {
       // Error logging/handling is now primarily done within sendTransaction
       // Re-throw the processed error from sendTransaction or add specific context
       console.error('Error in createVoteSession flow:', error);
       throw new Error(`Failed to create vote session: ${error.message}`);
    }
  }
}

// Export a single instance
export const factoryService = new FactoryService(); 
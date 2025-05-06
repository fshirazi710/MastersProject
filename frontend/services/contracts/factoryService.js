import { ethers } from 'ethers';
import { config } from '../../config';
import { blockchainProviderService } from '../blockchainProvider.js';

// Import Factory ABI
import VoteSessionFactoryABI_File from '../../../crypto-core/artifacts/contracts/VoteSessionFactory.sol/VoteSessionFactory.json';
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';

// Basic check for ABI loading
if (!VoteSessionFactoryABI_File?.abi) {
  console.error("CRITICAL: Failed to load VoteSessionFactory ABI.");
  // Optionally throw an error to prevent service initialization if ABI is missing
  // throw new Error("Missing VoteSessionFactory ABI");
}
const factoryAbi = VoteSessionFactoryABI_File.abi;

const registryAbiFile = ParticipantRegistryABI_File.abi;

// Get Factory address from config
const factoryAddress = config.blockchain.voteSessionFactoryAddress;
if (!factoryAddress) {
    console.error("CRITICAL: VoteSessionFactory address not found in config.");
    // throw new Error("Missing VoteSessionFactory address in config");
}

/**
 * @class FactoryService
 * @description Service for interacting with the VoteSessionFactory smart contract.
 */
class FactoryService {
  constructor() {
    this.factoryAbi = factoryAbi;
    this.factoryAddress = factoryAddress;
    this.registryAbi = registryAbiFile;
  }

  /**
   * Gets the deployed VoteSession and ParticipantRegistry addresses for a given session ID.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<{sessionAddress: string|null, registryAddress: string|null}>} Object containing session and registry addresses.
   * @throws {Error} If fetching addresses fails or provider is unavailable.
   */
  async getSessionAddresses(sessionId) {
    if (!this.factoryAddress || !this.factoryAbi) {
        throw new Error('FactoryService: Factory address or ABI missing.');
    }
    const factoryContract = blockchainProviderService.getContractInstance(
        this.factoryAddress,
        this.factoryAbi,
        false // Read-only
    );
    if (!factoryContract) {
        throw new Error('FactoryService: Failed to get factory contract instance for read operation.');
    }

    try {
      console.log('FactoryService: Reading factory ' + this.factoryAddress + ' -> getVoteSessionAddressById(' + sessionId + ')');
      const sessionAddress = await blockchainProviderService.readContract(
          factoryContract, // Pass contract instance
          'getVoteSessionAddressById',
          [sessionId]
      );

      console.log('FactoryService: Reading factory ' + this.factoryAddress + ' -> getRegistryAddressById(' + sessionId + ')');
      const registryAddress = await blockchainProviderService.readContract(
          factoryContract, // Pass contract instance
          'getRegistryAddressById',
          [sessionId]
      );

      if (!sessionAddress || sessionAddress === ethers.ZeroAddress || !registryAddress || registryAddress === ethers.ZeroAddress) {
          console.warn('FactoryService: Session ID ' + sessionId + ' returned zero address from factory.');
          return { sessionAddress: null, registryAddress: null };
      }

      return { sessionAddress, registryAddress };
    } catch (error) {
        console.error('FactoryService: Error fetching addresses for session ' + sessionId + ' from factory:', error);
        throw new Error('FactoryService: Failed to get addresses for session ' + sessionId + '. ' + (error.message || 'Underlying provider error'));
    }
  }

  /**
   * Creates a new VoteSession and ParticipantRegistry pair via the factory and links them.
   * @async
   * @param {object} params - Session parameters.
   * @param {string} params.title
   * @param {string} params.description
   * @param {number} params.startDate - Unix Timestamp
   * @param {number} params.endDate - Unix Timestamp
   * @param {number} params.sharesEndDate - Unix Timestamp
   * @param {string[]} params.options
   * @param {string} params.metadata - JSON string or other metadata format
   * @param {string | bigint} params.requiredDeposit - Deposit amount in ETH (string) or Wei (bigint).
   * @param {number | string} params.minShareThreshold
   * @returns {Promise<object>} - { sessionId, voteSessionContract, participantRegistryContract }
   * @throws {Error} If creation or linking fails, or signer is unavailable.
   */
  async createVoteSession(params) {
    if (!this.factoryAddress || !this.factoryAbi || !this.registryAbi) {
        throw new Error('FactoryService: Factory or Registry ABI/address missing.');
    }

    const factoryContractSigner = blockchainProviderService.getContractInstance(
        this.factoryAddress,
        this.factoryAbi,
        true // Needs signer for transaction
    );

    if (!factoryContractSigner) {
        throw new Error('FactoryService: Failed to get factory contract instance with signer.');
    }

    try {
      let requiredDepositWei;
      if (typeof params.requiredDeposit === 'bigint') {
          requiredDepositWei = params.requiredDeposit;
      } else {
          requiredDepositWei = blockchainProviderService.parseEther(params.requiredDeposit.toString());
      }

      const createSessionArgs = [
        params.title,
        params.description,
        params.startDate,
        params.endDate,
        params.sharesEndDate,
        params.options,
        params.metadata || "", 
        requiredDepositWei,
        params.minShareThreshold
      ];

      console.log('FactoryService: Calling createSessionPair via blockchainProviderService.sendTransaction...');
      const txReceipt = await blockchainProviderService.sendTransaction(
          factoryContractSigner, 
          'createSessionPair', 
          createSessionArgs
      );
      // sendTransaction in provider now waits for confirmation and throws on failure.
      console.log('FactoryService: createSessionPair Transaction confirmed. Hash:', txReceipt.hash);

      let deployedSessionInfo = null;
      const factoryInterface = new ethers.Interface(this.factoryAbi);

      for (const log of txReceipt.logs) {
          if (log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
              try {
                  const parsedLog = factoryInterface.parseLog({ topics: [...log.topics], data: log.data });
                  if (parsedLog && parsedLog.name === "SessionPairDeployed") {
                      console.log("FactoryService: Parsed SessionPairDeployed event:", parsedLog.args);
                      deployedSessionInfo = {
                          sessionId: parsedLog.args.sessionId, // Keep as BigInt from event for linking
                          voteSessionContract: parsedLog.args.voteSessionContract,
                          participantRegistryContract: parsedLog.args.participantRegistryContract,
                          owner: parsedLog.args.owner
                      };
                      break; 
                  }
              } catch (e) {
                  // console.debug("FactoryService: Log parsing skipped:", e.message);
              }
          }
      }

      if (!deployedSessionInfo) {
           console.error("FactoryService: Could not find SessionPairDeployed event in transaction receipt logs.");
           throw new Error("FactoryService: Failed to parse session creation event from transaction logs.");
      }
      
      console.log('FactoryService: Attempting to link Registry (' + deployedSessionInfo.participantRegistryContract + ') to VoteSession (' + deployedSessionInfo.voteSessionContract + ') for session ID ' + deployedSessionInfo.sessionId.toString());
      const registryContractSigner = blockchainProviderService.getContractInstance(
          deployedSessionInfo.participantRegistryContract,
          this.registryAbi,
          true // Needs signer
      );
      if (!registryContractSigner) {
          throw new Error('FactoryService: Failed to get registry contract instance with signer for linking.');
      }

      const linkArgs = [deployedSessionInfo.sessionId, deployedSessionInfo.voteSessionContract];
      console.log('FactoryService: Calling setVoteSessionContract via blockchainProviderService.sendTransaction...');
      await blockchainProviderService.sendTransaction(
          registryContractSigner, 
          'setVoteSessionContract', 
          linkArgs
      );
      console.log('FactoryService: Registry linked successfully to session.');

      // Convert sessionId to number for return if it's small enough, otherwise string for safety.
      try {
        deployedSessionInfo.sessionId = Number(deployedSessionInfo.sessionId);
      } catch (e) {
        console.warn('FactoryService: Session ID is too large to be a JavaScript number, returning as string.', deployedSessionInfo.sessionId.toString());
        deployedSessionInfo.sessionId = deployedSessionInfo.sessionId.toString();
      }
      return deployedSessionInfo;

    } catch (error) {
       console.error('FactoryService: Error in createVoteSession flow:', error);
       throw error; // Re-throw error caught by blockchainProviderService or from this flow
    }
  }

  /**
   * Gets the total number of session pairs deployed by this factory.
   * @async
   * @returns {Promise<number>} The total number of deployed sessions.
   * @throws {Error} If fetching the count fails.
   */
  async getDeployedSessionCount() {
    if (!this.factoryAddress || !this.factoryAbi) {
        throw new Error('FactoryService: Factory address or ABI missing.');
    }
    const factoryContract = blockchainProviderService.getContractInstance(this.factoryAddress, this.factoryAbi, false);
    if (!factoryContract) {
        throw new Error('FactoryService: Failed to get factory contract instance for read operation.');
    }
    try {
      const count = await blockchainProviderService.readContract(factoryContract, 'getDeployedSessionCount');
      return Number(count); // Contract returns uint256, convert to number
    } catch (error) {
      console.error('FactoryService: Error fetching deployed session count:', error);
      throw new Error('FactoryService: Failed to get deployed session count. ' + (error.message || 'Provider error'));
    }
  }

  /**
   * Gets the VoteSession proxy address at a specific index in the deployedVoteSessions array.
   * @async
   * @param {number | string} index - The index in the array.
   * @returns {Promise<string>} The VoteSession proxy address.
   * @throws {Error} If fetching the address fails or index is out of bounds.
   */
  async getVoteSessionAddressByIndex(index) {
    if (!this.factoryAddress || !this.factoryAbi) {
        throw new Error('FactoryService: Factory address or ABI missing.');
    }
    const factoryContract = blockchainProviderService.getContractInstance(this.factoryAddress, this.factoryAbi, false);
    if (!factoryContract) {
        throw new Error('FactoryService: Failed to get factory contract instance for read operation.');
    }
    try {
      const address = await blockchainProviderService.readContract(factoryContract, 'getVoteSessionAddressByIndex', [index]);
      return address;
    } catch (error) {
      console.error('FactoryService: Error fetching session address by index ' + index + ':', error);
      throw new Error('FactoryService: Failed to get session address by index. ' + (error.message || 'Provider error'));
    }
  }

  /**
   * Gets the current owner of the factory contract.
   * @async
   * @returns {Promise<string>} The address of the factory owner.
   * @throws {Error} If fetching the owner fails.
   */
  async getFactoryOwner() {
    if (!this.factoryAddress || !this.factoryAbi) {
        throw new Error('FactoryService: Factory address or ABI missing.');
    }
    const factoryContract = blockchainProviderService.getContractInstance(this.factoryAddress, this.factoryAbi, false);
    if (!factoryContract) {
        throw new Error('FactoryService: Failed to get factory contract instance for read operation.');
    }
    try {
      const owner = await blockchainProviderService.readContract(factoryContract, 'owner');
      return owner;
    } catch (error) {
      console.error('FactoryService: Error fetching factory owner:', error);
      throw new Error('FactoryService: Failed to get factory owner. ' + (error.message || 'Provider error'));
    }
  }

  /**
   * Transfers ownership of the factory contract to a new address.
   * Requires wallet connection (sends transaction).
   * @async
   * @param {string} newOwner - The address of the new owner.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails or signer is unavailable.
   */
  async transferFactoryOwnership(newOwner) {
    if (!this.factoryAddress || !this.factoryAbi) {
        throw new Error('FactoryService: Factory address or ABI missing.');
    }
    const factoryContractSigner = blockchainProviderService.getContractInstance(this.factoryAddress, this.factoryAbi, true);
    if (!factoryContractSigner) {
        throw new Error('FactoryService: Failed to get factory contract instance with signer for transaction.');
    }
    try {
      console.log('FactoryService: Calling transferFactoryOwnership via blockchainProviderService.sendTransaction...');
      const txReceipt = await blockchainProviderService.sendTransaction(
          factoryContractSigner, 
          'transferOwnership', 
          [newOwner]
      );
      console.log('FactoryService: transferFactoryOwnership Transaction confirmed. Hash:', txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('FactoryService: Error transferring factory ownership:', error);
      throw error; // Re-throw error from blockchainProviderService
    }
  }
}

// Export a single instance using named export
export const factoryService = new FactoryService();
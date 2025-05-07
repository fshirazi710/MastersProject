import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import { factoryService } from './factoryService.js';
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';

if (!ParticipantRegistryABI_File?.abi) {
  throw new Error("CRITICAL: Failed to load ParticipantRegistry ABI for RegistryFundService.");
}
const registryAbi = ParticipantRegistryABI_File.abi;

/**
 * @class RegistryFundService
 * @description Service for managing funding and rewards in the ParticipantRegistry smart contract.
 */
class RegistryFundService {
  constructor() {
    this.registryAbi = registryAbi;
    // Direct access to blockchainProviderService and factoryService
  }

  /**
   * Helper to get the specific registry contract address for a given session ID.
   * @private
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<string>} The registry contract address.
   * @throws {Error} If the registry address cannot be found.
   */
  async _getRegistryAddress(sessionId) {
    if (sessionId === undefined) {
        throw new Error('RegistryFundService: Session ID is required to get registry address.');
    }
    const { registryAddress } = await factoryService.getSessionAddresses(sessionId);
    if (!registryAddress || registryAddress === ethers.ZeroAddress) {
        throw new Error('RegistryFundService: Could not find a valid Participant Registry address for session ID ' + sessionId + '.');
    }
    return registryAddress;
  }

  /** return a ParticipantRegistry instance – signer if write:true, provider if read‑only */
  _getContractInstance(address, write = false) {
    return blockchainProviderService.getContractInstance(
      address,
      this.registryAbi,
      write          // <- "true" means "I need a signer"
    );
  }

  /** convenience wrapper used by every public method that needs the address */
  async _getAddresses(sessionId) {
    const registryAddress = await this._getRegistryAddress(sessionId);
    return { registryAddress };
  }

  /**
   * Adds reward funding to the registry contract for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {ethers.BigNumberish} amountInWei - The amount of funding to add, in Wei.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails.
   */
  async addRewardFunding(sessionId, amountInWei) {
    if (sessionId === undefined || amountInWei === undefined) {
        throw new Error('RegistryFundService: Session ID and amount are required to add reward funding.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractSigner = this._getContractInstance(registryAddress, true);
      
      console.log('RegistryFundService: Adding reward funding (' + ethers.formatEther(amountInWei) + ' ETH) to session ' + sessionId + ' at registry ' + registryAddress + '...');
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'addRewardFunding',
        [sessionId], // Assuming addRewardFunding in contract takes sessionId if it's per session funding
        { value: amountInWei } // amount is sent as msg.value
      );
      console.log('RegistryFundService: Reward funding successful for session ' + sessionId + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryFundService: Error adding reward funding for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets the total reward pool for a specific session in the registry.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<ethers.BigNumber>} The total reward pool amount in Wei.
   * @throws {Error} If the query fails.
   */
  async getTotalRewardPool(sessionId) {
    if (!sessionId) {
      throw new Error("RegistryFundService: Session ID is required to get total reward pool.");
    }
    const { registryAddress } = await this._getAddresses(sessionId);
    const registryContractReader = this._getContractInstance(registryAddress, false); // Read-only

    try {
      const pool = await blockchainProviderService.readContract(
        registryContractReader,
        'totalRewardPool',
        [sessionId] // <-- mapping getter needs the key
      );
      return pool !== undefined ? pool.toString() : "0";
    } catch (error) {
      console.error('RegistryFundService: Error fetching total reward pool for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets the rewards owed to a specific participant for a given session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<ethers.BigNumber>} The amount of rewards owed in Wei.
   * @throws {Error} If the query fails.
   */
  async getRewardsOwed(sessionId, participantAddress) {
    if (!sessionId || !participantAddress) {
      throw new Error("RegistryFundService: Session ID and participant address are required to get rewards owed.");
    }
    const { registryAddress } = await this._getAddresses(sessionId);
    const registryContractReader = this._getContractInstance(registryAddress, false); // Read-only

    try {
      const owed = await blockchainProviderService.readContract(
        registryContractReader,
        'rewardsOwed',
        [sessionId, participantAddress] // <--
      );
      return owed !== undefined ? owed.toString() : "0";
    } catch (error) {
      console.error('RegistryFundService: Error fetching rewards owed for session ' + sessionId + ', participant ' + participantAddress + ':', error);
      throw error;
    }
  }

  /**
   * Allows a participant to claim their rewards for a specific session.
   * Assumes the connected wallet in blockchainProviderService is the claimant.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails.
   */
  async claimReward(sessionId) {
    if (sessionId === undefined) {
        throw new Error('RegistryFundService: Session ID is required to claim reward.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractSigner = this._getContractInstance(registryAddress, true);
      
      // const currentUserAddress = await blockchainProviderService.getSignerAddress(); // If needed for logs/checks
      console.log('RegistryFundService: Claiming reward for session ' + sessionId + ' from registry ' + registryAddress + '...');
      // From CONTRACT_API.md: claimReward(uint256 sessionId)
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'claimReward',
        [sessionId] 
      );
      console.log('RegistryFundService: Reward claim successful for session ' + sessionId + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryFundService: Error claiming reward for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Checks if a participant has claimed their rewards for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<boolean>} True if rewards have been claimed, false otherwise.
   * @throws {Error} If the query fails.
   */
  async hasClaimedReward(sessionId, participantAddress) {
    if (!sessionId || !participantAddress) {
      throw new Error("RegistryFundService: Session ID and participant address are required to check if reward has been claimed.");
    }
    const { registryAddress } = await this._getAddresses(sessionId);
    const registryContractReader = this._getContractInstance(registryAddress, false); // Read-only instance

    try {
      return await blockchainProviderService.readContract(
        registryContractReader,
        'hasClaimedReward', // Correct contract method name
        [sessionId, participantAddress] // Pass sessionId first for mapping
      );
    } catch (error) {
      console.error(`RegistryFundService: Error in hasClaimedReward for session ${sessionId}, participant ${participantAddress}:`, error);
      throw error;
    }
  }
}

export const registryFundService = new RegistryFundService(); 
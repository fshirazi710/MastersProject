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
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      
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
    if (sessionId === undefined) {
        throw new Error('RegistryFundService: Session ID is required to get total reward pool.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractReader = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      
      console.log('RegistryFundService: Fetching total reward pool for session ' + sessionId + ' from registry ' + registryAddress + '...');
      // Assuming 'totalRewardPool(uint256 sessionId)' or 'totalRewardPool()' if global.
      // Let's assume 'totalRewardPoolForSession(uint256 sessionId)' based on CONTRACT_API structure for other session-specific items.
      // If totalRewardPool is global, then sessionId might not be needed for the contract call itself.
      // Consulting CONTRACT_API.md for ParticipantRegistry: totalRewardPool() - it doesn't take sessionId.
      // This implies totalRewardPool might be global for the registry, or the contract design needs clarification.
      // For now, proceeding with the assumption that the service method should still accept sessionId for context,
      // but the contract call might be totalRewardPool() if it's global across all sessions in that registry.
      // However, if the registry is session-specific, then totalRewardPool() would be for that session.
      
      // Let's assume ParticipantRegistry is deployed PER SESSION (as implied by factoryService.getSessionAddresses)
      // In that case, totalRewardPool() is inherently for that session's registry.
      const pool = await blockchainProviderService.readContract(
        registryContractReader,
        'totalRewardPool', // As per CONTRACT_API.md
        [] 
      );
      console.log('RegistryFundService: Total reward pool for session ' + sessionId + ' (registry ' + registryAddress + '): ' + ethers.formatEther(pool) + ' ETH');
      return pool;
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
    if (sessionId === undefined || !participantAddress) {
        throw new Error('RegistryFundService: Session ID and participant address are required to get rewards owed.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractReader = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      
      console.log('RegistryFundService: Fetching rewards owed to ' + participantAddress + ' for session ' + sessionId + ' from registry ' + registryAddress + '...');
      // From CONTRACT_API.md: rewardsOwed(address participant)
      const owed = await blockchainProviderService.readContract(
        registryContractReader,
        'rewardsOwed',
        [participantAddress]
      );
      console.log('RegistryFundService: Rewards owed to ' + participantAddress + ' for session ' + sessionId + ': ' + ethers.formatEther(owed) + ' ETH');
      return owed;
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
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      
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
    if (sessionId === undefined || !participantAddress) {
        throw new Error('RegistryFundService: Session ID and participant address are required for hasClaimedReward.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractReader = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      
      console.log('RegistryFundService: Checking if ' + participantAddress + ' has claimed reward for session ' + sessionId + ' from ' + registryAddress + '...');
      // From CONTRACT_API.md: hasClaimedReward(uint256 sessionId, address participant)
      const claimed = await blockchainProviderService.readContract(
        registryContractReader,
        'hasClaimedReward',
        [sessionId, participantAddress]
      );
      console.log('RegistryFundService: ' + participantAddress + ' claimed reward status for session ' + sessionId + ': ' + claimed);
      return claimed;
    } catch (error) {
      console.error('RegistryFundService: Error checking hasClaimedReward for session ' + sessionId + ', participant ' + participantAddress + ':', error);
      throw error;
    }
  }
}

export const registryFundService = new RegistryFundService(); 
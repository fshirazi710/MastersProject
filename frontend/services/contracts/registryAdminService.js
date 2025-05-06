import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import { factoryService } from './factoryService.js';
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';
// VoteSessionABI might be needed if checking status from VoteSession before calling admin functions (e.g., calculateRewards)
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

if (!ParticipantRegistryABI_File?.abi) {
  throw new Error("CRITICAL: Failed to load ParticipantRegistry ABI for RegistryAdminService.");
}
const registryAbi = ParticipantRegistryABI_File.abi;

if (!VoteSessionABI_File?.abi) {
  // This might be a non-critical warning if not immediately used, but good to have.
  console.warn("RegistryAdminService: VoteSession ABI loaded, may be needed for pre-condition checks."); 
}
const sessionAbi = VoteSessionABI_File.abi;

/**
 * @class RegistryAdminService
 * @description Service for administrative functions of the ParticipantRegistry smart contract.
 */
class RegistryAdminService {
  constructor() {
    this.registryAbi = registryAbi;
    this.sessionAbi = sessionAbi; // Store for potential use
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
        throw new Error('RegistryAdminService: Session ID is required to get registry address.');
    }
    const { registryAddress } = await factoryService.getSessionAddresses(sessionId);
    if (!registryAddress || registryAddress === ethers.ZeroAddress) {
        throw new Error('RegistryAdminService: Could not find a valid Participant Registry address for session ID ' + sessionId + '.');
    }
    return registryAddress;
  }

  /**
   * Sets the VoteSession contract address for a specific ParticipantRegistry instance.
   * @async
   * @param {number | string} sessionId - The ID of the session (to find the correct registry).
   * @param {string} voteSessionContractAddress - The address of the VoteSession contract.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails.
   */
  async setVoteSessionContract(sessionId, voteSessionContractAddress) {
    if (sessionId === undefined || !voteSessionContractAddress) {
        throw new Error('RegistryAdminService: Session ID and VoteSession contract address are required.');
    }
    if (!ethers.isAddress(voteSessionContractAddress)) {
        throw new Error('RegistryAdminService: Invalid VoteSession contract address provided.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      
      console.log('RegistryAdminService: Setting VoteSession contract to ' + voteSessionContractAddress + ' for session ' + sessionId + ' (registry ' + registryAddress + ')...');
      // From CONTRACT_API.md: ParticipantRegistry.setVoteSessionContract(address _voteSessionContract)
      // Note: The contract function itself might not take sessionId if registry is session-specific.
      // We use sessionId here to get the correct registryAddress.
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'setVoteSessionContract',
        [voteSessionContractAddress] 
      );
      console.log('RegistryAdminService: Set VoteSession contract successful for session ' + sessionId + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryAdminService: Error setting VoteSession contract for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Triggers the calculation of rewards in the ParticipantRegistry contract for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails or conditions are not met.
   */
  async calculateRewards(sessionId) {
    if (sessionId === undefined) {
        throw new Error('RegistryAdminService: Session ID is required to calculate rewards.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      // Optionally, check VoteSession status before calling
      // const { sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      // const voteSessionContract = blockchainProviderService.getContractInstance(sessionAddress, this.sessionAbi, false);
      // const isRewardCalcPeriod = await blockchainProviderService.readContract(voteSessionContract, 'isRewardCalculationPeriodActive');
      // if (!isRewardCalcPeriod) {
      //   throw new Error(\'Reward calculation period is not active for session: ' + sessionId);
      // }

      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      console.log('RegistryAdminService: Triggering reward calculation for session ' + sessionId + ' (registry ' + registryAddress + ')...');
      // From CONTRACT_API.md: ParticipantRegistry.calculateRewards(uint256 sessionId)
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'calculateRewards',
        [sessionId]
      );
      console.log('RegistryAdminService: Reward calculation triggered successfully for session ' + sessionId + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryAdminService: Error triggering reward calculation for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets the owner of the ParticipantRegistry contract for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<string>} The address of the owner.
   * @throws {Error} If the query fails.
   */
  async getRegistryOwner(sessionId) {
    if (sessionId === undefined) {
        throw new Error('RegistryAdminService: Session ID is required to get registry owner.');
    }
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractReader = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      
      console.log('RegistryAdminService: Fetching owner of registry for session ' + sessionId + ' (registry ' + registryAddress + ')...');
      // From CONTRACT_API.md: ParticipantRegistry.owner()
      const ownerAddress = await blockchainProviderService.readContract(
        registryContractReader,
        'owner',
        []
      );
      console.log('RegistryAdminService: Owner of registry for session ' + sessionId + ' is ' + ownerAddress);
      return ownerAddress;
    } catch (error) {
      console.error('RegistryAdminService: Error fetching registry owner for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Transfers ownership of the ParticipantRegistry contract for a specific session to a new owner.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} newOwnerAddress - The address of the new owner.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails.
   */
  async transferRegistryOwnership(sessionId, newOwnerAddress) {
    if (sessionId === undefined || !newOwnerAddress) {
        throw new Error('RegistryAdminService: Session ID and new owner address are required.');
    }
    if (!ethers.isAddress(newOwnerAddress)) {
        throw new Error('RegistryAdminService: Invalid new owner address provided.');
    }
    if (newOwnerAddress === ethers.ZeroAddress) {
        throw new Error('RegistryAdminService: New owner address cannot be the zero address.');
    }

    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      
      console.log('RegistryAdminService: Transferring ownership of registry for session ' + sessionId + ' (registry ' + registryAddress + ') to ' + newOwnerAddress + '...');
      // From CONTRACT_API.md: ParticipantRegistry.transferOwnership(address newOwner)
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'transferOwnership',
        [newOwnerAddress]
      );
      console.log('RegistryAdminService: Registry ownership transfer successful for session ' + sessionId + ' to ' + newOwnerAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryAdminService: Error transferring registry ownership for session ' + sessionId + ':', error);
      throw error;
    }
  }
}

export const registryAdminService = new RegistryAdminService(); 
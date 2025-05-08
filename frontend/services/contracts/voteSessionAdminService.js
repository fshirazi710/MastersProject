import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

if (!VoteSessionABI_File?.abi) {
  throw new Error("CRITICAL: Failed to load VoteSession ABI for VoteSessionAdminService.");
}
const voteSessionAbi = VoteSessionABI_File.abi;

/**
 * @class VoteSessionAdminService
 * @description Service for administrative interactions with the VoteSession smart contract.
 */
class VoteSessionAdminService {
  constructor() {
    this.voteSessionAbi = voteSessionAbi;
  }

  // Enum-like object for SessionStatus (copied from original VoteSessionService)
  _SessionStatusEnum = {
    0: 'Pending',
    1: 'RegistrationOpen',
    2: 'VotingOpen',
    3: 'SharesCollectionOpen',
    4: 'DecryptionOpen',
    5: 'Completed',
    6: 'Cancelled'
  }

  /**
   * Helper function to get a contract instance for a given VoteSession address.
   * @private
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {boolean} withSigner - Whether to connect the contract with a signer for transactions.
   * @returns {ethers.Contract}
   * @throws {Error} if voteSessionAddress is invalid or contract instantiation fails.
   */
  _getContractInstance(voteSessionAddress, withSigner = false) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionAdminService: Invalid or missing VoteSession address provided.');
    }
    try {
      return blockchainProviderService.getContractInstance(voteSessionAddress, this.voteSessionAbi, withSigner);
    } catch (error) {
      console.error('VoteSessionAdminService: Failed to get contract instance for ' + voteSessionAddress, error);
      throw error;
    }
  }

  /**
   * Sets the decryption parameters (alphas and threshold) for a given vote session.
   * This is an owner-only transaction on the smart contract.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {string[]} alphas - An array of bytes32 strings representing the alpha values.
   * @param {number} threshold - The decryption threshold.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails, contract interaction fails, or transaction is rejected.
   */
  async setDecryptionParameters(voteSessionAddress, alphas, threshold) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionAdminService: Invalid or missing VoteSession address provided for setDecryptionParameters.');
    }
    if (!Array.isArray(alphas) || alphas.some(alpha => !ethers.isHexString(alpha, 32))) {
      throw new Error('VoteSessionAdminService: Invalid alphas provided. Expected an array of 32-byte hex strings.');
    }
    if (!((typeof threshold === 'number' && threshold > 0) || (typeof threshold === 'bigint' && threshold > 0n))) {
      throw new Error('VoteSessionAdminService: Invalid threshold provided. Expected a positive number or BigInt.');
    }
    console.log('VoteSessionAdminService: Setting decryption parameters for session ' + voteSessionAddress + ' with threshold ' + threshold + ' and ' + alphas.length + ' alphas.');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'setDecryptionParameters', [alphas, threshold]);
      console.log('VoteSessionAdminService: Successfully set decryption parameters for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionAdminService: Error setting decryption parameters for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  /**
   * Transfers ownership of the VoteSession contract to a new owner.
   * This is an owner-only transaction on the smart contract.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {string} newOwner - The address of the new owner.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails, contract interaction fails, or transaction is rejected.
   */
  async transferSessionOwnership(voteSessionAddress, newOwner) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionAdminService: Invalid or missing VoteSession address for transferSessionOwnership.');
    }
    if (!newOwner || !ethers.isAddress(newOwner)) {
      throw new Error('VoteSessionAdminService: Invalid new owner address provided.');
    }
    console.log('VoteSessionAdminService: Transferring ownership of session ' + voteSessionAddress + ' to ' + newOwner + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'transferOwnership', [newOwner]);
      console.log('VoteSessionAdminService: Successfully initiated ownership transfer for session ' + voteSessionAddress + ' to ' + newOwner + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionAdminService: Error transferring ownership for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  /**
   * Updates the status of a given vote session.
   * This is a public transaction that can be called by anyone.
   * The transaction receipt will contain a `SessionStatusChanged` event if the status was updated.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails, contract interaction fails, or transaction is rejected.
   */
  async updateSessionStatus(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionAdminService: Invalid or missing VoteSession address provided for updateSessionStatus.');
    }
    console.log('VoteSessionAdminService: Updating session status for ' + voteSessionAddress + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'updateSessionStatus', []);
      console.log('VoteSessionAdminService: Successfully called updateSessionStatus for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionAdminService: Error updating session status for ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  /**
   * Triggers the reward calculation process in the VoteSession contract.
   * The transaction receipt may contain a `RewardsCalculationTriggered` event.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails or contract interaction fails.
   */
  async triggerRewardCalculation(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionAdminService: Invalid or missing VoteSession address for triggerRewardCalculation.');
    }
    console.log('VoteSessionAdminService: Triggering reward calculation for session ' + voteSessionAddress + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'triggerRewardCalculation', []);
      console.log('VoteSessionAdminService: Successfully triggered reward calculation for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionAdminService: Error triggering reward calculation for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }
}

export const voteSessionAdminService = new VoteSessionAdminService(); 
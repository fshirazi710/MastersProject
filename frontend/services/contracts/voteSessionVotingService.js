import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

if (!VoteSessionABI_File?.abi) {
  throw new Error("CRITICAL: Failed to load VoteSession ABI for VoteSessionVotingService.");
}
const voteSessionAbi = VoteSessionABI_File.abi;

/**
 * @class VoteSessionVotingService
 * @description Service for vote casting and decryption submissions to the VoteSession smart contract.
 */
class VoteSessionVotingService {
  constructor() {
    this.voteSessionAbi = voteSessionAbi;
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
      throw new Error('VoteSessionVotingService: Invalid or missing VoteSession address provided.');
    }
    try {
      return blockchainProviderService.getContractInstance(voteSessionAddress, this.voteSessionAbi, withSigner);
    } catch (error) {
      console.error('VoteSessionVotingService: Failed to get contract instance for ' + voteSessionAddress, error);
      throw error;
    }
  }

  /**
   * Casts an encrypted vote to the specified VoteSession contract.
   * Cryptographic parameters are assumed to be prepared by a utility like `cryptographyUtils.js`.
   * The transaction receipt will contain an `EncryptedVoteCast` event upon success.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {ethers.BytesLike} ciphertext - The encrypted vote data.
   * @param {ethers.BytesLike} g1r - The g1r component for the ElGamal-like encryption or ZK proof.
   * @param {ethers.BytesLike} g2r - The g2r component for the ElGamal-like encryption or ZK proof.
   * @param {ethers.BytesLike[]} alpha - An array of bytes, likely BLS public key shares or other crypto material related to the vote.
   * @param {number} threshold - The threshold associated with this vote or cryptographic setup.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails, or contract interaction fails.
   */
  async castEncryptedVote(voteSessionAddress, ciphertext, g1r, g2r, alpha, threshold) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionVotingService: Invalid or missing VoteSession address for castEncryptedVote.');
    }
    try {
      if (!ethers.isBytesLike(ciphertext)) throw new Error('VoteSessionVotingService: Invalid ciphertext provided.');
      if (!ethers.isBytesLike(g1r)) throw new Error('VoteSessionVotingService: Invalid g1r provided.');
      if (!ethers.isBytesLike(g2r)) throw new Error('VoteSessionVotingService: Invalid g2r provided.');
      if (!Array.isArray(alpha) || alpha.some(a => !ethers.isBytesLike(a))) {
        throw new Error('VoteSessionVotingService: Invalid alpha array provided. Expected array of BytesLike.');
      }
      if (!((typeof threshold === 'bigint' && threshold > 0n) || 
            (typeof threshold === 'number' && Number.isInteger(threshold) && threshold > 0))) {
        throw new Error('VoteSessionVotingService: Invalid threshold provided. Expected a positive BigInt or positive integer number.');
      }
    } catch(validationError) {
        console.error("VoteSessionVotingService: Input validation error for castEncryptedVote:", validationError);
        throw validationError;
    }
    console.log('VoteSessionVotingService: Casting encrypted vote for session ' + voteSessionAddress + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'castEncryptedVote', [ciphertext, g1r, g2r, alpha, threshold]);
      console.log('VoteSessionVotingService: Successfully cast encrypted vote for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionVotingService: Error casting encrypted vote for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  /**
   * Submits a decryption share for a given vote in a specific session.
   * The share data is assumed to be prepared by `cryptographyUtils.js`.
   * The transaction receipt will contain a `DecryptionShareSubmitted` event upon success.
   * This contract call may also trigger `ParticipantRegistry.recordShareSubmission()`.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {number} voteIndex - The index of the vote for which the share is being submitted.
   * @param {ethers.BytesLike} share - The decryption share data (bytes calldata).
   * @param {number} shareIndex - The index of the participant submitting the share.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails or contract interaction fails.
   */
  async submitDecryptionShare(voteSessionAddress, voteIndex, share, shareIndex) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionVotingService: Invalid or missing VoteSession address for submitDecryptionShare.');
    }
    if (typeof voteIndex !== 'number' || voteIndex < 0) {
      throw new Error('VoteSessionVotingService: Invalid voteIndex provided. Expected a non-negative number.');
    }
    if (!ethers.isBytesLike(share)) {
      throw new Error('VoteSessionVotingService: Invalid share data provided. Expected BytesLike (e.g., hex string).');
    }
    if (typeof shareIndex !== 'number' || shareIndex < 0) {
      throw new Error('VoteSessionVotingService: Invalid shareIndex provided. Expected a non-negative number.');
    }
    console.log('VoteSessionVotingService: Submitting decryption share for session ' + voteSessionAddress + ', voteIndex ' + voteIndex + ', shareIndex ' + shareIndex + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'submitDecryptionShare', [voteIndex, share, shareIndex]);
      console.log('VoteSessionVotingService: Successfully submitted decryption share for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionVotingService: Error submitting decryption share for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  /**
   * Submits a decryption value (v_i) for a given vote session.
   * The value is assumed to be prepared by `cryptographyUtils.js`.
   * The transaction receipt may contain `DecryptionValueSubmitted` and `DecryptionThresholdReached` events.
   * @async
   * @param {string} voteSessionAddress - The address of the VoteSession contract.
   * @param {ethers.BytesLike} value - The decryption value (bytes32).
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If input validation fails or contract interaction fails.
   */
  async submitDecryptionValue(voteSessionAddress, value) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionVotingService: Invalid or missing VoteSession address for submitDecryptionValue.');
    }
    if (!ethers.isHexString(value, 32)) {
      throw new Error('Decryption value must be a 32-byte hex string.');
    }
    console.log('VoteSessionVotingService: Submitting decryption value for session ' + voteSessionAddress + '...');
    try {
      const contractWithSigner = this._getContractInstance(voteSessionAddress, true);
      const txReceipt = await blockchainProviderService.sendTransaction(contractWithSigner, 'submitDecryptionValue', [value]);
      console.log('VoteSessionVotingService: Successfully submitted decryption value for session ' + voteSessionAddress + '. Tx: ' + txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('VoteSessionVotingService: Error submitting decryption value for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }
}

export const voteSessionVotingService = new VoteSessionVotingService(); 
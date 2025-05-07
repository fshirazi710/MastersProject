import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

if (!VoteSessionABI_File?.abi) {
  throw new Error("CRITICAL: Failed to load VoteSession ABI for VoteSessionViewService.");
}
const voteSessionAbi = VoteSessionABI_File.abi;

/**
 * @class VoteSessionViewService
 * @description Service for retrieving read-only information from the VoteSession smart contract.
 */
class VoteSessionViewService {
  constructor() {
    this.voteSessionAbi = voteSessionAbi;
    this.blockchainProviderService = blockchainProviderService;
    this._SessionStatusEnum = {
      0: 'Created',
      1: 'RegistrationOpen',
      2: 'VotingOpen',
      3: 'SharesCollectionOpen',
      4: 'DecryptionOpen',
      5: 'Completed',
      6: 'Cancelled'
    };
  }

  _getContractInstance(voteSessionAddress, withSigner = false) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address provided.');
    }
    try {
      return blockchainProviderService.getContractInstance(voteSessionAddress, this.voteSessionAbi, withSigner);
    } catch (error) {
      console.error('VoteSessionViewService: Failed to get contract instance for ' + voteSessionAddress, error);
      throw error;
    }
  }

  async getSessionDetails(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getSessionDetails.');
    }
    console.log('VoteSessionViewService: Getting session details for ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const details = await blockchainProviderService.readContract(contractReader, 'getSessionDetails', []);
      if (details) {
        const formattedDetails = {
          id: details.id.toString(),
          status: this._SessionStatusEnum[Number(details.status)] || 'Unknown',
          title: details.title,
          startDate: Number(details.startDate),
          endDate: Number(details.endDate),
          sharesEndDate: Number(details.sharesEndDate),
          deposit: blockchainProviderService.formatEther(details.deposit),
          threshold: Number(details.threshold)
        };
        console.log('VoteSessionViewService: Session details for ' + voteSessionAddress + ':', formattedDetails);
        return formattedDetails;
      } else {
        console.warn('VoteSessionViewService: No details returned for session ' + voteSessionAddress);
        return null;
      }
    } catch (error) {
      console.error('VoteSessionViewService: Error getting session details for ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getSessionInfo(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getSessionInfo.');
    }
    console.log('VoteSessionViewService: Getting comprehensive session info for ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const info = await blockchainProviderService.readContract(contractReader, 'getSessionInfo', []);
      if (info) {
        // Contract returns: (title, description, startDate, endDate, sharesCollectionEndDate, options, metadata, requiredDeposit, minShareThreshold, currentStatus)
        // Indices:           0       1            2          3        4                        5        6          7                8                    9
        const formattedInfo = {
          title: info.title || info[0],
          description: info.description || info[1],
          startDate: Number(info.startDate || info[2]),
          endDate: Number(info.endDate || info[3]),
          sharesEndDate: Number(info.sharesCollectionEndDate || info.sharesEndDate || info[4]), // contract uses sharesCollectionEndDate
          options: info.options || info[5] || [],
          metadata: info.metadata || info[6],
          requiredDeposit: blockchainProviderService.formatEther(info.requiredDeposit || info.deposit || info[7]), // contract uses requiredDeposit
          minShareThreshold: Number(info.minShareThreshold || info[8]),
          status: this._SessionStatusEnum[Number(info.currentStatus || info.status || info[9])] || 'Unknown' // contract uses currentStatus
          // sessionId (formerly id) is not part of this specific contract tuple, should be fetched by getSessionId() if needed separately.
        };
        console.log('VoteSessionViewService: Comprehensive session info for ' + voteSessionAddress + ':', formattedInfo);
        return formattedInfo;
      } else {
        console.warn('VoteSessionViewService: No comprehensive info returned for session ' + voteSessionAddress);
        return null;
      }
    } catch (error) {
      console.error('VoteSessionViewService: Error getting comprehensive session info for ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getRequiredDeposit(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getRequiredDeposit.');
    }
    console.log('VoteSessionViewService: Getting required deposit for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const deposit = await blockchainProviderService.readContract(contractReader, 'getRequiredDeposit', []);
      console.log('VoteSessionViewService: Required deposit for session ' + voteSessionAddress + ': ' + deposit.toString() + ' Wei');
      return deposit;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting required deposit for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async isRegistrationOpen(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for isRegistrationOpen.');
    }
    console.log('VoteSessionViewService: Checking if registration is open for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const isOpen = await blockchainProviderService.readContract(contractReader, 'isRegistrationOpen', []);
      console.log('VoteSessionViewService: Registration open status for session ' + voteSessionAddress + ': ' + isOpen);
      return isOpen;
    } catch (error) {
      console.error('VoteSessionViewService: Error checking if registration is open for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async isRewardCalculationPeriodActive(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for isRewardCalculationPeriodActive.');
    }
    console.log('VoteSessionViewService: Checking if reward calculation period is active for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const isActive = await blockchainProviderService.readContract(contractReader, 'isRewardCalculationPeriodActive', []);
      console.log('VoteSessionViewService: Reward calculation period active status for session ' + voteSessionAddress + ': ' + isActive);
      return isActive;
    } catch (error) {
      console.error('VoteSessionViewService: Error checking if reward calculation period is active for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async isDepositClaimPeriodActive(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for isDepositClaimPeriodActive.');
    }
    console.log('VoteSessionViewService: Checking if deposit claim period is active for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const isActive = await blockchainProviderService.readContract(contractReader, 'isDepositClaimPeriodActive', []);
      console.log('VoteSessionViewService: Deposit claim period active status for session ' + voteSessionAddress + ': ' + isActive);
      return isActive;
    } catch (error) {
      console.error('VoteSessionViewService: Error checking if deposit claim period is active for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getStatus(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      console.error('VoteSessionViewService: Invalid voteSessionAddress provided for getStatus.');
      throw new Error('VoteSessionViewService: Invalid voteSessionAddress provided.');
    }
    try {
      const contractReader = await this._getContractInstance(voteSessionAddress, false);
      const statusEnumIndex = await this.blockchainProviderService.readContract(contractReader, 'currentStatus', []);
      return this._SessionStatusEnum[Number(statusEnumIndex)] || 'Unknown';
    } catch (error) {
      console.error(`VoteSessionViewService: Error getting status for session ${voteSessionAddress}:`, error);
      throw error;
    }
  }

  async getEncryptedVote(voteSessionAddress, voteIndex) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getEncryptedVote.');
    }
    if (typeof voteIndex !== 'number' || voteIndex < 0) {
      throw new Error('VoteSessionViewService: Invalid voteIndex provided. Expected a non-negative number.');
    }
    console.log('VoteSessionViewService: Getting encrypted vote for session ' + voteSessionAddress + ', voteIndex ' + voteIndex + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const voteData = await blockchainProviderService.readContract(contractReader, 'getEncryptedVote', [voteIndex]);
      if (voteData) {
        const formattedVoteData = {
          ciphertext: voteData.ciphertext,
          g1r: voteData.g1r,
          g2r: voteData.g2r,
          alpha: voteData.alpha,
          threshold: Number(voteData.threshold)
        };
        console.log('VoteSessionViewService: Encrypted vote data for session ' + voteSessionAddress + ', voteIndex ' + voteIndex + ':', formattedVoteData);
        return formattedVoteData;
      }
      console.warn('VoteSessionViewService: No encrypted vote data returned for session ' + voteSessionAddress + ', voteIndex ' + voteIndex);
      return null;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting encrypted vote for session ' + voteSessionAddress + ', voteIndex ' + voteIndex + ':', error);
      throw error;
    }
  }

  async getNumberOfVotes(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getNumberOfVotes.');
    }
    console.log('VoteSessionViewService: Getting number of votes for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const numberOfVotes = await blockchainProviderService.readContract(contractReader, 'getNumberOfVotes', []);
      const count = Number(numberOfVotes);
      console.log('VoteSessionViewService: Number of votes for session ' + voteSessionAddress + ': ' + count);
      return count;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting number of votes for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getDecryptionShare(voteSessionAddress, shareLogIndex) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getDecryptionShare.');
    }
    if (typeof shareLogIndex !== 'number' || shareLogIndex < 0) {
      throw new Error('VoteSessionViewService: Invalid shareLogIndex provided. Expected a non-negative number.');
    }
    console.log('VoteSessionViewService: Getting decryption share for session ' + voteSessionAddress + ', shareLogIndex ' + shareLogIndex + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const shareData = await blockchainProviderService.readContract(contractReader, 'getDecryptionShare', [shareLogIndex]);
      
      // Log the raw return value from ethers
      console.log('VoteSessionViewService: Raw shareData received:', shareData); 

      if (shareData) {
        // Use field names from the Solidity struct definition
        const formattedShareData = {
          submitter: shareData.holderAddress || undefined, // Changed from submitter
          voteIndex: typeof shareData.voteIndex !== 'undefined' ? Number(shareData.voteIndex) : NaN,
          shareIndex: typeof shareData.index !== 'undefined' ? Number(shareData.index) : NaN, // Changed from shareIndex
          share: shareData.share || null
        };
        console.log('VoteSessionViewService: Decryption share data for session ' + voteSessionAddress + ', shareLogIndex ' + shareLogIndex + ':', formattedShareData);
        return formattedShareData;
      }
      console.warn('VoteSessionViewService: No decryption share data returned for session ' + voteSessionAddress + ', shareLogIndex ' + shareLogIndex);
      return null;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting decryption share for session ' + voteSessionAddress + ', shareLogIndex ' + shareLogIndex + ':', error);
      throw error;
    }
  }

  async getNumberOfDecryptionShares(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getNumberOfDecryptionShares.');
    }
    console.log('VoteSessionViewService: Getting number of decryption shares for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const numberOfShares = await blockchainProviderService.readContract(contractReader, 'getNumberOfDecryptionShares', []);
      const count = Number(numberOfShares);
      console.log('VoteSessionViewService: Number of decryption shares for session ' + voteSessionAddress + ': ' + count);
      return count;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting number of decryption shares for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getDecryptionParameters(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getDecryptionParameters.');
    }
    console.log('VoteSessionViewService: Getting decryption parameters for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const params = await blockchainProviderService.readContract(contractReader, 'getDecryptionParameters', []);
      
      // Log the raw return value
      console.log('VoteSessionViewService: Raw params received:', params);

      if (params && Array.isArray(params) && params.length >= 2) {
         // Access by index based on raw log observation
        const formattedParams = {
          alphas: params[1], // Index 1 is alphas array
          threshold: typeof params[0] !== 'undefined' ? Number(params[0]) : NaN // Index 0 is threshold
        };
        
        // Basic validation after index access
        if (!Array.isArray(formattedParams.alphas) || isNaN(formattedParams.threshold)) {
             console.error('VoteSessionViewService: Could not parse decryption parameters from raw data (index access):', params);
             return null;
        }

        console.log('VoteSessionViewService: Decryption parameters for session ' + voteSessionAddress + ':', formattedParams);
        return formattedParams;
      } else {
          console.error('VoteSessionViewService: Invalid raw data received for decryption parameters:', params);
          return null;
      }
    } catch (error) {
      console.error('VoteSessionViewService: Error getting decryption parameters for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getSubmittedValues(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      console.error('VoteSessionViewService: Invalid voteSessionAddress provided for getSubmittedValues.');
      return null;
    }
    try {
      // Request a signer-connected instance to satisfy the strict check in blockchainProviderService.readContract
      // even though this is a read operation. This is a workaround for the provider.provider check.
      const contractReader = await this._getContractInstance(voteSessionAddress, true); 
      if (!contractReader) {
        console.error(`VoteSessionViewService: Failed to get contract instance for ${voteSessionAddress} in getSubmittedValues.`);
        return null;
      }
      // Ensure that blockchainProviderService has its signer set, so contractReader (if from signer) has a provider.
      // This should be handled by test setup or general app flow.
      const submittedData = await blockchainProviderService.readContract(contractReader, 'getSubmittedDecryptionValues', []);
      
      // Log the raw return value from ethers
      console.log('VoteSessionViewService: Raw submittedData received:', submittedData);

      // Helper to make sure we always hand back a real array
      const ensureArray = (v) =>
        Array.isArray(v)               ? v :
        v && typeof v[Symbol.iterator] === 'function' ? Array.from(v) :
        []; // Default to empty if not array or iterable

      if (submittedData) {
        const formattedSubmittedData = {
          submitters: ensureArray(submittedData[0]), // Use positional access for tuple element
          indexes:    ensureArray(submittedData[1]).map(Number), // Use positional access
          values:     ensureArray(submittedData[2]), // Use positional access
        };
        console.log('VoteSessionViewService: Submitted decryption values for session ' + voteSessionAddress + ':', formattedSubmittedData);
        return formattedSubmittedData;
      }
      console.warn('VoteSessionViewService: No submitted decryption values returned (or threshold not met) for session ' + voteSessionAddress);
      return null;
    } catch (error) {
      if (error.message && error.message.includes('Threshold not reached')) {
        console.warn('VoteSessionViewService: Failed to get submitted values for session ' + voteSessionAddress + ' - Decryption threshold likely not met.');
        return null;
      } else {
        console.error('VoteSessionViewService: Error getting submitted decryption values for session ' + voteSessionAddress + ':', error);
        throw error;
      }
    }
  }

  async getSessionOwner(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getSessionOwner.');
    }
    console.log('VoteSessionViewService: Getting owner for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const ownerAddress = await blockchainProviderService.readContract(contractReader, 'owner', []);
      console.log('VoteSessionViewService: Owner for session ' + voteSessionAddress + ': ' + ownerAddress);
      return ownerAddress;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting owner for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getSessionId(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getSessionId.');
    }
    console.log('VoteSessionViewService: Getting session ID for ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const sessionId = await blockchainProviderService.readContract(contractReader, 'sessionId', []);
      const idString = sessionId?.toString();
      console.log('VoteSessionViewService: Session ID for ' + voteSessionAddress + ': ' + idString);
      return idString;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting session ID for ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getParticipantRegistryAddress(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getParticipantRegistryAddress.');
    }
    console.log('VoteSessionViewService: Getting participant registry address for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const registryAddress = await blockchainProviderService.readContract(contractReader, 'participantRegistry', []);
      console.log('VoteSessionViewService: Participant registry address for session ' + voteSessionAddress + ': ' + registryAddress);
      return registryAddress;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting participant registry address for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getTitle(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getTitle.');
    }
    console.log('VoteSessionViewService: Getting title for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const title = await blockchainProviderService.readContract(contractReader, 'title', []);
      console.log('VoteSessionViewService: Title for session ' + voteSessionAddress + ': ' + title);
      return title;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting title for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getDescription(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getDescription.');
    }
    console.log('VoteSessionViewService: Getting description for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const description = await blockchainProviderService.readContract(contractReader, 'description', []);
      console.log('VoteSessionViewService: Description for session ' + voteSessionAddress + ': ' + description);
      return description;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting description for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }
}

export const voteSessionViewService = new VoteSessionViewService(); 
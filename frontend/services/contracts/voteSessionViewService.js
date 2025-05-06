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
  }

  _SessionStatusEnum = {
    0: 'Pending',
    1: 'RegistrationOpen',
    2: 'VotingOpen',
    3: 'SharesCollectionOpen',
    4: 'DecryptionOpen',
    5: 'Completed',
    6: 'Cancelled'
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
        const formattedInfo = {
          id: (info.id || info[0])?.toString(),
          status: this._SessionStatusEnum[Number(info.status || info[1])] || 'Unknown',
          title: info.title || info[2],
          description: info.description || info[3],
          startDate: Number(info.startDate || info[4]),
          endDate: Number(info.endDate || info[5]),
          sharesEndDate: Number(info.sharesEndDate || info[6]),
          options: info.options || info[7] || [],
          metadata: info.metadata || info[8],
          deposit: blockchainProviderService.formatEther(info.deposit || info[9]),
          minShareThreshold: Number(info.minShareThreshold || info[10]),
          participantRegistry: info.participantRegistry || info[11]
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
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getStatus.');
    }
    console.log('VoteSessionViewService: Getting status for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const statusEnumIndex = await blockchainProviderService.readContract(contractReader, 'status', []);
      const statusString = this._SessionStatusEnum[Number(statusEnumIndex)] || 'Unknown';
      console.log('VoteSessionViewService: Status for session ' + voteSessionAddress + ': ' + statusString + ' (Enum Index: ' + statusEnumIndex + ')');
      return statusString;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting status for session ' + voteSessionAddress + ':', error);
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
      if (shareData) {
        const formattedShareData = {
          submitter: shareData.submitter,
          voteIndex: Number(shareData.voteIndex),
          shareIndex: Number(shareData.shareIndex),
          share: shareData.share
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

  async getNumberOfSubmittedShares(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getNumberOfSubmittedShares.');
    }
    console.log('VoteSessionViewService: Getting number of submitted shares for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const numberOfShares = await blockchainProviderService.readContract(contractReader, 'getNumberOfSubmittedShares', []);
      const count = Number(numberOfShares);
      console.log('VoteSessionViewService: Number of submitted shares for session ' + voteSessionAddress + ': ' + count);
      return count;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting number of submitted shares for session ' + voteSessionAddress + ':', error);
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
      if (params) {
        const formattedParams = {
          alphas: params.alphas || params[0],
          threshold: Number(params.threshold || params[1])
        };
        console.log('VoteSessionViewService: Decryption parameters for session ' + voteSessionAddress + ':', formattedParams);
        return formattedParams;
      }
      console.warn('VoteSessionViewService: No decryption parameters returned for session ' + voteSessionAddress);
      return null;
    } catch (error) {
      console.error('VoteSessionViewService: Error getting decryption parameters for session ' + voteSessionAddress + ':', error);
      throw error;
    }
  }

  async getSubmittedValues(voteSessionAddress) {
    if (!voteSessionAddress || !ethers.isAddress(voteSessionAddress)) {
      throw new Error('VoteSessionViewService: Invalid or missing VoteSession address for getSubmittedValues.');
    }
    console.log('VoteSessionViewService: Getting submitted decryption values for session ' + voteSessionAddress + '...');
    try {
      const contractReader = this._getContractInstance(voteSessionAddress, false);
      const valuesData = await blockchainProviderService.readContract(contractReader, 'getSubmittedValues', []);
      if (valuesData) {
        const formattedValuesData = {
          submitters: valuesData.submitters || valuesData[0] || [],
          indexes: (valuesData.indexes || valuesData[1] || []).map(Number),
          values: valuesData.values || valuesData[2] || []
        };
        console.log('VoteSessionViewService: Submitted decryption values for session ' + voteSessionAddress + ':', formattedValuesData);
        return formattedValuesData;
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
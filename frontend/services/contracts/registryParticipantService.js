import { ethers } from 'ethers';
import { blockchainProviderService } from '../blockchainProvider.js';
import { factoryService } from './factoryService.js';
import { voteSessionViewService } from './voteSessionViewService.js';

// Import ABIs
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';

if (!ParticipantRegistryABI_File?.abi) {
  console.error("CRITICAL: Failed to load ParticipantRegistry ABI for RegistryParticipantService.");
  // throw new Error("Missing ParticipantRegistry ABI");
}
const registryAbi = ParticipantRegistryABI_File.abi;

if (!VoteSessionABI_File?.abi) {
  console.error("CRITICAL: Failed to load VoteSession ABI for RegistryParticipantService.");
  // throw new Error("Missing VoteSession ABI");
}
const sessionAbi = VoteSessionABI_File.abi;

/**
 * @class RegistryParticipantService
 * @description Service for participant-related interactions with the ParticipantRegistry smart contract.
 */
class RegistryParticipantService {
  constructor() {
    this.registryAbi = registryAbi;
    this.sessionAbi = sessionAbi;
  }

  /**
   * Helper to get the specific registry contract address for a given session ID.
   * @private
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<string>} The registry contract address.
   * @throws {Error} If the registry address cannot be found.
   */
  async _getRegistryAddress(sessionId) {
    const { registryAddress } = await factoryService.getSessionAddresses(sessionId);
    if (!registryAddress || registryAddress === ethers.ZeroAddress) {
      throw new Error('RegistryParticipantService: Could not find a valid Participant Registry address for session ID ' + sessionId + '.');
    }
    return registryAddress;
  }

  /**
   * Registers the connected user as a Holder for a specific vote session.
   * @async
   * @param {number | string} sessionId - The ID of the session to register for.
   * @param {string} blsPublicKeyHex - The participant's BLS public key as a hex string.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If registration fails.
   */
  async registerAsHolder(sessionId, blsPublicKeyHex) {
    if (sessionId === undefined || blsPublicKeyHex === undefined) {
      throw new Error('RegistryParticipantService: Session ID and BLS Public Key Hex String are required for holder registration.');
    }
    console.log('RegistryParticipantService: Registering as holder for session ' + sessionId + '...');
    try {
      const { registryAddress, sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!registryAddress || registryAddress === ethers.ZeroAddress || !sessionAddress || sessionAddress === ethers.ZeroAddress) {
        throw new Error('RegistryParticipantService: Could not find valid registry or session address for session ID ' + sessionId + '.');
      }

      // Pre-check if registration is open
      const registrationOpen = await voteSessionViewService.isRegistrationOpen(sessionAddress);
      if (!registrationOpen) {
        throw new Error('Registration is not currently open');
      }

      const voteSessionContract = blockchainProviderService.getContractInstance(sessionAddress, this.sessionAbi, false);
      if (!voteSessionContract) {
        throw new Error('RegistryParticipantService: Failed to get VoteSession contract instance for session ' + sessionId + '.');
      }
      const requiredDepositWei = await blockchainProviderService.readContract(voteSessionContract, 'getRequiredDeposit');
      if (requiredDepositWei === undefined || requiredDepositWei === null) {
        throw new Error('RegistryParticipantService: Failed to fetch required deposit from session ' + sessionId + '.');
      }
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      if (!registryContractSigner) {
        throw new Error('RegistryParticipantService: Failed to get ParticipantRegistry contract instance with signer for session ' + sessionId + '.');
      }
      const txReceipt = await blockchainProviderService.sendTransaction(registryContractSigner, 'joinAsHolder', [sessionId, blsPublicKeyHex], { value: requiredDepositWei });
      console.log('RegistryParticipantService: Holder registration successful for session ' + sessionId + '. Hash:', txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryParticipantService: Error registering as holder for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Registers the connected user as a non-depositing Voter for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If registration fails.
   */
  async registerAsVoter(sessionId) {
    if (sessionId === undefined) {
      throw new Error('RegistryParticipantService: Session ID is required for voter registration.');
    }
    console.log('RegistryParticipantService: Registering as voter for session ' + sessionId + '...');
    try {
      // We need both registryAddress and sessionAddress
      const { registryAddress, sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!registryAddress || registryAddress === ethers.ZeroAddress || !sessionAddress || sessionAddress === ethers.ZeroAddress) {
        throw new Error('RegistryParticipantService: Could not find valid registry or session address for voter registration on session ID ' + sessionId + '.');
      }

      // Pre-check if registration is open
      const registrationOpen = await voteSessionViewService.isRegistrationOpen(sessionAddress);
      if (!registrationOpen) {
        throw new Error('Registration is not currently open');
      }
    
      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      if (!registryContractSigner) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance with signer for registerAsVoter.');
      }
      const txReceipt = await blockchainProviderService.sendTransaction(registryContractSigner, 'registerAsVoter', [sessionId]);
      console.log('RegistryParticipantService: Voter registration successful for session ' + sessionId + '. Hash:', txReceipt.hash);
      return txReceipt;
    } catch (error) {
      console.error('RegistryParticipantService: Error registering as voter for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Retrieves participant information for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<object|null>} Participant details or null.
   * @throws {Error} If fetching fails.
   */
  async getParticipantInfo(sessionId, participantAddress) {
    if (sessionId === undefined || !participantAddress) {
      throw new Error('RegistryParticipantService: Session ID and participant address are required.');
    }
    console.log('RegistryParticipantService: Getting participant info for ' + participantAddress + ' in session ' + sessionId + '...');
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContract = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContract) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance for getParticipantInfo.');
      }
      const details = await blockchainProviderService.readContract(registryContract, 'getParticipantInfo', [sessionId, participantAddress]);
      if (details && details.isRegistered) {
        return {
          isRegistered: details.isRegistered,
          isHolder: details.isHolder,
          depositAmount: blockchainProviderService.formatEther(details.depositAmount),
          blsPublicKeyHex: details.blsPublicKeyHex,
          hasSubmittedShares: details.hasSubmittedShares
        };
      } else {
        console.log('RegistryParticipantService: Participant ' + participantAddress + ' not found or not registered in session ' + sessionId + '.');
        return null;
      }
    } catch (error) {
      console.error('RegistryParticipantService: Error getting participant info for ' + participantAddress + ' in session ' + sessionId + ':', error);
      return null;
    }
  }

  /**
   * Gets an array of addresses for all registered holders in a session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<string[]>} An array of holder addresses.
   * @throws {Error} If fetching fails.
   */
  async getActiveHolders(sessionId) {
    if (sessionId === undefined) {
      throw new Error('RegistryParticipantService: Session ID is required for getActiveHolders.');
    }
    console.log('RegistryParticipantService: Getting active holders for session ' + sessionId + '...');
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContract = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContract) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance for getActiveHolders.');
      }
      const activeHolders = await blockchainProviderService.readContract(registryContract, 'getActiveHolders', [sessionId]);
      return activeHolders || [];
    } catch (error) {
      console.error('RegistryParticipantService: Error getting active holders for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets the number of active (registered) holders in a session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<number>} The number of active holders.
   * @throws {Error} If fetching fails.
   */
  async getNumberOfActiveHolders(sessionId) {
    if (sessionId === undefined) {
      throw new Error('RegistryParticipantService: Session ID is required for getNumberOfActiveHolders.');
    }
    console.log('RegistryParticipantService: Getting number of active holders for session ' + sessionId + '...');
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContract = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContract) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance for getNumberOfActiveHolders.');
      }
      const count = await blockchainProviderService.readContract(registryContract, 'getNumberOfActiveHolders', [sessionId]);
      return Number(count);
    } catch (error) {
      console.error('RegistryParticipantService: Error getting number of active holders for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets parallel arrays of holder addresses and their BLS public key hex strings for a session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<{addresses: string[], blsKeysHex: string[]}>} An object containing arrays of addresses and their BLS keys.
   * @throws {Error} If fetching fails.
   */
  async getHolderBlsKeys(sessionId) {
    if (sessionId === undefined) {
      throw new Error('RegistryParticipantService: Session ID is required for getHolderBlsKeys.');
    }
    console.log('RegistryParticipantService: Getting holder BLS keys for session ' + sessionId + '...');
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContract = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContract) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance for getHolderBlsKeys.');
      }
      const result = await blockchainProviderService.readContract(registryContract, 'getHolderBlsKeys', [sessionId]);
      if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && Array.isArray(result[1])) {
        return {
          addresses: result[0],
          blsKeysHex: result[1]
        };
      } else {
        console.error('RegistryParticipantService: Unexpected result structure from getHolderBlsKeys for session ' + sessionId + ':', result);
        return { addresses: [], blsKeysHex: [] };
      }
    } catch (error) {
      console.error('RegistryParticipantService: Error getting holder BLS keys for session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Gets the 1-based index of a holder within the activeHolders set for a given session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<number>} The 1-based index of the holder, or 0 if not found.
   * @throws {Error} If fetching fails.
   */
  async getParticipantIndex(sessionId, participantAddress) {
    if (sessionId === undefined || !participantAddress) {
      throw new Error('RegistryParticipantService: Session ID and participant address are required for getParticipantIndex.');
    }
    console.log('RegistryParticipantService: Getting participant index for ' + participantAddress + ' in session ' + sessionId + '...');
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContract = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContract) {
        throw new Error('RegistryParticipantService: Failed to get registry contract instance for getParticipantIndex.');
      }
      const index = await blockchainProviderService.readContract(registryContract, 'getParticipantIndex', [sessionId, participantAddress]);
      return Number(index);
    } catch (error) {
      console.error('RegistryParticipantService: Error getting participant index for ' + participantAddress + ' in session ' + sessionId + ':', error);
      throw error;
    }
  }

  /**
   * Allows a participant to claim their deposit for a specific session.
   * Assumes the connected wallet in blockchainProviderService is the claimant.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails or conditions are not met (e.g., deposit claim period not active).
   */
  async claimDeposit(sessionId) {
    if (sessionId === undefined) {
      throw new Error('RegistryParticipantService: Session ID is required to claim deposit.');
    }
    console.log(`RegistryParticipantService: Claiming deposit for session ${sessionId}...`);
    try {
      const { registryAddress, sessionAddress } = await factoryService.getSessionAddresses(sessionId);
      if (!registryAddress || registryAddress === ethers.ZeroAddress || !sessionAddress || sessionAddress === ethers.ZeroAddress) {
        throw new Error('RegistryParticipantService: Could not find valid registry or session address for claimDeposit on session ID ' + sessionId + '.');
      }

      // Check if deposit claim period is active
      const isDepositClaimActive = await voteSessionViewService.isDepositClaimPeriodActive(sessionAddress);
      if (!isDepositClaimActive) {
        throw new Error(`Deposit claim period is not currently active for session ${sessionId}.`);
      }

      const registryContractSigner = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, true);
      if (!registryContractSigner) {
        throw new Error(`RegistryParticipantService: Failed to get ParticipantRegistry contract instance with signer for session ${sessionId}.`);
      }

      // From CONTRACT_API.md: ParticipantRegistry.claimDeposit(uint256 sessionId)
      const txReceipt = await blockchainProviderService.sendTransaction(
        registryContractSigner,
        'claimDeposit',
        [sessionId]
      );
      console.log(`RegistryParticipantService: Deposit claim successful for session ${sessionId}. Tx: ${txReceipt.hash}`);
      return txReceipt;
    } catch (error) {
      console.error(`RegistryParticipantService: Error claiming deposit for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a participant has claimed their deposit for a specific session.
   * @async
   * @param {number | string} sessionId - The ID of the session.
   * @param {string} participantAddress - The address of the participant.
   * @returns {Promise<boolean>} True if the deposit has been claimed, false otherwise.
   * @throws {Error} If the query fails.
   */
  async hasClaimedDeposit(sessionId, participantAddress) {
    if (sessionId === undefined || !participantAddress) {
      throw new Error('RegistryParticipantService: Session ID and participant address are required for hasClaimedDeposit.');
    }
    console.log(`RegistryParticipantService: Checking if ${participantAddress} has claimed deposit for session ${sessionId}...`);
    try {
      const registryAddress = await this._getRegistryAddress(sessionId);
      const registryContractReader = blockchainProviderService.getContractInstance(registryAddress, this.registryAbi, false);
      if (!registryContractReader) {
        throw new Error(`RegistryParticipantService: Failed to get ParticipantRegistry contract instance for session ${sessionId}.`);
      }
      // From CONTRACT_API.md: ParticipantRegistry.depositClaimed(uint256 sessionId, address participant)
      const claimed = await blockchainProviderService.readContract(
        registryContractReader,
        'depositClaimed',
        [sessionId, participantAddress]
      );
      console.log(`RegistryParticipantService: ${participantAddress} claimed deposit status for session ${sessionId}: ${claimed}`);
      return claimed;
    } catch (error) {
      console.error(`RegistryParticipantService: Error checking hasClaimedDeposit for session ${sessionId}, participant ${participantAddress}:`, error);
      throw error;
    }
  }
}

export const registryParticipantService = new RegistryParticipantService(); 
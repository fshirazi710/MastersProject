import { ethers } from 'ethers';
import { config } from '../config'; // Assuming config holds provider URL

/**
 * @class BlockchainProviderService
 * @description Provides a singleton service to interact with the blockchain.
 * Manages provider, signer, account, network information, and contract interactions.
 */
class BlockchainProviderService {
  /**
   * @constructor
   * Initializes properties and attempts to set up a default read-only provider.
   */
  constructor() {
    /** @type {ethers.BrowserProvider | ethers.JsonRpcProvider | null} */
    this.provider = null;
    /** @type {ethers.Signer | null} */
    this.signer = null;
    /** @type {string | null} */
    this.account = null;
    /** @type {string | null} */
    this.balance = null;
    /** @type {string | null} */
    this.chainId = null;

    try {
      if (config.blockchain.providerUrl) {
        this.provider = new ethers.JsonRpcProvider(config.blockchain.providerUrl);
        console.log('Default read-only provider initialized for BlockchainProviderService.');
        this.provider.getNetwork().then(network => {
          this.chainId = network.chainId.toString();
          console.log('BlockchainProviderService: Default provider chain ID:', this.chainId);
        }).catch(e => console.error('BlockchainProviderService: Failed to get chain ID for default provider:', e));
      } else {
        console.warn('BlockchainProviderService: Provider URL not found in config, read operations might fail until wallet connected.');
      }
    } catch (e) {
      console.error("BlockchainProviderService: Failed to create default provider on initial load:", e);
    }
  }

  /**
   * Initializes wallet connection (e.g., MetaMask).
   * Sets up the provider, requests accounts, gets the signer, account details, and network info.
   * Attaches listeners for account/network changes.
   * @async
   * @returns {Promise<boolean>} True if connection successful.
   * @throws {Error} If connection fails or wallet is not found.
   */
  async init() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        
        const accounts = await this.provider.send("eth_requestAccounts", []);
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please ensure your wallet is configured correctly.');
        }
        this.account = ethers.getAddress(accounts[0]);

        this.signer = await this.provider.getSigner(this.account);
        console.log('BlockchainProviderService: Connected Account:', this.account);

        const network = await this.provider.getNetwork();
        this.chainId = network.chainId.toString();
        console.log('BlockchainProviderService: Connected Network Chain ID:', this.chainId);

        await this.updateBalance();

        window.ethereum.removeListener('accountsChanged', this._handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', this._handleChainChanged);

        window.ethereum.on('accountsChanged', this._handleAccountsChanged);
        window.ethereum.on('chainChanged', this._handleChainChanged);

        console.log('BlockchainProviderService initialized successfully.');
        return true;
      } catch (error) {
        console.error('BlockchainProviderService: Error initializing:', error);
        this.provider = null; 
        this.signer = null;
        this.account = null;
        this.balance = null;
        this.chainId = null;
        if (error.code === 4001 || (error.message && error.message.includes("User rejected the request"))) {
          throw new Error('Connection rejected by user. Please connect your wallet.');
        }
        throw new Error('Failed to initialize wallet connection. Ensure your wallet is unlocked and accessible.');
      }
    } else {
      console.error('BlockchainProviderService: MetaMask or compatible wallet not found.');
      throw new Error('Please install MetaMask or another compatible Ethereum wallet.');
    }
  }

  /**
   * Handles the 'accountsChanged' event from the wallet.
   * @private
   * @fires provider:accountsChanged
   * @param {string[]} accounts - Array of account addresses.
   */
  _handleAccountsChanged = async (accounts) => {
    console.log('BlockchainProviderService: Accounts changed detected.', accounts);
    if (accounts.length === 0) {
      console.warn('BlockchainProviderService: Wallet disconnected or no accounts available.');
      this.account = null;
      this.signer = null;
      this.balance = null;
      // Dispatch event for disconnection
      const disconnectEvent = new CustomEvent('provider:accountsChanged', { 
        detail: { account: null, isConnected: false, chainId: this.chainId }
      });
      window.dispatchEvent(disconnectEvent);
    } else {
      const newAccount = ethers.getAddress(accounts[0]);
      if (newAccount !== this.account) {
        this.account = newAccount;
        if(this.provider) {
            this.signer = await this.provider.getSigner(this.account);
        } else {
            this.signer = null; // Should not happen if account is found, but good practice
        }
        console.log('BlockchainProviderService: Account switched to:', this.account);
        await this.updateBalance();
        // Dispatch event for account switch
        const switchEvent = new CustomEvent('provider:accountsChanged', { 
          detail: { account: this.account, isConnected: this.isConnected(), chainId: this.chainId }
        });
        window.dispatchEvent(switchEvent);
      }
    }
  }

  /**
   * Handles the 'chainChanged' event from the wallet.
   * @private
   * @fires provider:chainChanged
   * @param {string} chainIdHex - The new chain ID in hexadecimal format.
   */
  _handleChainChanged = (chainIdHex) => {
    const newChainId = BigInt(chainIdHex).toString();
    if (newChainId !== this.chainId) {
        this.chainId = newChainId;
        console.log('BlockchainProviderService: Network changed detected. New Chain ID:', this.chainId);
        // Dispatch event for chain switch
        const event = new CustomEvent('provider:chainChanged', { 
          detail: { chainId: this.chainId, account: this.account, isConnected: this.isConnected() }
        });
        window.dispatchEvent(event);
    }
  }

  /**
   * Gets the current Ethers provider.
   * @returns {ethers.BrowserProvider | ethers.JsonRpcProvider | null} The current provider, or null if unavailable.
   */
  getProvider() {
    if (!this.provider) {
      console.warn('BlockchainProviderService: Ethers provider not available. Attempting to re-initialize default provider.');
      try {
        if (config.blockchain.providerUrl) {
          this.provider = new ethers.JsonRpcProvider(config.blockchain.providerUrl);
           this.provider.getNetwork().then(network => {
            this.chainId = network.chainId.toString();
          }).catch(e => console.error('BlockchainProviderService: Failed to get chain ID for re-initialized default provider:', e));
        } else {
            console.warn('BlockchainProviderService: Provider URL not found in config for re-initialization.');
        }
      } catch (e) {
        console.error("BlockchainProviderService: Failed to create default provider on demand:", e);
      }
    }
    return this.provider;
  }

  /**
   * Gets the current Ethers signer.
   * @returns {ethers.Signer | null} The current signer, or null if unavailable (e.g., wallet not connected).
   */
  getSigner() {
    if (!this.signer) {
      console.warn('BlockchainProviderService: Ethers signer not initialized. Call init() first or connect wallet.');
    }
    return this.signer;
  }

  /**
   * Gets the current connected account address.
   * @returns {string | null} The account address, or null if not connected.
   */
  getAccount() {
    return this.account;
  }
  
  /**
   * Gets the current network chain ID.
   * @returns {string | null} The chain ID, or null if undetermined.
   */
  getChainId() {
    return this.chainId;
  }

  /**
   * Checks if the service is connected with a signer and account.
   * @returns {boolean} True if connected, false otherwise.
   */
  isConnected() {
    return !!this.signer && !!this.account && !!this.provider;
  }

  /**
   * Gets the balance of the current account.
   * @async
   * @returns {Promise<string | null>} The balance in ETH string format, or null if unavailable.
   */
  async getBalance() {
    return this.balance;
  }

  /**
   * Fetches and updates the balance for the current account.
   * @async
   * @returns {Promise<string | null>} The updated balance in ETH, or null if an error occurs.
   */
  async updateBalance() {
    const currentProvider = this.getProvider();
    if (!currentProvider || !this.account) {
      console.warn('BlockchainProviderService: Cannot update balance: Provider or account not initialized.');
      this.balance = null;
      return null;
    }
    try {
      const balanceWei = await currentProvider.getBalance(this.account);
      this.balance = ethers.formatEther(balanceWei);
      console.log('BlockchainProviderService: Account Balance updated:', this.balance, 'ETH');
      return this.balance;
    } catch (error) {
      console.error('BlockchainProviderService: Error fetching balance:', error);
      this.balance = null;
      return null;
    }
  }
  
  /**
   * Creates an Ethers.js Contract instance.
   * @param {string} contractAddress - The address of the target contract.
   * @param {ethers.InterfaceAbi} contractAbi - The ABI of the target contract.
   * @param {boolean} [withSigner=false] - Whether to connect the contract with a signer (for write transactions) or provider (for read-only).
   * @returns {ethers.Contract | null} The contract instance, or null if provider/signer is not available or an error occurs.
   */
  getContractInstance(contractAddress, contractAbi, withSigner = false) {
    const connector = withSigner ? this.getSigner() : this.getProvider();
    if (!connector) {
      console.error('BlockchainProviderService: Cannot get contract instance. ' + (withSigner ? 'Signer' : 'Provider') + ' not available.');
      return null;
    }
    if (!contractAddress || !contractAbi) {
        console.error('BlockchainProviderService: Contract address and ABI must be provided for getContractInstance.');
        return null;
    }
    try {
        return new ethers.Contract(contractAddress, contractAbi, connector);
    } catch (error) {
        console.error('BlockchainProviderService: Error creating contract instance for ' + contractAddress + ':', error);
        return null;
    }
  }

  /**
   * Requests the connected account to sign a message.
   * @async
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The signature.
   * @throws {Error} If signing fails or is rejected.
   */
  async signMessage(message) {
    const currentSigner = this.getSigner();
    if (!currentSigner) {
      throw new Error('BlockchainProviderService: Wallet not connected or signer not available.');
    }
    try {
      console.log('BlockchainProviderService: Requesting signature for message: "' + message + '"');
      const signature = await currentSigner.signMessage(message);
      console.log('BlockchainProviderService: Signature obtained:', signature);
      return signature;
    } catch (error) {
      console.error('BlockchainProviderService: Error signing message:', error);
      if (error.code === 4001  || (error.info && error.info.error && error.info.error.code === 4001)) {
        throw new Error('Message signing rejected by user.');
      }
      throw new Error('Failed to sign message: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Sends a transaction to a contract method.
   * @async
   * @param {ethers.Contract} contractInstance - The Ethers.js contract instance (must be connected to a signer).
   * @param {string} methodName - The name of the contract method to call.
   * @param {any[]} [args=[]] - Arguments for the contract method.
   * @param {object} [options={}] - Transaction options (e.g., value, gasLimit).
   * @param {number} [confirmations=1] - Number of confirmations to wait for. 
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   * @throws {Error} If the transaction fails, is rejected, or contract instance is invalid.
   */
  async sendTransaction(contractInstance, methodName, args = [], options = {}, confirmations = 1) {
    if (!contractInstance) {
        throw new Error("BlockchainProviderService: Contract instance is not valid for sendTransaction.");
    }
    // Ethers v6 uses contractInstance.runner to check for signer presence.
    // A contract instance created with a provider will have a runner, but runner.sendTransaction will not exist.
    // A contract instance created with a signer will have runner.sendTransaction.
    if (!contractInstance.runner || typeof contractInstance[methodName] !== 'function' || !contractInstance.runner.provider) { 
         throw new Error("BlockchainProviderService: Contract instance is not properly connected to a signer for sending transactions, or method does not exist.");
    }
    // Check specifically if it can sign, a more direct check for a signer might be contractInstance.runner.signTransaction if available
    // or by checking if the runner IS a signer: contractInstance.runner instanceof ethers.Signer (though direct check on sendTransaction capability is good)
    if (!contractInstance.runner.sendTransaction) {
         throw new Error("BlockchainProviderService: Contract instance is not connected to a signer. Call getContractInstance with 'withSigner = true'.");
    }

    let txResponse;
    try {
      const contractAddress = await contractInstance.getAddress();
      console.log('BlockchainProviderService: Sending transaction to ' + contractAddress + ' -> ' + methodName + '(' + args.map(String).join(', ') + ') with options:', options);
      
      txResponse = await contractInstance[methodName](...args, options);
      console.log('BlockchainProviderService: Transaction sent: ' + txResponse.hash);

      console.log('BlockchainProviderService: Waiting for ' + confirmations + ' transaction confirmation(s)...');
      const receipt = await txResponse.wait(confirmations);
      console.log('BlockchainProviderService: Transaction confirmed. Hash: ' + receipt.hash + ', Status: ' + (receipt.status === 1 ? 'Success' : 'Failed'));

      if (receipt.status === 0) {
        console.error("BlockchainProviderService: Transaction confirmed but failed (reverted) on-chain.", receipt);
        throw new Error('Transaction ' + txResponse.hash + ' confirmed but failed on-chain. Check blockchain explorer for details.');
      }
      return receipt;
    } catch (error) {
      console.error('BlockchainProviderService: Error sending transaction (' + methodName + '):', error);
      const txHashInfo = txResponse ? ' (Transaction: ' + txResponse.hash + ')' : '';
      let reason = 'Transaction failed' + txHashInfo + '.';

      if (error.code === 'ACTION_REJECTED' || (error.info && error.info.error && error.info.error.code === 4001)) {
        reason = 'Transaction rejected by user.';
      } else if (error.reason) {
        reason = 'Transaction failed: ' + error.reason + txHashInfo;
      } else if (error.data?.message) {
        reason = 'Transaction failed: ' + error.data.message + txHashInfo;
      } else if (error.info?.error?.message) {
        reason = 'Transaction failed: ' + error.info.error.message + txHashInfo;
      } else if (error.message) {
        reason = error.message.substring(0,150) + '...' + txHashInfo;
      }
      throw new Error(reason);
    }
  }

  /**
   * Reads data from a contract method (view or pure).
   * @async
   * @param {ethers.Contract} contractInstance - The Ethers.js contract instance (can be connected to provider or signer).
   * @param {string} methodName - The name of the contract method to call.
   * @param {any[]} [args=[]] - Arguments for the contract method.
   * @returns {Promise<any>} The result from the contract method.
   * @throws {Error} If the read operation fails or contract instance is invalid.
   */
  async readContract(contractInstance, methodName, args = []) {
     if (!contractInstance) {
        throw new Error("BlockchainProviderService: Contract instance is not valid for readContract.");
    }
    if (!contractInstance.runner || !contractInstance.runner.provider  || typeof contractInstance[methodName] !== 'function') {
         throw new Error("BlockchainProviderService: Contract instance is not properly connected to a provider or method does not exist.");
    }
    try {
      const contractAddress = await contractInstance.getAddress();
      console.log('BlockchainProviderService: Reading contract ' + contractAddress + ' -> ' + methodName + '(' + args.map(String).join(', ') + ')');
      const result = await contractInstance[methodName](...args);
      return result;
    } catch (error) {
      console.error('BlockchainProviderService: Error reading contract (' + methodName + '):', error);
      throw new Error('Failed to read contract method ' + methodName + '. Reason: ' + (error.message || 'Unknown error'));
    }
  }
  
  /**
   * Hashes a message using Keccak256 (ethers.id is an alias for keccak256(toUtf8Bytes(message))).
   * @param {string} message - The string message to hash.
   * @returns {string} The Keccak256 hash of the message.
   * @throws {Error} if the message is not a string.
   */
  hashMessage(message) {
      if (typeof message !== 'string') {
          console.error("BlockchainProviderService: hashMessage expects a string argument.");
          throw new Error("Message to hash must be a string.");
      }
      return ethers.id(message);
  }

  /**
   * Formats a Wei value into an Ether string.
   * @param {ethers.BigNumberish} weiValue - The value in Wei.
   * @returns {string} The value in Ether as a string, or "0" on error.
   */
  formatEther(weiValue) {
      try {
          return ethers.formatEther(weiValue);
      } catch (e) {
          console.error("BlockchainProviderService: Invalid value for formatEther", weiValue, e);
          return "0";
      }
  }

  /**
   * Parses an Ether string into a Wei BigInt.
   * @param {string} etherValue - The value in Ether.
   * @returns {bigint} The value in Wei as a BigInt, or BigInt(0) on error.
   */
  parseEther(etherValue) {
      try {
          return ethers.parseEther(etherValue);
      } catch (e) {
          console.error("BlockchainProviderService: Invalid value for parseEther", etherValue, e);
          throw e;
      }
  }

  /**
   * Subscribes to a contract event.
   * @async
   * @param {ethers.Contract} contractInstance - The Ethers.js contract instance.
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {Function} callback - The callback function to execute when the event is emitted.
   * @description The callback will receive event arguments as parameters, followed by the event object itself.
   */
  async subscribeToEvent(contractInstance, eventName, callback) {
    if (!contractInstance) {
        console.error("BlockchainProviderService: Contract instance not provided for event subscription.");
        return;
    }
    try {
        const contractAddress = await contractInstance.getAddress();
        console.log('BlockchainProviderService: Subscribing to \'' + eventName + '\' on ' + contractAddress);
        contractInstance.on(eventName, callback);
    } catch(e) {
        console.error('BlockchainProviderService: Error subscribing to event ' + eventName + ':', e);
    }
  }

  /**
   * Unsubscribes from a contract event.
   * @async
   * @param {ethers.Contract} contractInstance - The Ethers.js contract instance.
   * @param {string} eventName - The name of the event to unsubscribe from.
   * @param {Function} [callback] - The specific callback function to remove. If not provided, all listeners for the event are removed.
   */
  async unsubscribeFromEvent(contractInstance, eventName, callback) {
    if (!contractInstance) {
        console.error("BlockchainProviderService: Contract instance not provided for event unsubscription.");
        return;
    }
    try {
        const contractAddress = await contractInstance.getAddress();
        console.log('BlockchainProviderService: Unsubscribing from \'' + eventName + '\' on ' + contractAddress);
        if (callback) {
            contractInstance.off(eventName, callback);
        } else {
            contractInstance.removeAllListeners(eventName);
        }
    } catch(e) {
        console.error('BlockchainProviderService: Error unsubscribing from event ' + eventName + ':', e);
    }
  }

  /**
   * Allows explicitly setting the signer and account. Useful for testing or specific scenarios.
   * @async
   * @param {ethers.Signer | null} newSigner - The new Ethers.js Signer object, or null to clear.
   */
  async setSigner(newSigner) {
    this.signer = newSigner;
    if (newSigner && typeof newSigner.getAddress === 'function') {
      try {
        this.account = await newSigner.getAddress();
        console.log('BlockchainProviderService: Signer explicitly set to ' + this.account);
        if (newSigner.provider) { 
            this.provider = newSigner.provider;
            const network = await this.provider.getNetwork();
            this.chainId = network.chainId.toString();
        } else {
            // If the new signer doesn't have a provider, we might lose the provider connection
            // or keep the old one. This state needs careful consideration.
            // For now, if newSigner.provider is null, this.provider remains unchanged.
            // If this.provider was from window.ethereum, it might still be valid.
            // If it was a JsonRpcProvider, it also remains.
            console.warn('BlockchainProviderService: New signer does not have an associated provider. Current provider retained if any.');
        }
        await this.updateBalance();
      } catch (err) {
        console.error("BlockchainProviderService: Error getting address for new signer:", err);
        this.account = null;
        this.balance = null;
      }
    } else if (newSigner === null) {
        this.signer = null;
        this.account = null;
        this.balance = null;
        console.log("BlockchainProviderService: Signer explicitly cleared.");
    } else {
        console.warn("BlockchainProviderService: Invalid signer provided to setSigner. Expected an Ethers.js Signer or null.");
    }
  }
}

/**
 * Singleton instance of the BlockchainProviderService.
 * @type {BlockchainProviderService}
 */
export const blockchainProviderService = new BlockchainProviderService(); 
import { ethers } from 'ethers';
import { config } from '../../config'; // Assuming config holds provider URL

class EthersBaseService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.balance = null;

    // Attempt to initialize a read-only provider on creation
    // This allows read operations even before wallet connection
    try {
        if (config.blockchain.providerUrl) {
            this.provider = new ethers.JsonRpcProvider(config.blockchain.providerUrl);
            console.log('Default read-only provider initialized.');
        } else {
             console.warn('Provider URL not found in config, read operations might fail until wallet connected.');
        }
    } catch (e) {
        console.error("Failed to create default provider on initial load:", e);
    }
  }

  /**
   * Initializes wallet connection (e.g., MetaMask).
   * Sets up the provider, requests accounts, gets the signer, and account details.
   * Attaches listeners for account/network changes.
   * @returns {Promise<boolean>} True if connection successful, throws error otherwise.
   */
  async init() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Connect to the browser provider (MetaMask)
        // Overwrites the default provider if previously set
        this.provider = new ethers.BrowserProvider(window.ethereum);

        // Request account access and get the signer
        // Note: `getSigner()` prompts connection if not already connected.
        this.signer = await this.provider.getSigner();
        this.account = this.signer.address;
        console.log('Connected Account:', this.account);

        // Get balance
        await this.updateBalance(); // Call helper to get balance

        // --- Event Listeners ---
        // Remove previous listeners to avoid duplicates if init is called again
        window.ethereum.removeListener('accountsChanged', this._handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', this._handleChainChanged);

        // Add event listeners for network/account changes
        window.ethereum.on('accountsChanged', this._handleAccountsChanged);
        window.ethereum.on('chainChanged', this._handleChainChanged);

        console.log('EthersBaseService initialized successfully.');
        return true;
      } catch (error) {
        console.error('Error initializing EthersBaseService:', error);
        // Reset state if initialization fails partially
        this.provider = null; // Consider reverting to default provider?
        this.signer = null;
        this.account = null;
        this.balance = null;
        if (error.code === 4001) { // User rejected connection
             throw new Error('Connection rejected. Please connect your wallet.');
        }
        throw new Error('Failed to initialize wallet connection.');
      }
    } else {
      console.error('MetaMask or compatible wallet not found.');
      throw new Error('Please install MetaMask or another compatible wallet.');
    }
  }

  // --- Listener Handlers ---
  _handleAccountsChanged = (accounts) => {
    console.log('Accounts changed detected.');
    // Reloading is simple but disrupts user experience.
    // A more advanced app might re-initialize state without a full reload.
    window.location.reload();
  }

  _handleChainChanged = (chainId) => {
    console.log('Network changed detected.');
    window.location.reload();
  }

  // --- Getters ---
  getProvider() {
    // Return the current provider (could be default or browser)
    if (!this.provider) {
        console.warn('Ethers provider not available. Attempt default or call init().');
        // Optional: Try to initialize default provider again if null
        try {
            this.provider = new ethers.JsonRpcProvider(config.blockchain.providerUrl);
        } catch (e) {
             console.error("Failed to create default provider:", e);
        }
    }
    return this.provider;
  }

  getSigner() {
     // Signer is only available after successful init()
     if (!this.signer) {
        console.warn('Ethers signer not initialized. Call init() first or connect wallet.');
     }
    return this.signer;
  }

  getAccount() {
    // Account is only available after successful init()
    return this.account;
  }

  isConnected() {
    return !!this.signer && !!this.account;
  }

  async getBalance() {
    // Returns the locally stored balance
    return this.balance;
  }

  // --- Actions ---

  /**
   * Fetches the latest balance for the connected account and updates the service state.
   * @returns {Promise<string|null>} Formatted balance in ETH or null if failed.
   */
  async updateBalance() {
    if (!this.provider || !this.account) {
        console.warn('Cannot update balance: Provider or account not initialized.');
        return null;
    }
    try {
        const balanceWei = await this.provider.getBalance(this.account);
        this.balance = ethers.formatEther(balanceWei);
        console.log('Account Balance updated:', this.balance, 'ETH');
        return this.balance;
    } catch (error) {
         console.error('Error fetching balance:', error);
         this.balance = null; // Reset balance on error
         return null;
    }
  }

  /**
   * Requests the connected account to sign a message.
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The signature.
   */
  async signMessage(message) {
    const signer = this.getSigner();
    if (!signer) {
      throw new Error('Wallet not connected or signer not available.');
    }
    try {
      console.log(`Requesting signature for message: "${message}"`);
      const signature = await signer.signMessage(message);
      console.log('Signature obtained:', signature);
      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      if (error.code === 4001) { // User rejected signing
         throw new Error('Message signing rejected by user.');
      }
      throw new Error('Failed to sign message.');
    }
  }

  /**
   * Sends a transaction to a specified contract.
   * Handles finding the contract, calling the method, and waiting for confirmation.
   * Requires the wallet to be connected (uses signer).
   * @param {string} contractAddress - The address of the target contract.
   * @param {ethers.ContractInterface} contractAbi - The ABI of the target contract.
   * @param {string} methodName - The name of the function to call.
   * @param {Array<any>} args - Arguments for the contract function.
   * @param {object} options - Transaction options (e.g., { value: ethers.parseEther("0.1") }).
   * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt.
   */
  async sendTransaction(contractAddress, contractAbi, methodName, args = [], options = {}) {
    const signer = this.getSigner();
    if (!signer) {
      throw new Error('Wallet not connected or signer not available for transaction.');
    }
    if (!contractAddress || !contractAbi) {
        throw new Error('Contract address and ABI must be provided for transaction.');
    }
    let txResponse;
    try {
      const contract = new ethers.Contract(contractAddress, contractAbi, signer);
      console.log(`Sending transaction to ${contractAddress} -> ${methodName}(${args.join(', ')}) with options:`, options);

      // Estimate gas (optional but recommended for complex txns)
      // try {
      //   const estimatedGas = await contract[methodName].estimateGas(...args, options);
      //   console.log('Estimated gas:', estimatedGas.toString());
      //   // Add a buffer to the estimated gas
      //   options.gasLimit = (estimatedGas * BigInt(12)) / BigInt(10); // 20% buffer
      // } catch (gasError) {
      //    console.warn(`Gas estimation failed for ${methodName}:`, gasError.message);
      //    // Proceed without gasLimit or set a default? Handle carefully.
      // }


      txResponse = await contract[methodName](...args, options); // Assign txResponse here
      console.log(`Transaction sent: ${txResponse.hash}`);

      // Wait for transaction confirmation
      console.log('Waiting for transaction confirmation...');
      const receipt = await txResponse.wait();
      // console.log('Transaction confirmed:', receipt); // Commented out full receipt log
      console.log(`Transaction confirmed. Hash: ${receipt.hash}, Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`); // More concise log

      if (receipt.status === 0) {
         // Transaction was confirmed but failed (reverted)
         console.error("Transaction confirmed but failed (reverted) on-chain.", receipt);
         // Attempt to get revert reason (may require custom error parsing or provider support)
         throw new Error(`Transaction ${txResponse.hash} confirmed but failed on-chain. Check blockchain explorer for details.`);
      }

      return receipt; // Return the receipt object after successful confirmation

    } catch (error) {
        console.error(`Error sending transaction (${methodName}):`, error);
        // Attempt to extract revert reason if available
        const txHashInfo = txResponse ? ` (Transaction: ${txResponse.hash})` : '';
        let reason = `Transaction failed${txHashInfo}.`; // Default message

        // Ethers v6 error handling is more structured
        if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
             reason = 'Transaction rejected by user.';
        } else if (error.reason) {
            // Direct reason string provided by Ethers (often from require/revert)
            reason = `Transaction failed: ${error.reason}${txHashInfo}`;
        } else if (error.data?.message) { // Check error.data for provider-specific details
            reason = `Transaction failed: ${error.data.message}${txHashInfo}`;
        } else if (error.message) {
             // Fallback to generic error message parsing
             const revertMatch = error.message.match(/execution reverted: ([^']+)/);
             const contractCallMatch = error.message.match(/Contract Call:\s*([^\n]+)/); // Example regex
             if (revertMatch && revertMatch[1]) {
                 reason = `Transaction reverted: ${revertMatch[1]}${txHashInfo}`;
             } else if (contractCallMatch && contractCallMatch[1]) {
                 reason = `Transaction failed during contract call: ${contractCallMatch[1]}${txHashInfo}`;
             }
             else {
                 // Use a snippet of the error message if nothing specific is found
                 reason = `${error.message.substring(0, 100)}...${txHashInfo}`;
             }
        }
        throw new Error(reason);
    }
  }

  /**
   * Reads data from a contract using a view or pure function.
   * Uses the provider (read-only), does not require wallet connection after initial setup.
   * @param {string} contractAddress - The address of the target contract.
   * @param {ethers.ContractInterface} contractAbi - The ABI of the target contract.
   * @param {string} methodName - The name of the view/pure function to call.
   * @param {Array<any>} args - Arguments for the contract function.
   * @returns {Promise<any>} The result returned by the contract function.
   */
  async readContract(contractAddress, contractAbi, methodName, args = []) {
    const provider = this.getProvider(); // Use getter to ensure provider exists
    if (!provider) {
       throw new Error('Provider not available for contract read. Check connection or config.');
    }
    if (!contractAddress || !contractAbi) {
        throw new Error('Contract address and ABI must be provided for read operation.');
    }
    try {
      // Create contract instance with the provider (read-only)
      const contract = new ethers.Contract(contractAddress, contractAbi, provider);
      console.log(`Reading contract ${contractAddress} -> ${methodName}(${args.join(', ')})`);

      // Call the view/pure function
      const result = await contract[methodName](...args);
      // Consider adding specific formatting for BigInt results if needed
      // console.log(`Read result from ${methodName}:`, result);
      return result;

    } catch (error) {
        // console.error(`Error reading contract (${methodName}) on ${contractAddress}:`, error); // Removed log
        // Add specific error handling if needed (e.g., contract doesn't exist, invalid args)
        // Check if the contract exists at the address?
        // const code = await provider.getCode(contractAddress);
        // if (code === '0x') {
        //    throw new Error(`Contract not found at address ${contractAddress} for read operation.`);
        // }
        throw new Error(`Failed to read contract method ${methodName}. Reason: ${error.message}`);
    }
  }

  // Method to explicitly set the signer and account (useful for testing)
  setSigner(newSigner) {
    this.signer = newSigner;
    if (newSigner) {
         // Use a promise or handle async appropriately if getAddress might not be sync
         Promise.resolve(newSigner.getAddress()).then(address => {
             this.account = address;
             console.log(`EthersBaseService: Signer explicitly set to ${address}`);
             this.updateBalance(); // Update balance for the new account
         }).catch(err => {
             console.error("EthersBaseService: Error getting address for new signer:", err);
             this.account = null;
             this.balance = null;
         });
    } else {
        this.account = null;
        this.balance = null;
         console.log("EthersBaseService: Signer explicitly cleared.");
    }
  }
}

// Export a single instance (Singleton pattern)
export const ethersBaseService = new EthersBaseService(); 
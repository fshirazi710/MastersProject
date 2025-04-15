import { ethers } from 'ethers';
import { config } from '../config'; // Assuming config holds contract address/abi

class EthersService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.balance = null;
  }

  async init() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Connect to the browser provider (MetaMask)
        this.provider = new ethers.BrowserProvider(window.ethereum);

        // Request account access and get the signer
        this.signer = await this.provider.getSigner();
        this.account = this.signer.address;
        console.log('Connected Account:', this.account);

        // Get balance
        const balanceWei = await this.provider.getBalance(this.account);
        this.balance = ethers.formatEther(balanceWei);
        console.log('Account Balance:', this.balance, 'ETH');

        // Add event listeners for network/account changes (recommended)
        window.ethereum.on('accountsChanged', (accounts) => {
          console.log('Accounts changed, reloading page for re-initialization.');
          // Simple reload for now, better handling might be needed
          window.location.reload();
        });
        window.ethereum.on('chainChanged', (chainId) => {
          console.log('Network changed, reloading page.');
          window.location.reload();
        });

        return true;
      } catch (error) {
        console.error('Error initializing ethers:', error);
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

  getProvider() {
    if (!this.provider) {
        console.warn('Ethers provider not initialized. Call init() first.');
    }
    return this.provider;
  }

  getSigner() {
     if (!this.signer) {
        console.warn('Ethers signer not initialized. Call init() first.');
     }
    return this.signer;
  }

  getAccount() {
    return this.account;
  }

  async getBalance() {
    if (!this.provider || !this.account) {
        console.warn('Ethers provider/account not initialized.');
        return null;
    }
    // Fetch latest balance
    const balanceWei = await this.provider.getBalance(this.account);
    return ethers.formatEther(balanceWei);
  }

  async signMessage(message) {
    if (!this.signer) {
      throw new Error('Wallet not connected or signer not available.');
    }
    try {
      console.log(`Requesting signature for message: "${message}"`);
      const signature = await this.signer.signMessage(message);
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

  async sendTransaction(contractAddress, contractAbi, methodName, args = [], options = {}) {
    if (!this.signer) {
      throw new Error('Wallet not connected or signer not available.');
    }
    if (!contractAddress || !contractAbi) {
        throw new Error('Contract address and ABI must be provided.');
    }
    try {
      const contract = new ethers.Contract(contractAddress, contractAbi, this.signer);
      console.log(`Sending transaction to ${contractAddress} -> ${methodName}(${args.join(', ')}) with options:`, options);

      // Estimate gas (optional but recommended)
      // let estimatedGas = await contract[methodName].estimateGas(...args, options);
      // console.log('Estimated gas:', estimatedGas.toString());
      // options.gasLimit = estimatedGas; // Add buffer? Needs tuning.

      const txResponse = await contract[methodName](...args, options);
      console.log('Transaction sent:', txResponse.hash);

      // Wait for transaction confirmation (optional, depends on UX needs)
      // console.log('Waiting for transaction confirmation...');
      // const txReceipt = await txResponse.wait();
      // console.log('Transaction confirmed:', txReceipt);
      // return txReceipt; // Return receipt if waiting

      return txResponse; // Return the response object immediately

    } catch (error) {
        console.error(`Error sending transaction (${methodName}):`, error);
        // Attempt to extract revert reason if available
        let reason = 'Transaction failed.';
        if (error.reason) {
            reason = `Transaction failed: ${error.reason}`;
        } else if (error.data?.message) {
            reason = `Transaction failed: ${error.data.message}`;
        } else if (error.message) {
             // Include parts of the error message if helpful
             const match = error.message.match(/execution reverted: ([^']+)/);
             if (match && match[1]) {
                 reason = `Transaction reverted: ${match[1]}`;
             } else if (error.code === 4001) {
                 reason = 'Transaction rejected by user.';
             }
        }
        throw new Error(reason);
    }
  }

  // New method for reading from contracts
  async readContract(contractAddress, contractAbi, methodName, args = []) {
    // Use provider for read-only calls
    if (!this.provider) {
       // If the wallet isn't connected/initialized, try creating a default provider
       // This allows reading data even if the user hasn't connected their wallet yet
       // You might want to use a specific provider URL from your config here
       console.warn('Wallet provider not initialized for read, attempting default provider...');
       try {
           // Replace with your actual provider URL if needed
           const defaultProvider = new ethers.JsonRpcProvider(config.providerUrl || 'http://localhost:8545'); 
           this.provider = defaultProvider;
       } catch (e) {
           console.error("Failed to create default provider for read operation:", e);
           throw new Error('Provider not available for contract read.');
       }
    }
    if (!contractAddress || !contractAbi) {
        throw new Error('Contract address and ABI must be provided for read operation.');
    }
    try {
      // Create contract instance with the provider (read-only)
      const contract = new ethers.Contract(contractAddress, contractAbi, this.provider);
      console.log(`Reading contract ${contractAddress} -> ${methodName}(${args.join(', ')})`);
      
      // Call the view/pure function
      const result = await contract[methodName](...args);
      console.log(`Read result from ${methodName}:`, result);
      return result;

    } catch (error) {
        console.error(`Error reading contract (${methodName}):`, error);
        // Add specific error handling if needed (e.g., contract doesn't exist, invalid args)
        throw new Error(`Failed to read contract method ${methodName}.`);
    }
  }
}

// Export a single instance
export const ethersService = new EthersService(); 
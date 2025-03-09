import Web3 from 'web3';
import { config } from '../config';

class Web3Service {
  constructor() {
    this.web3 = null;
    this.account = null;
    this.contract = null;
  }

  async init() {
    if (window.ethereum) {
      try {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.web3 = new Web3(window.ethereum);
        
        // Get connected account
        const accounts = await this.web3.eth.getAccounts();
        this.account = accounts[0];
        
        // Initialize contract
        this.contract = new this.web3.eth.Contract(
          config.contract.abi,
          config.contract.address
        );
        
        return true;
      } catch (error) {
        console.error('Error initializing Web3:', error);
        throw error;
      }
    } else {
      throw new Error('Please install MetaMask or another Web3 provider');
    }
  }

  async submitVote(voteData) {
    if (!this.web3 || !this.account || !this.contract) {
      throw new Error('Web3 not initialized');
    }

    try {
      // Convert reward pool to wei
      const rewardPoolWei = this.web3.utils.toWei(voteData.reward_pool.toString(), 'ether');
      
      // Get decryption time in Unix timestamp
      const decryptionTime = Math.floor(new Date(voteData.end_date).getTime() / 1000);
      
      // Submit vote transaction
      const result = await this.contract.methods.submitVote(
        voteData.ciphertext,
        voteData.nonce,
        decryptionTime,
        voteData.g2r,
        voteData.threshold
      ).send({
        from: this.account,
        value: rewardPoolWei,
        gas: 500000
      });

      return result;
    } catch (error) {
      console.error('Error submitting vote:', error);
      throw error;
    }
  }

  async getRequiredDeposit() {
    if (!this.web3 || !this.contract) {
      throw new Error('Web3 not initialized');
    }

    try {
      const deposit = await this.contract.methods.requiredDeposit().call();
      return this.web3.utils.fromWei(deposit, 'ether');
    } catch (error) {
      console.error('Error getting required deposit:', error);
      throw error;
    }
  }

  async getAccount() {
    return this.account;
  }

  async getBalance() {
    if (!this.web3 || !this.account) {
      throw new Error('Web3 not initialized');
    }

    try {
      const balance = await this.web3.eth.getBalance(this.account);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }
}

export const web3Service = new Web3Service(); 
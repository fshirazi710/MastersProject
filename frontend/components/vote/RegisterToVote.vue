<template>
    <div class="voting-section">
      <h2>Register as Holder</h2>

      <!-- Display Election Deposit/Reward Info -->
      <div class="info-box">
        <p>To participate as a holder and be eligible for rewards, you need to deposit the required amount.</p>
        <p><strong>Required Deposit:</strong> {{ props.requiredDeposit }} ETH</p>
        <p><strong>Potential Reward Pool:</strong> {{ props.rewardPool }} ETH</p>
        <p><small>(Deposit is refundable if you submit your shares on time)</small></p>
      </div>

      <!-- Loading State -->
      <div v-if="isCheckingStatus" class="loading-message">
          Checking registration status...
      </div>

      <!-- Wallet Connection -->
      <div v-if="!isWalletConnected && !isCheckingStatus">
          <p>Please connect your wallet to register as a holder.</p>
          <button @click="connectWallet" class="btn primary" :disabled="loading">
              {{ loading ? 'Connecting...' : 'Connect Wallet' }}
          </button>
      </div>

      <!-- Registration Action -->
      <div v-if="isWalletConnected && !isRegistered && !isCheckingStatus">
          <p>Connected Account: {{ currentAccount }}</p>
          <button @click="registerAndDeposit" class="btn primary" :disabled="loading">
              {{ loading ? 'Processing Deposit...' : 'Join as Holder & Deposit' }}
          </button>
      </div>

      <!-- Already Registered Message -->
      <div v-if="isWalletConnected && isRegistered && !isCheckingStatus" class="success-message">
           <i class="success-icon">✅</i>
           <p>You are already registered as a holder for this election with account {{ currentAccount }}.</p>
      </div>

       <!-- Error Message Display -->
      <p v-if="error" class="error-message">{{ error }}</p>

    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { ethers } from 'ethers'
  import { ethersService } from '@/services/ethersService.js'
  import { config } from '@/config'

  const props = defineProps({
    electionId: {
      type: String,
      required: true
    },
    endDate: {
      type: String,
      required: true
    },
    rewardPool: {
      type: [String, Number],
      required: true
    },
    requiredDeposit: {
      type: [String, Number],
      required: true
    }
  })

  const loading = ref(false)
  const error = ref(null)
  const isWalletConnected = ref(false)
  const currentAccount = ref(null)
  const isRegistered = ref(false)
  const isCheckingStatus = ref(true)

  const emit = defineEmits(['registration-successful'])

  onMounted(async () => {
    await checkWalletConnection()
    if (isWalletConnected.value) {
      await checkRegistrationStatus()
    }
    isCheckingStatus.value = false
  })

  async function checkWalletConnection() {
    const account = ethersService.getAccount()
    if (account) {
      isWalletConnected.value = true
      currentAccount.value = account
      console.log("Wallet already connected:", account)
    } else {
      isWalletConnected.value = false
      currentAccount.value = null
    }
  }

  async function connectWallet() {
    loading.value = true
    error.value = null
    try {
      await ethersService.init()
      isWalletConnected.value = true
      currentAccount.value = ethersService.getAccount()
      console.log("Wallet connected:", currentAccount.value)
      await checkRegistrationStatus()
    } catch (err) {
      error.value = err.message || "Failed to connect wallet."
      isWalletConnected.value = false
      currentAccount.value = null
    } finally {
      loading.value = false
    }
  }

  async function checkRegistrationStatus() {
    if (!currentAccount.value || !props.electionId) return;
    isCheckingStatus.value = true;
    console.log(`Checking registration status for ${currentAccount.value} in election ${props.electionId}...`);
    try {
      // Use the new readContract method from ethersService
      const statusResult = await ethersService.readContract(
          config.contract.address,
          config.contract.abi,
          'getHolderStatus', // Function name in TimedReleaseVoting.sol
          [parseInt(props.electionId), currentAccount.value] // Arguments: electionId, holderAddress
      );
      
      // Assuming getHolderStatus returns an object/tuple [isActive, hasSubmitted, deposit]
      // Adjust the access based on the actual return type (e.g., statusResult[0] or statusResult.isActive)
      isRegistered.value = statusResult[0]; 
      console.log("On-chain registration status:", isRegistered.value);

    } catch (err) {
      console.error("Error checking registration status:", err);
      // Don't set a user-facing error here, maybe just log it
      // error.value = "Could not verify registration status."; 
      isRegistered.value = false; // Assume not registered on error
    } finally {
       isCheckingStatus.value = false;
    }
  }

  async function registerAndDeposit() {
    if (!isWalletConnected.value || !currentAccount.value) {
      error.value = "Please connect your wallet first."
      return
    }
    if (isRegistered.value) {
      error.value = "You are already registered as a holder for this election."
      return
    }

    loading.value = true
    error.value = null

    try {
      console.log(`Attempting to register ${currentAccount.value} for election ${props.electionId} with deposit ${props.requiredDeposit} ETH`)

      let depositInWei
      try {
        depositInWei = ethers.parseEther(props.requiredDeposit.toString())
        if (depositInWei <= 0n) {
          throw new Error("Deposit amount must be positive.")
        }
      } catch (e) {
        console.error("Invalid deposit amount:", props.requiredDeposit, e)
        throw new Error("Invalid required deposit amount provided.")
      }
      console.log(`Deposit amount in Wei: ${depositInWei.toString()}`)

      const contractArgs = [
        parseInt(props.electionId)
      ]

      const txOptions = {
        value: depositInWei
      }

      console.log("Sending joinAsHolder transaction...")
      const txResponse = await ethersService.sendTransaction(
        config.contract.address,
        config.contract.abi,
        'joinAsHolder',
        contractArgs,
        txOptions
      )

      console.log("Transaction sent, hash:", txResponse.hash)
      loading.value = true
      isRegistered.value = true
      error.value = null
      emit('registration-successful')

      console.log("Registration and deposit successful (transaction sent).")
    } catch (err) {
      console.error("Failed during registration & deposit:", err)
      error.value = err.message || "An unexpected error occurred during registration."
      isRegistered.value = false
    } finally {
      loading.value = false
    }
  }
  </script>
  
  <style lang="scss" scoped>
  .voting-section {
    // ... existing styles ...
  }

  .info-box {
    margin-bottom: 20px;
    padding: 15px;
    background-color: var(--background-alt);
    border-left: 4px solid var(--primary-color);
    border-radius: var(--border-radius-sm);
    font-size: 0.95em;

    p {
        margin-bottom: 5px;
    }
    small {
        color: var(--text-secondary);
    }
  }

  .loading-message,
  .success-message,
  .error-message {
    margin-top: 15px;
    padding: 10px 15px;
    border-radius: var(--border-radius);
    text-align: center;
  }

  .loading-message {
    background-color: var(--info-light);
    color: var(--info-dark);
  }

  .success-message {
    background-color: var(--success-light);
    border: 1px solid var(--success);
    color: var(--success-dark);
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
    i {
        font-size: 1.2em;
        color: var(--success);
    }
  }

  .error-message {
    color: var(--danger);
    background-color: var(--danger-light);
    border: 1px solid var(--danger);
  }
  </style>
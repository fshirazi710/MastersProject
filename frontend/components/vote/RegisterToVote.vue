<template>
    <div class="voting-section">
      <h2>Register as Holder</h2>

      <!-- Display Vote Session Deposit/Reward Info -->
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

          <!-- Password Inputs -->
          <div class="form-group">
            <label for="reg-password">Create Vote Session Key Password:</label>
            <input 
              type="password" 
              id="reg-password" 
              v-model="password"
              placeholder="Enter a strong password"
              required
              class="form-input"
            />
            <small>This password encrypts your vote session-specific key. Store it securely, it's needed to submit shares!</small>
          </div>
          <div class="form-group">
            <label for="reg-confirm-password">Confirm Password:</label>
            <input 
              type="password" 
              id="reg-confirm-password" 
              v-model="confirmPassword"
              placeholder="Confirm your password"
              required
              class="form-input"
            />
          </div>
          <p v-if="password && confirmPassword && !isPasswordValid" class="error-message small">
              Passwords do not match.
          </p>

          <!-- Join Button -->
          <button 
            @click="registerAndDeposit" 
            class="btn primary" 
            :disabled="loading || !isPasswordValid"
          >
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
  import { 
    generateBLSKeyPair, 
    deriveKeyFromPassword, 
    AESEncrypt, 
    bytesToHex, 
    randomBytes // Need this for salt generation
  } from '@/services/cryptography.js'
  import { config } from '@/config'

  const props = defineProps({
    voteSessionId: {
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
  const password = ref('')
  const confirmPassword = ref('')

  const emit = defineEmits(['registration-successful'])

  const isPasswordValid = computed(() => {
    return password.value && password.value === confirmPassword.value;
  });

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
    if (!currentAccount.value || !props.voteSessionId) return;
    isCheckingStatus.value = true;
    console.log(`Checking registration status for ${currentAccount.value} in vote session ${props.voteSessionId}...`);
    try {
      // Use the new readContract method from ethersService
      const statusResult = await ethersService.readContract(
          config.contract.address,
          config.contract.abi,
          'getHolderStatus', // Function name in TimedReleaseVoting.sol
          [parseInt(props.voteSessionId), currentAccount.value] // Use voteSessionId
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
      error.value = "Please connect your wallet first.";
      return;
    }
    if (isRegistered.value) {
      error.value = "You are already registered as a holder for this election.";
      return;
    }
    // Check password validity again before proceeding (belt and suspenders)
    if (!isPasswordValid.value) {
       error.value = "Please enter matching passwords.";
       return;
    }

    loading.value = true;
    error.value = null;
    let txReceipt = null; // Define txReceipt outside try block

    try {
      console.log(`Attempting to register ${currentAccount.value} for vote session ${props.voteSessionId} with deposit ${props.requiredDeposit} ETH`);

      // 1. Convert deposit amount (passed as string/number in ETH) to Wei
      let depositInWei;
      try {
          depositInWei = ethers.parseEther(props.requiredDeposit.toString());
          if (depositInWei <= 0n) {
               throw new Error("Deposit amount must be positive.");
          }
      } catch (e) {
           console.error("Invalid deposit amount:", props.requiredDeposit, e);
           throw new Error("Invalid required deposit amount provided.");
      }
      console.log(`Deposit amount in Wei: ${depositInWei.toString()}`);

      // 2. Prepare arguments for the smart contract function
      const contractArgs = [
          parseInt(props.voteSessionId) // Use voteSessionId
      ];

      // 3. Prepare transaction options (including the deposit value)
      const txOptions = {
          value: depositInWei
      };

      // 4. Send the transaction via ethersService and wait for receipt
      console.log("Sending joinAsHolder transaction and waiting for confirmation...");
      txReceipt = await ethersService.sendTransaction(
          config.contract.address,
          config.contract.abi,
          'joinAsHolder',      // Contract method name
          contractArgs,       // Arguments for the method
          txOptions           // Transaction options (like value)
      );
      // Note: sendTransaction now throws if confirmation fails or tx reverts
      console.log("Transaction confirmed, receipt:", txReceipt); 
      
      // --- Post-Transaction Steps (Key Generation, Encryption, Storage) ---
      console.log("Transaction confirmed. Generating and encrypting election key...");
      const { sk, pk } = generateBLSKeyPair(); // sk is BigInt, pk is Point object
      const blsPrivateKeyHex = sk.toString(16);
      const blsPublicKeyHex = pk.toHex();
      console.log("Generated BLS Public Key:", blsPublicKeyHex);
      
      // Derive encryption key from password
      const salt = randomBytes(16); // Generate a random 16-byte salt
      const derivedKey = await deriveKeyFromPassword(password.value, salt);
      console.log("Derived encryption key."); // Don't log the key itself!

      // Encrypt the BLS private key
      const encryptedPrivateKeyHex = await AESEncrypt(blsPrivateKeyHex, derivedKey);
      console.log("Encrypted BLS private key.");
      
      // Store in localStorage (scoped by vote session and user)
      const publicKeyStorageKey = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsPublicKey`;
      const encryptedPrivateKeyStorageKey = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsEncryptedPrivateKey`;
      const saltStorageKey = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsSalt`;
      
      localStorage.setItem(publicKeyStorageKey, blsPublicKeyHex);
      localStorage.setItem(encryptedPrivateKeyStorageKey, encryptedPrivateKeyHex);
      localStorage.setItem(saltStorageKey, bytesToHex(salt)); // Store salt (as hex) for later key derivation
      console.log(`Stored keys for vote session ${props.voteSessionId} user ${currentAccount.value}`);
      
      // ---------------------------------------------------------------------

      // Transaction was confirmed successfully
      isRegistered.value = true;
      error.value = null; // Clear previous errors
      
      console.log("Registration and deposit successful (transaction confirmed).");
      emit('registration-successful'); // Notify parent component *after* success

    } catch (err) {
      console.error("Failed during registration & deposit process:", err);
      error.value = err.message || "An unexpected error occurred during registration.";
      isRegistered.value = false; // Ensure state is correct on error

      // Clear any potentially stored keys if tx failed AFTER generation started (unlikely but possible)
      // Optional: Add more robust cleanup based on where the error occurred.
      const publicKeyStorageKeyOnError = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsPublicKey`;
      const encryptedPrivateKeyStorageKeyOnError = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsEncryptedPrivateKey`;
      const saltStorageKeyOnError = `vote_session_${props.voteSessionId}_user_${currentAccount.value}_blsSalt`;

      localStorage.removeItem(publicKeyStorageKeyOnError);
      localStorage.removeItem(encryptedPrivateKeyStorageKeyOnError);
      localStorage.removeItem(saltStorageKeyOnError); // Also remove salt on error

    } finally {
      loading.value = false;
      // Clear password fields after attempt
      password.value = '';
      confirmPassword.value = '';
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

  .form-group {
    margin-bottom: 15px;
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    .form-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      background-color: var(--background-light);
      color: var(--text-primary);
      box-sizing: border-box; // Ensure padding doesn't add to width
      &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
      }
    }
    small {
        display: block;
        margin-top: 5px;
        font-size: 0.85em;
        color: var(--text-secondary);
    }
  }
  .error-message.small {
      font-size: 0.9em;
      padding: 5px 10px;
      margin-top: -5px; /* Adjust spacing */
      margin-bottom: 10px;
      text-align: left;
  }
  </style>
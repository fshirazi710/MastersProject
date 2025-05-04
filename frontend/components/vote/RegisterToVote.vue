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
  // Import registryService and base service VIA the main aggregator
  import { ethersBaseService, registryService } from '~/services/ethersService.js'
  import { 
    generateBLSKeyPair, 
    deriveKeyFromPassword, 
    AESEncrypt, 
    bytesToHex, 
    randomBytes // Need this for salt generation
  } from '~/services/utils/cryptographyUtils.js'
  // Removed: import { config } from '@/config' // No longer used

  const props = defineProps({
    voteSessionId: {
      type: [String, Number], // Allow number or string
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
  // Removed local registration status state - rely on parent component's props/v-if
  // const isRegistered = ref(false) 
  // const isCheckingStatus = ref(true)
  const password = ref('')
  const confirmPassword = ref('')

  const emit = defineEmits(['registration-successful'])

  const isPasswordValid = computed(() => {
    return password.value && password.value === confirmPassword.value;
  });

  onMounted(async () => {
    // Only check wallet connection, not registration status here
    await checkWalletConnection()
  })

  async function checkWalletConnection() {
    const account = ethersBaseService.getAccount() // Use base service
    if (account) {
      isWalletConnected.value = true
      currentAccount.value = account
      console.log("RegisterToVote: Wallet already connected:", account)
    } else {
      isWalletConnected.value = false
      currentAccount.value = null
    }
  }

  async function connectWallet() {
    loading.value = true
    error.value = null
    try {
      await ethersBaseService.init() // Use base service
      isWalletConnected.value = true
      currentAccount.value = ethersBaseService.getAccount()
      console.log("RegisterToVote: Wallet connected:", currentAccount.value)
      // No need to check registration status here
    } catch (err) {
      error.value = err.message || "Failed to connect wallet."
      isWalletConnected.value = false
      currentAccount.value = null
    } finally {
      loading.value = false
    }
  }

  // Removed checkRegistrationStatus() - Parent component handles this

  async function registerAndDeposit() {
    if (!isWalletConnected.value || !currentAccount.value) {
      error.value = "Please connect your wallet first.";
      return;
    }
    // Note: We rely on the parent component correctly using v-if 
    // to only show this component if the user is not already registered.
    // A local check is removed for simplicity.

    if (!isPasswordValid.value) {
       error.value = "Please enter matching passwords.";
       return;
    }

    loading.value = true;
    error.value = null;
    let txReceipt = null; 

    try {
      // Convert voteSessionId prop (string/number) to number
      const sessionId = Number(props.voteSessionId);
      if (isNaN(sessionId)) {
           throw new Error("Invalid voteSessionId prop provided.");
      }
      console.log(`Attempting to register ${currentAccount.value} for vote session ${sessionId}`);
      
      // --- Generate BLS Key Pair FIRST --- 
      console.log("Generating session-specific BLS key pair...");
      const { sk, pk } = generateBLSKeyPair(); // sk is BigInt, pk is Point object
      const blsPrivateKeyHex = sk.toString(16);
      // Extract X and Y coordinates from the public key point (pk)
      // The exact method depends on the @noble/curves Point object structure
      // Assuming pk.x and pk.y return BigInts for the affine coordinates
      const blsPubKeyX = pk.x; 
      const blsPubKeyY = pk.y;
      const blsPublicKeyHexForStorage = pk.toHex(); // For localStorage
      
      if (blsPubKeyX === undefined || blsPubKeyY === undefined) {
          console.error("Failed to get X, Y coordinates from BLS public key point:", pk);
          throw new Error("Internal error generating BLS key coordinates.");
      }
      console.log(`Generated BLS Public Key Coords (X, Y): ${blsPubKeyX}, ${blsPubKeyY}`);
      // -------------------------------------

      // --- Call Registry Service --- 
      // registryService.registerParticipant handles fetching the required deposit
      // and sending the transaction with value.
      console.log("Calling registryService.registerParticipant...");
      txReceipt = await registryService.registerParticipant(
          sessionId, 
          blsPubKeyX, 
          blsPubKeyY
      );
      // registryService function will throw if transaction fails/reverts
      console.log("Registration transaction confirmed, receipt:", txReceipt);

      // --- Post-Transaction Steps (Key Encryption & Storage) ---
      console.log("Transaction confirmed. Encrypting and storing session key...");
      
      const salt = randomBytes(16);
      const derivedKey = await deriveKeyFromPassword(password.value, salt);
      console.log("Derived encryption key.");

      const encryptedDataHex = await AESEncrypt(blsPrivateKeyHex, derivedKey);

      const encryptedKeyStorageKey = `vote_session_${sessionId}_user_${currentAccount.value.toLowerCase()}_blsEncryptedPrivateKey`;
      const publicKeyStorageKey = `vote_session_${sessionId}_user_${currentAccount.value.toLowerCase()}_blsPublicKey`;
      const saltStorageKey = `vote_session_${sessionId}_user_${currentAccount.value.toLowerCase()}_blsSalt`;

      localStorage.setItem(encryptedKeyStorageKey, encryptedDataHex);
      localStorage.setItem(publicKeyStorageKey, blsPublicKeyHexForStorage); // Use full hex for storage
      localStorage.setItem(saltStorageKey, bytesToHex(salt));

      console.log("BLS key details encrypted and stored locally.");

      // Registration successful
      error.value = null;
      console.log("Registration and deposit successful.");
      emit('registration-successful'); // Notify parent component

    } catch (err) {
      console.error("Failed during registration process:", err);
      error.value = err.message || "An unexpected error occurred during registration.";

      // Clean up potentially stored keys if process failed after generation
      const sessionIdOnError = Number(props.voteSessionId); // Ensure number
      if (!isNaN(sessionIdOnError) && currentAccount.value) { 
          const accountLower = currentAccount.value.toLowerCase();
          const publicKeyStorageKeyOnError = `vote_session_${sessionIdOnError}_user_${accountLower}_blsPublicKey`;
          const encryptedPrivateKeyStorageKeyOnError = `vote_session_${sessionIdOnError}_user_${accountLower}_blsEncryptedPrivateKey`;
          const saltStorageKeyOnError = `vote_session_${sessionIdOnError}_user_${accountLower}_blsSalt`;
          localStorage.removeItem(publicKeyStorageKeyOnError);
          localStorage.removeItem(encryptedPrivateKeyStorageKeyOnError);
          localStorage.removeItem(saltStorageKeyOnError);
          console.log("Cleaned up potentially stored keys due to registration error.");
      }
    } finally {
      loading.value = false;
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
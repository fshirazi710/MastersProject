<template>
    <div class="voting-section">
      <h2>Register for Vote Session</h2>

      <!-- Wallet Connection -->
      <div v-if="!isWalletConnected">
          <p class="mb-2">Please connect your wallet to see registration options.</p>
          <button @click="connectWallet" class="btn primary" :disabled="loading || isCheckingUserStatus">
              {{ loading ? 'Connecting...' : 'Connect Wallet' }}
          </button>
          <p v-if="error && !isWalletConnected" class="error-message mt-2">{{ error }}</p> <!-- Show connect error -->
      </div>

      <!-- Registration Options (if wallet connected) -->
      <div v-else>
          <p class="mb-3 text-sm">Connected Account: <span class="font-mono">{{ currentAccount }}</span></p>

          <!-- Loading message for user registration status check -->
          <div v-if="isCheckingUserStatus" class="loading-message">
            Checking your registration status for this session...
          </div>

          <!-- Already Registered Message -->
          <div v-else-if="isAlreadyRegistered" class="success-message">
            <p>You are already registered as a <strong>{{ registeredRole }}</strong> for this vote session.</p>
          </div>
          
          <!-- Registration form or session closed message (if not already registered) -->
          <div v-else>
            <div v-if="isCheckingLiveStatus" class="loading-message">
              Verifying current registration window...
            </div>
            <div v-else-if="!registrationIsActuallyOpen" class="status-message warning">
              <p>The registration period for this vote session is currently closed.</p>
            </div>
            <div v-else class="registration-options-container grid md:grid-cols-2 gap-6">
              
              <!-- Option 1: Register as Holder -->
              <div class="holder-registration-option p-4 border rounded-lg shadow-sm">
                <h3>Register as Holder</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Participate as a key holder, submit decryption shares, and be eligible for rewards.</p>
                
                <div class="info-box mb-3">
                  <p><strong>Required Deposit:</strong> {{ props.requiredDeposit }} ETH</p>
                  <p><strong>Potential Reward Pool:</strong> {{ props.rewardPool }} ETH</p>
                  <p><small>(Deposit is refundable if you submit your shares on time)</small></p>
                </div>

                <!-- Key Management Mode Selection -->
                <div class="form-group key-mode-selection">
                  <label class="font-medium">BLS Key Setup:</label>
                  <div class="radio-group mt-1">
                    <label class="mr-4">
                      <input type="radio" value="generate" v-model="keyManagementMode" />
                      Generate New Key Pair
                    </label>
                    <label>
                      <input type="radio" value="import" v-model="keyManagementMode" />
                      Import Private Key (Hex)
                    </label>
                  </div>
                </div>

                <div v-if="keyManagementMode === 'import'" class="form-group">
                  <label for="import-sk">Paste BLS Private Key (Hex):</label>
                  <textarea id="import-sk" v-model="importedPrivateKeyHex" rows="3" class="form-input"></textarea>
                  <small>Imported key will be re-encrypted with the password below.</small>
                </div>

                <div class="form-group">
                  <label for="reg-password">Create Key Encryption Password:</label>
                  <input type="password" id="reg-password" v-model="password" class="form-input"/>
                  <small>Encrypts your session key. Store password securely!</small>
                </div>
                <div class="form-group">
                  <label for="reg-confirm-password">Confirm Password:</label>
                  <input type="password" id="reg-confirm-password" v-model="confirmPassword" class="form-input"/>
                </div>
                <p v-if="password && confirmPassword && !isPasswordValid" class="error-message small text-left mb-2">Passwords do not match.</p>
                
                <button @click="registerAndDeposit" class="btn primary w-full" :disabled="loading || !isPasswordValid || !registrationIsActuallyOpen || isCheckingLiveStatus">
                    {{ loading ? 'Processing Holder Registration...' : 'Join as Holder & Deposit' }}
                </button>
                <p v-if="error && registrationAttempted === 'holder'" class="error-message mt-2">{{ error }}</p>
              </div>

              <!-- Option 2: Register as Simple Voter -->
              <div class="voter-registration-option p-4 border rounded-lg shadow-sm flex flex-col justify-between">
                <div>
                  <h3>Register as Voter</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Participate by casting a vote. No deposit, no holder rewards.</p>
                </div>
                <button @click="registerAsVoterHandler" class="btn secondary w-full mt-auto" :disabled="loadingVoter || !registrationIsActuallyOpen || isCheckingLiveStatus">
                  {{ loadingVoter ? 'Processing Voter Registration...' : 'Register as Simple Voter' }}
                </button>
                <p v-if="error && registrationAttempted === 'voter'" class="error-message mt-2">{{ error }}</p>
              </div>
            </div>
            
            <!-- Download Link for Encrypted Key (after successful HOLDER registration) -->
            <div v-if="showDownloadLink && encryptedKeyForDownload" class="download-key-section mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p class="text-green-700 text-sm">Holder registration successful! Your encrypted session key is stored in your browser. <strong>Please also download a backup.</strong></p>
              <button @click="downloadEncryptedKey" class="btn secondary small-btn mt-2">
                Download Encrypted Session Key
              </button>
              <p class="text-xs text-gray-500 mt-1">Store this file and your password securely.</p>
            </div>
        </div>
      </div>

      <!-- The old "Already Registered" message might be handled by the parent or removed if this component assumes user is not yet registered -->
      <!-- <div v-if="isWalletConnected && isRegistered && !isCheckingStatus" class="success-message">
           <i class="success-icon">✅</i>
           <p>You are already registered as a holder for this election with account {{ currentAccount }}.</p>
      </div> -->

       <!-- General error display if needed, though specific errors are shown above -->
      <!-- <p v-if="error" class="error-message">{{ error }}</p> -->
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  // import { ethers } from 'ethers' // No longer directly needed for provider/signer

  // OLD IMPORTS - To be replaced
  // import { ethersBaseService, registryService } from '~/services/ethersService.js'

  // NEW SERVICE IMPORTS
  import { blockchainProviderService } from '@/services/blockchainProvider.js';
  import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
  import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js'; // Import for live status check

  // CRYPTO UTILS - Path and functions will be updated
  import { 
    generateBLSKeyPair, 
    // deriveKeyFromPassword, // Will be replaced by encryptWithPassword
    // AESEncrypt, // Will be replaced by encryptWithPassword
    // bytesToHex, // Will be handled by encryptWithPassword or imported from conversionUtils
    // randomBytes // Will be handled by encryptWithPassword
  } from '@/services/utils/blsCryptoUtils.js'; // Assuming generateBLSKeyPair is here
  import { encryptWithPassword } from '@/services/utils/aesUtils.js';
  // import { bytesToHex } from '@/services/utils/conversionUtils.js'; // If still needed separately

  // For deriving PK from imported SK
  // import { PointG1 } from '@noble/curves/bls12-381'; // OLD IMPORT - Causing issues
  import { bls12_381 } from '@noble/curves/bls12-381'; // NEW IMPORT - Import the whole curve module

  import { FIELD_ORDER } from '@/services/utils/constants.js'; // For potential validation/operations with private key

  const props = defineProps({
    voteSessionId: {
      type: [String, Number], 
      required: true
    },
    voteSessionAddress: { // ADDED PROP
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
  const isCheckingLiveStatus = ref(true); // For the on-chain check
  const registrationIsActuallyOpen = ref(false); // Store live on-chain status
  const password = ref('')
  const confirmPassword = ref('')

  // New state for user's registration status
  const isAlreadyRegistered = ref(false);
  const registeredRole = ref(''); // 'Holder' or 'Voter'
  const isCheckingUserStatus = ref(false); // To show loading while checking user registration

  // For key management mode and import
  const keyManagementMode = ref('generate'); // 'generate' or 'import'
  const importedPrivateKeyHex = ref('');

  // For key download
  const showDownloadLink = ref(false);
  const encryptedKeyForDownload = ref(null);

  // Add state for voter registration loading
  const loadingVoter = ref(false);

  const emit = defineEmits(['registration-successful'])

  const isPasswordValid = computed(() => {
    return password.value && password.value === confirmPassword.value;
  });

  const registrationAttempted = ref(null); // 'holder' or 'voter' to scope errors

  onMounted(async () => {
    await checkWalletConnection();
    if (isWalletConnected.value) {
      await checkLiveRegistrationPeriod();
      await checkUserRegistrationStatus(); // Add this call
    } else {
      isCheckingLiveStatus.value = false; // No wallet, no live check needed now
    }
  })

  async function checkWalletConnection() {
    // const account = ethersBaseService.getAccount() // OLD
    const account = blockchainProviderService.getAccount(); // NEW
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
    console.log("RegisterToVote: connectWallet called"); 
    loading.value = true
    error.value = null
    // Reset registration status on new connection attempt
    isAlreadyRegistered.value = false;
    registeredRole.value = '';
    try {
      console.log("RegisterToVote: Calling blockchainProviderService.init()..."); 
      const success = await blockchainProviderService.init(); 
      console.log("RegisterToVote: blockchainProviderService.init() returned:", success); 
      if (success) {
        isWalletConnected.value = true
        currentAccount.value = blockchainProviderService.getAccount(); 
        console.log("RegisterToVote: Wallet connected:", currentAccount.value)
        await checkLiveRegistrationPeriod();
        await checkUserRegistrationStatus(); // Add this call
      } else {
        console.error("RegisterToVote: blockchainProviderService.init() returned false without throwing."); 
        error.value = "Wallet connection failed for an unknown reason.";
        isWalletConnected.value = false;
        currentAccount.value = null;
      }
    } catch (err) {
      console.error("RegisterToVote: Error in connectWallet:", err); 
      error.value = err.message || "Failed to connect wallet."
      isWalletConnected.value = false
      currentAccount.value = null
    } finally {
      loading.value = false
      console.log("RegisterToVote: connectWallet finally block. Error ref:", error.value); 
    }
  }

  async function checkLiveRegistrationPeriod() {
    isCheckingLiveStatus.value = true;
    error.value = null; // Clear previous errors related to this check
    try {
      console.log(`RegisterToVote: Checking live registration period for session address: ${props.voteSessionAddress}`);
      registrationIsActuallyOpen.value = await voteSessionViewService.isRegistrationOpen(props.voteSessionAddress);
      console.log(`RegisterToVote: Live registration open status: ${registrationIsActuallyOpen.value}`);
    } catch (err) {
      console.error("RegisterToVote: Error checking live registration period:", err);
      error.value = "Could not verify if registration is currently open. Please try again.";
      registrationIsActuallyOpen.value = false; // Assume closed on error
    } finally {
      isCheckingLiveStatus.value = false;
    }
  }

  async function checkUserRegistrationStatus() {
    if (!isWalletConnected.value || !currentAccount.value || !props.voteSessionId) {
      console.log("RegisterToVote: Skipping user registration check - wallet not connected or voteSessionId missing.");
      isAlreadyRegistered.value = false; // Assume not registered if prerequisites missing
      return;
    }
    isCheckingUserStatus.value = true;
    error.value = null; // Clear previous errors
    try {
      const sessionId = Number(props.voteSessionId);
      if (isNaN(sessionId)) {
        throw new Error("Invalid voteSessionId for status check.");
      }
      console.log(`RegisterToVote: Checking registration status for ${currentAccount.value} in session ${sessionId}`);
      const participantInfo = await registryParticipantService.getParticipantInfo(sessionId, currentAccount.value);
      
      if (participantInfo && participantInfo.isRegistered) {
        isAlreadyRegistered.value = true;
        registeredRole.value = participantInfo.isHolder ? 'Holder' : 'Voter';
        console.log(`RegisterToVote: User ${currentAccount.value} is already registered as a ${registeredRole.value}.`);
      } else {
        isAlreadyRegistered.value = false;
        registeredRole.value = '';
        console.log(`RegisterToVote: User ${currentAccount.value} is not registered for session ${sessionId}.`);
      }
    } catch (err) {
      console.error("RegisterToVote: Error checking user registration status:", err);
      // Don't set a general error here, allow registration form to show by default if check fails.
      // error.value = "Could not verify your registration status. Please try to register if needed.";
      isAlreadyRegistered.value = false; // Assume not registered on error to allow attempt
    } finally {
      isCheckingUserStatus.value = false;
    }
  }

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
    let sk, pk; // Declare sk and pk here to be used by both modes
    let blsPrivateKeyHexForEncryption; // Hex of the private key to be encrypted

    try {
      // Convert voteSessionId prop (string/number) to number
      const sessionId = Number(props.voteSessionId);
      if (isNaN(sessionId)) {
           throw new Error("Invalid voteSessionId prop provided.");
      }
      console.log(`Attempting to register ${currentAccount.value} for vote session ${sessionId}`);
      
      // --- Handle BLS Key (Generate or Import) --- 
      if (keyManagementMode.value === 'generate') {
        console.log("Generating new session-specific BLS key pair...");
        const keyPair = generateBLSKeyPair(); 
        sk = keyPair.sk; // sk is BigInt
        pk = keyPair.pk; // pk is Point object
        blsPrivateKeyHexForEncryption = sk.toString(16);
        console.log("New BLS key pair generated.");
      } else if (keyManagementMode.value === 'import') {
        console.log("Importing BLS private key...");
        if (!importedPrivateKeyHex.value || !/^[0-9a-fA-F]+$/.test(importedPrivateKeyHex.value)) {
          throw new Error("Imported private key is empty or not a valid hex string.");
        }
        try {
          sk = BigInt('0x' + importedPrivateKeyHex.value.replace(/^0x/i, '')); // Ensure BigInt from hex
          if (sk <= 0n || sk >= FIELD_ORDER) {
            // Basic validation, FIELD_ORDER is from noble/curves constants for bls12-381 private keys
            throw new Error("Imported private key is out of the valid range.");
          }
        } catch (e) {
          throw new Error(`Invalid private key hex format: ${e.message}`);
        }
        // Derive public key from imported private key
        // pk = PointG1.BASE.multiply(sk); // OLD USAGE
        pk = bls12_381.PointG1.BASE.multiply(sk); // NEW USAGE - Access PointG1 via bls12_381
        blsPrivateKeyHexForEncryption = importedPrivateKeyHex.value.replace(/^0x/i, ''); // Use the validated hex string
        console.log("BLS private key imported and public key derived.");
      } else {
        throw new Error("Invalid key management mode selected.");
      }
      
      const blsPublicKeyHexForContract = pk.toHex(); // Full public key hex for contract
      console.log(`Using BLS Public Key for contract: ${blsPublicKeyHexForContract}`);
      // -------------------------------------

      // --- Call Registry Service (New) --- 
      console.log(`Calling registryParticipantService.registerAsHolder for session ${sessionId}...`);
      // The service will handle fetching requiredDeposit and sending it as msg.value
      txReceipt = await registryParticipantService.registerAsHolder(
          sessionId, 
          blsPublicKeyHexForContract
      );
      console.log("Registration transaction confirmed, receipt:", txReceipt);

      // --- Post-Transaction Steps (Key Encryption & Storage) ---
      console.log("Transaction confirmed. Encrypting and storing session key using aesUtils.encryptWithPassword...");
      
      // const salt = randomBytes(16); // OLD - handled by encryptWithPassword
      // const derivedKey = await deriveKeyFromPassword(password.value, salt); // OLD
      // console.log("Derived encryption key.");
      // const encryptedDataHexOld = await AESEncrypt(blsPrivateKeyHex, derivedKey); // OLD

      // NEW: Use encryptWithPassword which handles salt, IV, and returns a single combined hex string
      const encryptedSkHex = await encryptWithPassword(blsPrivateKeyHexForEncryption, password.value);

      // Store the single encrypted hex string
      const encryptedKeyStorageKey = `vote_${sessionId}_encrypted_sk_hex`; // ALIGNED with [id].vue
      // const publicKeyStorageKey = `vote_session_${sessionId}_user_${currentAccount.value.toLowerCase()}_blsPublicKey`; // OLD - public key not stored for decryption purposes
      // const saltStorageKey = `vote_session_${sessionId}_user_${currentAccount.value.toLowerCase()}_blsSalt`; // OLD - salt is part of encryptedSkHex

      localStorage.setItem(encryptedKeyStorageKey, encryptedSkHex);
      // localStorage.setItem(publicKeyStorageKey, blsPublicKeyHexForStorage); // OLD
      // localStorage.setItem(saltStorageKey, bytesToHex(salt)); // OLD

      console.log("BLS private key encrypted and stored locally as single hex string.");
      console.log("IMPORTANT: User must remember their password and can optionally backup the stored encrypted string or a downloaded file if implemented.");

      // Prepare for download
      encryptedKeyForDownload.value = encryptedSkHex;
      showDownloadLink.value = true;

      // Registration successful
      error.value = null;
      console.log("Registration and deposit successful.");
      emit('registration-successful'); // Notify parent component

      registrationAttempted.value = 'holder';

    } catch (err) {
      console.error("Failed during registration process:", err);
      error.value = err.message || "An unexpected error occurred during registration.";

      // Clean up potentially stored keys if process failed after generation
      const sessionIdOnError = Number(props.voteSessionId); 
      if (!isNaN(sessionIdOnError) && currentAccount.value) { 
          const encryptedKeyStorageKeyOnError = `vote_${sessionIdOnError}_encrypted_sk_hex`;
          localStorage.removeItem(encryptedKeyStorageKeyOnError);
          console.log("Cleaned up potentially stored encrypted key due to registration error.");
      }
    } finally {
      loading.value = false;
      password.value = '';
      confirmPassword.value = '';
      importedPrivateKeyHex.value = ''; 
    }
  }

  async function registerAsVoterHandler() {
    if (!isWalletConnected.value || !currentAccount.value) {
      error.value = "Please connect your wallet first.";
      return;
    }

    loadingVoter.value = true;
    error.value = null;
    let txReceipt = null;

    try {
      const sessionId = Number(props.voteSessionId);
      if (isNaN(sessionId)) {
           throw new Error("Invalid voteSessionId prop provided.");
      }
      console.log(`Attempting to register ${currentAccount.value} as a VOTER for vote session ${sessionId}`);
      
      txReceipt = await registryParticipantService.registerAsVoter(sessionId);
      console.log("Voter registration transaction confirmed, receipt:", txReceipt);

      error.value = null;
      console.log("Voter registration successful.");
      emit('registration-successful'); // Notify parent component to re-fetch data

      registrationAttempted.value = 'voter';

    } catch (err) {
      console.error("Failed during voter registration process:", err);
      error.value = err.message || "An unexpected error occurred during voter registration.";
    } finally {
      loadingVoter.value = false;
    }
  }

  function downloadEncryptedKey() {
    if (!encryptedKeyForDownload.value) {
      error.value = "No encrypted key available for download.";
      return;
    }
    const blob = new Blob([encryptedKeyForDownload.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote_session_${props.voteSessionId}_encrypted_bls_private_key.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Encrypted key download initiated.");
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

  .registration-options-container {
    // using grid md:grid-cols-2 gap-6 for responsiveness
  }
  .holder-registration-option, .voter-registration-option {
    // basic padding, border, shadow already applied via tailwind-like classes
    // these classes are conceptual for structure, actual styling might use your project's CSS system
  }
  .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-3 { margin-bottom: 0.75rem; }
  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-4 { margin-top: 1rem; }
  .mt-auto { margin-top: auto; }
  .p-4 { padding: 1rem; }
  .p-3 { padding: 0.75rem; }
  .border { border-width: 1px; }
  .rounded-lg { border-radius: 0.5rem; }
  .rounded-md { border-radius: 0.375rem; }
  .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
  .text-sm { font-size: 0.875rem; }
  .text-xs { font-size: 0.75rem; }
  .text-gray-600 { color: #4B5563; }
  .dark .text-gray-400 { color: #9CA3AF; }
  .text-gray-500 { color: #6B7280; }
  .font-medium { font-weight: 500; }
  .font-mono { font-family: monospace; }
  .w-full { width: 100%; }
  .bg-green-50 { background-color: #F0FDF4; }
  .border-green-200 { border-color: #A7F3D0; }
  .text-green-700 { color: #047857; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .justify-between { justify-content: space-between; }
  .small-btn { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
  // Ensure existing .voting-section, .info-box, .error-message etc. are styled appropriately
  </style>
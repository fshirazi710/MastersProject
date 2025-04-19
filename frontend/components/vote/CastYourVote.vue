<template>
    <div class="voting-section">
      <h2>Cast Your Vote</h2>
  
      <!-- Encryption notice (shown regardless of registration) -->
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released. Be sure to come back later to check the results of the vote and see if you're one of the lucky winners of the vouchers!</p>
      </div>
  
      <!-- Check if user is registered VIA PROP -->
      <div v-if="props.isRegistered">
        <!-- Message shown if voting hasn't started yet (but user is registered) -->
        <div v-if="status === 'join'" class="status-message warning">
          Voting has not started yet. Please come back when the election is active.
        </div>
  
        <!-- Voting form (shown only if registered AND voting is active AND user hasn't voted yet) -->
        <form v-else-if="status === 'active' && !hasVoted" @submit.prevent="handleEncryptedVoteSubmit" class="voting-form">
          
          <!-- Custom Slider (Conditional) -->
          <fieldset v-if="displayHint === 'slider' && sliderConfig && sliderSteps.length > 0">
              <legend class="form-label">Select Value: {{ selectedSliderValue }}</legend>
              <!-- Use the new CustomSlider component -->
              <CustomSlider 
                v-model="selectedSliderValue"
                :steps="sliderSteps" 
              />
          </fieldset>

          <!-- Options Input (Conditional) -->
          <fieldset v-else>
            <legend class="sr-only">Vote Options</legend>
            <div class="options-list">
              <label v-for="(option, index) in options" :key="index" class="option-item">
                <input
                  type="radio"
                  :id="'option-' + index"
                  v-model="selectedOption"
                  :value="option"
                  name="vote-option"
                  required
                />
                <div class="option-content">
                  {{ option }}
                </div>
              </label>
            </div>
          </fieldset>
          
          <button 
            type="submit" 
            class="btn primary" 
            :disabled="loading || (displayHint === 'slider' ? selectedSliderValue === null : !selectedOption)"
          >
            {{ loading ? 'Submitting Vote...' : 'Submit Encrypted Vote' }}
          </button>
        </form>
  
        <!-- Message shown if user HAS voted -->
        <div v-else-if="status === 'active' && hasVoted" class="status-message success">
          <i class="icon check">✔️</i> Thank you for casting your vote!
        </div>
  
        <!-- Optional: Message if voting ended (but user is registered) -->
        <div v-else-if="status === 'ended'" class="status-message info">
          Voting has ended.
        </div>
  
      </div>
  
      <!-- Message shown if user is NOT registered VIA PROP -->
      <div v-else class="status-message warning">
        <span v-if="status === 'join'">
          You must be registered for this election to cast a vote. Please register first.
        </span>
        <span v-else-if="status === 'active' || status === 'ended'">
          You are not registered for this election. Registration is closed.
        </span>
        <!-- Fallback message if status is unexpected -->
        <span v-else>
          You are not registered for this election.
        </span>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, watch } from 'vue'
  import { holderApi, encryptedVoteApi } from '@/services/api'
  import { getKAndSecretShares, AESEncrypt, importBigIntAsCryptoKey } from '@/services/cryptography';
  import { ethersService } from '@/services/ethersService';
  import { config } from '@/config'; // Import config for contract details
  // Import the new custom slider component
  import CustomSlider from '@/components/shared/CustomSlider.vue'

  const props = defineProps({
    voteId: {
      type: String,
      required: true
    },
    options: {
      type: Array,
      required: true
    },
    endDate: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true,
    },
    isRegistered: {
      type: Boolean,
      required: true
    },
    displayHint: {
        type: String,
        default: null
    },
    sliderConfig: {
        type: Object,
        default: null
    },
    existingThreshold: {
        type: Number,
        required: true,
        default: 0
    }
  })
  
  const loading = ref(false);
  const selectedOption = ref(null)
  const selectedSliderValue = ref(null)
  const g1rValue = ref(null)
  const hasVoted = ref(false);
  
  // Compute allowed steps for the CustomSlider
  const sliderSteps = computed(() => {
      if (props.displayHint === 'slider' && props.options) {
          // Map options to numbers and filter out NaN
          const numbers = props.options.map(opt => Number(opt)).filter(num => !isNaN(num));
          // Sort numbers just in case they aren't ordered
          numbers.sort((a, b) => a - b);
          return numbers;
      }
      return [];
  });

  // Initialize slider value if applicable
  onMounted(() => {
      if (props.displayHint === 'slider' && props.sliderConfig && sliderSteps.value.length > 0) {
          // Set initial value to min from config, ensure it's in the allowed steps
          const initialValue = props.sliderConfig.min;
          if (sliderSteps.value.includes(initialValue)) {
              selectedSliderValue.value = initialValue;
          } else {
              // Fallback to the first available step if min isn't directly allowed
              selectedSliderValue.value = sliderSteps.value[0]; 
          }
      }
  });
  
  // Method to validate the key pair
  const validateKeyPair = async () => {
    try {
      // Get user address from ethersService
      const userAddress = await ethersService.getAccount();
      if (!userAddress) {
        throw new Error("Wallet not connected. Please connect your wallet.");
      }

      // --- CORRECTED localStorage key ---
      const lowerCaseAddress = userAddress.toLowerCase();
      const publicKeyStorageKey = `vote_session_${props.voteId}_user_${lowerCaseAddress}_blsPublicKey`; 
      const publicKeyHexRaw = localStorage.getItem(publicKeyStorageKey);

      if (!publicKeyHexRaw) {
        console.error(`BLS Public Key not found in localStorage for key: ${publicKeyStorageKey}`);
        throw new Error("Your election-specific key pair was not found. Please ensure you have registered correctly for this vote.");
      }
      // --------------------------------
      
      // --- Ensure 0x prefix for API call --- 
      const publicKeyHexPrefixed = publicKeyHexRaw.startsWith('0x') ? publicKeyHexRaw : `0x${publicKeyHexRaw}`;
      // -------------------------------------

      // Call backend API with the prefixed key
      const response = await encryptedVoteApi.validatePublicKey({ public_key: publicKeyHexPrefixed });
      return response.data.success
    } catch (error) {
      console.error("Failed to validate key pair:", error);
      // Throw the error instead of alerting, let handleEncryptedVoteSubmit catch it
      throw new Error(`Error validating key pair: ${error.message || 'Unknown error'}`); 
    }
  }
  
  // Handle vote submission
  const handleEncryptedVoteSubmit = async () => {
    try {
      if (loading.value) return;
      loading.value = true;
      // Validate the user's own key pair locally first
      await validateKeyPair(); 

      // --- Determine the actual option string to encrypt --- 
      let optionToEncrypt = null;
      if (props.displayHint === 'slider') {
          if (selectedSliderValue.value === null) {
              throw new Error("No slider value selected.");
          }
          // The v-model value IS the selected allowed number.
          // We need to send the *string* version that exists in props.options
          optionToEncrypt = String(selectedSliderValue.value);
          // Double-check it exists in the original options, just in case
          if (!props.options.includes(optionToEncrypt)) {
              console.error(`Slider value ${optionToEncrypt} not found in original options:`, props.options);
              throw new Error("Internal error: Selected slider value mismatch.");
          }
      } else {
          optionToEncrypt = selectedOption.value;
      }

      if (!optionToEncrypt) {
          throw new Error("No option selected or determined for voting.");
      }
      // -------------------------------------------------

      // --- Fetch Holder Data from CONTRACT --- 
      console.log("Fetching holder BLS keys and addresses from contract...");
      const [holderBlsKeysResult, holderEthAddressesResult] = await Promise.all([
          ethersService.readContract(
              config.contract.address, 
              config.contract.abi,
              'getHolderBlsKeys',
              [props.voteId]
          ),
          ethersService.readContract(
              config.contract.address, 
              config.contract.abi,
              'getHoldersByVoteSession', 
              [props.voteId]
          )
      ]);
      
      // Convert Proxy results to standard arrays IMMEDIATELY
      const holderBlsKeysArray = Array.from(holderBlsKeysResult || []);
      const holderEthAddressesArray = Array.from(holderEthAddressesResult || []);

      console.log("Retrieved Holder BLS Keys (Array):", holderBlsKeysArray);
      console.log("Retrieved Holder ETH Addresses (Array):", holderEthAddressesArray);

      if (!holderBlsKeysArray || holderBlsKeysArray.length === 0) {
            throw new Error("Could not retrieve holder BLS keys from the contract.");
      }
      if (!holderEthAddressesArray || holderEthAddressesArray.length === 0) {
          throw new Error("Could not retrieve holder ETH addresses from the contract.");
      }
      if (holderBlsKeysArray.length !== holderEthAddressesArray.length) {
          console.error("Mismatch between BLS key count and ETH address count from contract.");
          throw new Error("Inconsistent holder data retrieved from contract.");
      }

      // Use BLS Keys for Crypto
      const public_keys = holderBlsKeysArray; // Use the converted array
      const totalHolders = public_keys.length;
      // ------------------------------------------------
      
      // --- Calculate threshold dynamically --- 
      let thresholdToUse = 0;
      if (props.existingThreshold && props.existingThreshold > 0) {
          // Use the threshold already set on-chain
          thresholdToUse = props.existingThreshold;
          console.log("Using existing threshold from chain:", thresholdToUse);
      } else if (totalHolders > 0) {
          // Calculate threshold if none exists yet
          thresholdToUse = Math.floor(totalHolders / 2) + 1;
          console.log(`Calculating new threshold (N/2 + 1): totalHolders=${totalHolders}, threshold=${thresholdToUse}`);
      } else {
           // Should not happen if holders are required, but handle defensively
           console.error("Cannot calculate threshold: No secret holders found from contract."); // Updated log
           throw new Error("Cannot determine decryption threshold: No secret holders.");
      }
      const threshold = thresholdToUse; // Assign to variable used below
      // --------------------------------------

      // Pass the BLS keys to crypto function
      const [k_bigint, g1r, g2r, alphas_array] = await getKAndSecretShares(public_keys, threshold, totalHolders);
      g1rValue.value = g1r;

      // --- Convert derived symmetric key (k_bigint) to CryptoKey ---
      console.log("Importing derived symmetric key k for AES...");
      const aesCryptoKey = await importBigIntAsCryptoKey(k_bigint);
      console.log("Symmetric key k imported successfully.");
      // -----------------------------------------------------------

      // Encrypt the vote using the imported CryptoKey
      const voteString = JSON.stringify({ vote: optionToEncrypt });
      const combinedCiphertextHex = await AESEncrypt(voteString, aesCryptoKey);

      // Prepare the payload FOR THE BACKEND API
      const payload = {
          voter: ethersService.getAccount(),
          holderAddresses: holderEthAddressesArray,
          g1r: g1r,
          g2r: g2r,
          ciphertext: combinedCiphertextHex,
          alphas: alphas_array, // Send the array of alpha strings
          threshold: threshold
      };

      // Submit the encrypted vote via API
      console.log("Submitting encrypted vote payload to backend API:", payload);
      const submitResponse = await encryptedVoteApi.submitEncryptedVote(props.voteId, payload);

      if (submitResponse.data.success) {
        console.log("Encrypted vote submitted successfully:", submitResponse.data);
        hasVoted.value = true; // Update state to show success message
        alert("Your encrypted vote has been successfully submitted!");
      } else {
        throw new Error(submitResponse.data.message || "Failed to submit encrypted vote.");
      }

    } catch (error) {
        console.error("Error submitting encrypted vote:", error);
        
        // Check for specific 'Voter already voted' error from backend
        if (error.response && 
            error.response.status === 400 && 
            error.response.data && 
            typeof error.response.data.detail === 'string' && 
            error.response.data.detail === 'Voter has already cast a vote in this session') { 
            // If it's the 'already voted' error, update the UI state
            hasVoted.value = true; 
            // Optionally, still show an alert or a different message
            alert("You have already cast your vote in this session."); 
        } else {
             // Otherwise, show the generic error message
             alert(`Failed to submit vote: ${error.message || 'An unexpected error occurred.'}`); 
        }
    } finally {
        loading.value = false;
    }
  }
  </script>
  
  <style lang="scss" scoped>
  .voting-section {
    margin-top: 20px;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .token-button {
    margin-top: 1rem;
  }

  .status-message {
    padding: 10px 15px;
    margin-bottom: 15px;
    border-radius: var(--border-radius);
    text-align: center;
    font-weight: 500;
  }

  .warning {
    background-color: var(--warning-light);
    border: 1px solid var(--warning);
    color: var(--warning-dark);
  }

  .info {
    background-color: var(--info-light);
    border: 1px solid var(--info);
    color: var(--info-dark);
  }

  .success {
    background-color: var(--success-light);
    border: 1px solid var(--success);
    color: var(--success-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .icon.check {
    font-style: normal;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  fieldset {
    border: none;
    margin: 0;
    padding: 0;
  }
  
  fieldset[disabled] .option-item {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .voting-form {
    border: none;
  }

  /* Removed .custom-slider styles */

  // Removed :deep styles for old slider component
  </style>

  <style scoped>
  /* Removed styles for .custom-slider-vueform */
  </style>
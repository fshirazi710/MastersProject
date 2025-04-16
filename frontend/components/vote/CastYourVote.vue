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
  import { getKAndSecretShares, AESEncrypt } from '@/services/cryptography';
  import { ethersService } from '@/services/ethersService';
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

      // Construct localStorage key and retrieve public key
      const publicKeyStorageKey = `election_${props.voteId}_user_${userAddress}_blsPublicKey`;
      const publicKeyHex = localStorage.getItem(publicKeyStorageKey);

      if (!publicKeyHex) {
        console.error(`BLS Public Key not found in localStorage for key: ${publicKeyStorageKey}`);
        throw new Error("Your election-specific key pair was not found. Please ensure you have registered correctly for this vote.");
      }

      const response = await encryptedVoteApi.validatePublicKey({ public_key: publicKeyHex });
      return response.data.success
    } catch (error) {
      console.error("Failed to validate key pair:", error);
      alert('Error validating key pair. Please try again.');
    }
  }
  
  // Handle vote submission
  const handleEncryptedVoteSubmit = async () => {
    try {
      if (loading.value) return;
      loading.value = true;
      const response = await validateKeyPair();
      if (!response) {
        loading.value = false;
        return;
      }

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

      // Fetch holders to determine threshold if needed
      const secret_holders = await holderApi.getAllHolders(props.voteId);
      const data = secret_holders.data.data;
      const public_keys = data || []; // Ensure public_keys is an array
      const totalHolders = public_keys.length;
      
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
           console.error("Cannot calculate threshold: No secret holders found.");
           throw new Error("Cannot determine decryption threshold: No secret holders.");
      }
      const threshold = thresholdToUse; // Assign to variable used below
      // --------------------------------------

      // Pass the determined threshold to crypto function
      const [k, g1r, g2r, alpha] = await getKAndSecretShares(public_keys, threshold, totalHolders);
      g1rValue.value = g1r;

      // Encrypt the determined option string
      const ciphertext = await AESEncrypt(optionToEncrypt, k);
      
      // Use encryptedVoteApi.submitEncryptedVote
      // Rename voteResponse -> submitResponse for clarity
      const submitResponse = await encryptedVoteApi.submitEncryptedVote(props.voteId, { // Assuming voteId prop is actually voteSessionId
        // Backend might expect voter public key here, ensure it's correct.
        // Currently using public_keys[0] as placeholder.
        voter: public_keys[0], // Placeholder - Needs Verification
        public_keys: public_keys,
        ciphertext: ciphertext,
        g1r: g1r,
        g2r: g2r,
        alpha: alpha,
        threshold: threshold
      });

      hasVoted.value = true;
      alert(submitResponse.data.message || 'Vote submitted successfully!');

    } catch (error) {
      console.error('Failed to submit vote:', error.response?.data?.detail || error.message || error);
      alert('Failed to submit vote: ' + (error.response?.data?.detail || error.message));
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
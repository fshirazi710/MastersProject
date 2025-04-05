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
        <form v-else-if="status === 'active' && !hasVoted" @submit.prevent="handleVoteSubmit" class="voting-form">
          
          <!-- Slider Input (Conditional) -->
          <fieldset v-if="displayHint === 'slider' && sliderConfig">
              <legend class="form-label">Select Value: {{ selectedSliderValue !== null ? selectedSliderValue : '-' }}</legend>
              <input 
                type="range"
                :min="sliderConfig.min"
                :max="sliderConfig.max"
                :step="sliderConfig.step"
                v-model.number="selectedSliderValue"
                class="slider-input"
                required
              />
              <div class="slider-labels">
                <span>{{ sliderConfig.min }}</span>
                <span>{{ sliderConfig.max }}</span>
              </div>
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
  import { holderApi, voteApi } from '@/services/api'
  import { getPublicKeyFromPrivate, getKAndSecretShares, AESEncrypt } from '@/services/cryptography';
  import Cookies from 'js-cookie';

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
  
  // Initialize slider value if applicable
  onMounted(() => {
      if (props.displayHint === 'slider' && props.sliderConfig) {
          // Set initial slider value to min, or middle, or null?
          // Setting to min seems reasonable
          selectedSliderValue.value = props.sliderConfig.min;
      }
  });
  
  // Method to validate the key pair
  const validateKeyPair = async () => {
    try {
      // Get the vote-specific private key cookie
      const privateKeyCookie = `vote_${props.voteId}_privateKey`;
      const privateKeyHex = Cookies.get(privateKeyCookie);

      if (!privateKeyHex) {
        throw new Error("No private key found for this vote. Please register first.");
      }

      const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex)

      const response = await voteApi.validatePublicKey({ public_key: publicKeyHex });
      return response.data.success
    } catch (error) {
      console.error("Failed to validate key pair:", error);
      alert('Error validating key pair. Please try again.');
    }
  }
  
  // Handle vote submission
  const handleVoteSubmit = async () => {
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
      if (props.displayHint === 'slider' && selectedSliderValue.value !== null) {
          // Find the closest valid option string in props.options
          const targetValue = selectedSliderValue.value;
          let closestOption = null;
          let minDiff = Infinity;

          for (const optionStr of props.options) {
              const optionNum = Number(optionStr);
              if (!isNaN(optionNum)) {
                  const diff = Math.abs(optionNum - targetValue);
                  // Prioritize exact match or closest match
                  if (diff < minDiff || (diff === minDiff && optionNum === targetValue)) {
                      minDiff = diff;
                      closestOption = optionStr;
                  }
              }
          }
          if (closestOption === null) {
              // Fallback if options array is unexpectedly invalid
              console.error("Could not find a valid numeric option match for slider value.", props.options);
              throw new Error("Internal error finding option for slider value.");
          }
          optionToEncrypt = closestOption;
          console.log(`Slider value: ${targetValue}, Encrypting option: "${optionToEncrypt}"`); // Debug log
      } else {
          optionToEncrypt = selectedOption.value;
      }

      if (!optionToEncrypt) {
          throw new Error("No option selected or determined for voting.");
      }
      // --- End option determination --- 

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
          thresholdToUse = Math.max(3, Math.ceil(totalHolders / 3));
          console.log(`Calculating new threshold: totalHolders=${totalHolders}, threshold=${thresholdToUse}`);
      } else {
           // Should not happen if holders are required, but handle defensively
           console.error("Cannot calculate threshold: No secret holders found.");
           throw new Error("Cannot determine decryption threshold: No secret holders.");
      }
      const threshold = thresholdToUse; // Assign to variable used below
      // --------------------------------------

      const privateKeyCookie = `vote_${props.voteId}_privateKey`;
      const privateKeyHex = Cookies.get(privateKeyCookie);
      const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex);

      // Pass the determined threshold to crypto function
      const [k, g1r, g2r, alpha] = await getKAndSecretShares(public_keys, threshold, totalHolders);
      g1rValue.value = g1r;

      // Encrypt the determined option string
      const ciphertext = await AESEncrypt(optionToEncrypt, k);
      
      const voteResponse = await voteApi.submitVote(props.voteId, {
        election_id: props.voteId,
        voter: publicKeyHex,
        public_keys: public_keys,
        ciphertext: ciphertext,
        g1r: g1r,
        g2r: g2r,
        alpha: alpha,
        threshold: threshold
      });

      hasVoted.value = true;
      alert(voteResponse.data.message || 'Vote submitted successfully!');

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

  /* Slider specific styles */
  .slider-input {
    width: 100%;
    margin-top: 10px;
    cursor: pointer;
  }
  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    color: var(--text-secondary);
    padding: 0 5px; /* Add slight padding */
  }
  .form-label { /* Style for the legend acting as label */
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
  }
  </style>
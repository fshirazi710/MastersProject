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
  // Removed API imports
  // import { holderApi, encryptedVoteApi } from '@/services/api'
  import { 
      getKAndSecretShares, 
      AESEncrypt, 
      importBigIntAsCryptoKey, 
      // Need functions for nullifier/proof generation (add later)
      // generateNullifier, generateProof 
  } from '~/services/utils/cryptographyUtils';
  // Import required services
  import { ethersBaseService, registryService, voteSessionService } from '~/services/ethersService.js'; 
  // Removed config import
  // import { config } from '@/config'; 
  import CustomSlider from '@/components/shared/CustomSlider.vue'

  const props = defineProps({
    voteId: {
      type: [String, Number], // Allow string or number
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
    existingThreshold: { // Keep receiving threshold from parent (fetched in [id].vue)
        type: Number,
        required: true,
        default: 0
    }
  })
  
  const loading = ref(false);
  const selectedOption = ref(null)
  const selectedSliderValue = ref(null)
  // Removed g1rValue - not needed here
  // const g1rValue = ref(null)
  const hasVoted = ref(false); // Keep local state for UI feedback after voting
  const error = ref(null); // Add error ref for user feedback
  
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
      // TODO: Check if user has already voted using a read call?
      // e.g., call voteSessionService.hasVoted(props.voteId, userAddress)
      // and set hasVoted.value accordingly.
  });
  
  // Removed validateKeyPair - validation happens implicitly if registration key exists
  
  // --- Refactored handleEncryptedVoteSubmit ---
  const handleEncryptedVoteSubmit = async () => {
    error.value = null; // Clear previous errors
    if (loading.value) return;
    loading.value = true;

    try {
      const userAddress = ethersBaseService.getAccount();
      if (!userAddress) {
          throw new Error("Wallet not connected.");
      }
      
      // Convert voteId prop to number
      const sessionId = Number(props.voteId);
      if (isNaN(sessionId)) {
          throw new Error("Invalid voteId prop.");
      }

      // Determine the actual option string to encrypt
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

      // --- Fetch Participant BLS Keys using registryService --- 
      console.log(`Fetching participant BLS keys for session ${sessionId}...`);
      const participantBlsKeys = await registryService.getAllParticipantKeys(sessionId);
      console.log("Retrieved Participant BLS Keys:", participantBlsKeys);
      
      if (!participantBlsKeys || participantBlsKeys.length === 0) {
          throw new Error("Could not retrieve participant BLS keys from the registry contract.");
      }
      const public_keys = participantBlsKeys;
      const totalParticipants = public_keys.length;
      // ------------------------------------------------
      
      // --- Use existing threshold --- 
      const threshold = props.existingThreshold;
      if (threshold <= 0) {
          // Threshold should have been fetched by parent
          console.error("Invalid or missing threshold provided via props:", threshold);
          throw new Error("Cannot proceed without a valid decryption threshold.");
      }
      console.log(`Using threshold: ${threshold} (from props)`);
      // --------------------------------------

      // --- Threshold Encryption --- 
      // (This part remains largely the same, but doesn't need g1r/g2r/alphas returned here)
      console.log("Generating threshold encryption components...");
      const [k_bigint, , , ] = await getKAndSecretShares(public_keys, threshold, totalParticipants);
      console.log("Importing derived symmetric key k for AES...");
      const aesCryptoKey = await importBigIntAsCryptoKey(k_bigint);
      console.log("Symmetric key k imported successfully.");

      const voteString = JSON.stringify({ vote: optionToEncrypt });
      const encryptedVoteHex = await AESEncrypt(voteString, aesCryptoKey);
      console.log("Vote encrypted successfully.");
      // -----------------------------------------------------------

      // --- Generate Nullifier --- (Placeholder)
      console.warn("Nullifier generation is required!");
      // const nullifierHash = await generateNullifier(sessionId, userPrivateKey); // Needs implementation
      const nullifierHash = ethersBaseService.hashMessage(`dummy_nullifier_${sessionId}_${userAddress}_${Date.now()}`); // TODO: REPLACE with real nullifier!
      console.log("Generated Placeholder Nullifier Hash:", nullifierHash);
      // ------------------------

      // --- Generate ZK Proof --- (Placeholder)
      console.warn("ZK Proof generation is required!");
      // const proofInputs = { ... }; // Inputs based on circuit
      // const zkProof = await generateProof(proofInputs); // Needs implementation & setup
      const zkProof = { // TODO: REPLACE with real proof!
          a: ['0x00', '0x00'],
          b: [['0x00', '0x00'], ['0x00', '0x00']],
          c: ['0x00', '0x00']
      };
      console.log("Using Placeholder ZK Proof:", zkProof);
      // -----------------------

      // --- Call voteSessionService.castVote --- 
      console.log(`Calling voteSessionService.castVote for session ${sessionId}...`);
      const txReceipt = await voteSessionService.castVote(
          sessionId,
          encryptedVoteHex, 
          nullifierHash, 
          zkProof
      );
      console.log("castVote transaction successful:", txReceipt);
      // ----------------------------------------

      // Update UI state on success
      hasVoted.value = true; 
      alert("Your encrypted vote has been successfully submitted to the blockchain!");

    } catch (error) {
        console.error("Error submitting vote:", error);
        error.value = `Failed to cast vote: ${error.message || 'An unexpected error occurred.'}`; // Set local error for display
        // Check for specific contract errors if needed (e.g., already voted based on nullifier)
        if (error.message && error.message.toLowerCase().includes('nullifier already used')) {
             hasVoted.value = true; // Update UI if contract indicates already voted
             error.value = "You have already cast your vote in this session.";
        }
        // alert(error.value); // Optionally show alert too
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
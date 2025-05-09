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
        <!-- Simplified message, parent controls registration flow -->
        You are not registered for this election.
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, watch } from 'vue'
  // Removed API imports
  // import { holderApi, encryptedVoteApi } from '@/services/api'
  // CRYPTO UTILS - To be updated for encryptVoteData
  // import { 
  //     getKAndSecretShares, 
  //     AESEncrypt, 
  //     importBigIntAsCryptoKey,
  // } from '~/services/utils/cryptographyUtils.js'; // OLD
  import { encryptVoteData } from '@/services/utils/voteCryptoUtils.js'; // NEW
  import { randomBytes } from '@/services/utils/aesUtils.js'; // NEW - For manual key generation
  // Import required services
  // import { ethersBaseService, registryService, voteSessionService } from '~/services/ethersService.js'; // OLD - REMOVE THIS LINE
  // Removed config import
  // import { config } from '@/config'; 
  import CustomSlider from '@/components/shared/CustomSlider.vue'
  // NEW SERVICE IMPORTS
  import { blockchainProviderService } from '@/services/blockchainProvider.js';
  import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
  import { voteSessionVotingService } from '@/services/contracts/voteSessionVotingService.js';
  import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js'; // For hasVoted check

  const props = defineProps({
    voteId: {
      type: [String, Number], // Allow string or number
      required: true
    },
    voteSessionAddress: { // ADDED/CONFIRMED PROP
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

  watch(() => props.isRegistered, (newValue, oldValue) => {
    console.log(`CastYourVote: props.isRegistered changed from ${oldValue} to ${newValue}. Current component status: ${props.status}, local hasVoted: ${hasVoted.value}`);
  });

  onMounted(async () => {
    if (props.displayHint === 'slider' && props.sliderConfig && sliderSteps.value.length > 0) {
        const initialValue = props.sliderConfig.min;
        if (sliderSteps.value.includes(initialValue)) {
            selectedSliderValue.value = initialValue;
        } else {
            selectedSliderValue.value = sliderSteps.value[0]; 
        }
    }
    // Check if user has already voted
    const currentUserAddress = blockchainProviderService.getAccount();
    if (currentUserAddress && props.voteSessionAddress) {
        try {
            console.log(`CastVote: Checking if ${currentUserAddress} has voted in session ${props.voteSessionAddress} using voteSessionViewService...`);
            const alreadyVoted = await voteSessionViewService.hasVoted(props.voteSessionAddress, currentUserAddress);
            hasVoted.value = alreadyVoted;
            console.log(`CastVote: User alreadyVoted status from service: ${alreadyVoted}`);
            if (alreadyVoted) {
                error.value = "You have already cast your vote in this session.";
            }
        } catch (err) {
            console.error("CastVote: Error checking if user has voted via service:", err);
            error.value = "Could not verify previous voting status. If you haven't voted, please try.";
            // Default to false to allow voting if check fails, error message will be shown.
            hasVoted.value = false; 
        }
    } else {
        console.log("CastVote: Wallet not connected or voteSessionAddress missing, cannot check voted status.");
        // Ensure hasVoted is false if we can't check, to show the form if user connects later
        hasVoted.value = false;
    }
  });
  
  // Removed validateKeyPair - validation happens implicitly if registration key exists
  
  // --- Refactored handleEncryptedVoteSubmit ---
  const handleEncryptedVoteSubmit = async () => {
    error.value = null; 
    if (loading.value) return;
    loading.value = true;

    try {
      // const userAddress = ethersBaseService.getAccount(); // OLD
      const userAddress = blockchainProviderService.getAccount(); // NEW
      if (!userAddress) {
          throw new Error("Wallet not connected.");
      }
      
      const sessionId = Number(props.voteId);
      if (isNaN(sessionId)) {
          throw new Error("Invalid voteId prop.");
      }

      let optionToEncrypt = null;
      if (props.displayHint === 'slider') {
          if (selectedSliderValue.value === null) {
              throw new Error("No slider value selected.");
          }
          optionToEncrypt = String(selectedSliderValue.value);
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

      // --- Fetch Active Holder BLS Keys --- 
      console.log(`Fetching active holder BLS keys for session ${sessionId}...`);
      // const participantBlsKeys = await registryService.getAllParticipantKeys(sessionId); // OLD
      const holderInfo = await registryParticipantService.getHolderBlsKeys(sessionId); // NEW
      const activeHolderBlsPublicKeysHex = holderInfo ? holderInfo.blsKeysHex : []; // NEW
      console.log("Retrieved Active Holder BLS Keys:", activeHolderBlsPublicKeysHex);
      
      if (!activeHolderBlsPublicKeysHex || activeHolderBlsPublicKeysHex.length === 0) {
          throw new Error("Could not retrieve active holder BLS public keys. Cannot encrypt vote.");
      }
      // const public_keys = participantBlsKeys; // OLD
      // const totalParticipants = public_keys.length; // OLD - not directly needed for encryptVoteData
      // ------------------------------------------------
      
      // --- Get Threshold --- 
      const voteEncryptionThreshold = props.existingThreshold;
      if (voteEncryptionThreshold <= 0) {
          console.error("Invalid or missing threshold provided via props:", voteEncryptionThreshold);
          throw new Error("Cannot proceed without a valid decryption threshold.");
      }
      console.log(`Using voteEncryptionThreshold: ${voteEncryptionThreshold}`);
      // --------------------------------------

      // --- Generate Ephemeral AES Key for this vote --- 
      console.log("Generating ephemeral AES key for vote encryption...");
      // const aesKey = await generateAesKey(); // OLD - incorrect assumption
      const keyMaterial = randomBytes(32); // Use 32 bytes for AES-256
      const aesKey = await crypto.subtle.importKey(
          "raw",
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true, // extractable
          ["encrypt", "decrypt"]
      );
      if (!aesKey) {
        throw new Error("Failed to generate AES key for vote encryption.");
      }
      console.log("Ephemeral AES key generated.");
      // --------------------------------------------------

      // --- Encrypt Vote Data using voteCryptoUtils.encryptVoteData --- 
      console.log(`Encrypting vote: '${optionToEncrypt}'`);
      const { 
        ciphertext, 
        g1r, 
        g2r, 
        alpha, // This should be an array of Uint8Array from the public keys
        threshold // This is the voteEncryptionThreshold passed in
      } = await encryptVoteData(optionToEncrypt, aesKey, activeHolderBlsPublicKeysHex, voteEncryptionThreshold);
      console.log("Vote encrypted successfully by voteCryptoUtils.encryptVoteData.");
      // -----------------------------------------------------------

      // --- Generate Nullifier --- (Placeholder - remains the same for this refactor pass)
      console.warn("Nullifier generation is required!");
      const nullifierHash = blockchainProviderService.hashMessage(`dummy_nullifier_${sessionId}_${userAddress}_${Date.now()}`); 
      console.log("Generated Placeholder Nullifier Hash:", nullifierHash);
      // ------------------------

      // --- Generate ZK Proof --- (Placeholder - remains the same)
      console.warn("ZK Proof generation is required!");
      const zkProof = { 
          a: ['0x00', '0x00'],
          b: [['0x00', '0x00'], ['0x00', '0x00']],
          c: ['0x00', '0x00']
      };
      console.log("Using Placeholder ZK Proof:", zkProof);
      // -----------------------

      // --- Call voteSessionVotingService.castEncryptedVote --- 
      console.log(`Calling voteSessionVotingService.castEncryptedVote for session address ${props.voteSessionAddress}...`);
      // const txReceipt = await voteSessionService.castVote( // OLD
      //     sessionId,
      //     encryptedVoteHex, 
      //     nullifierHash, 
      //     zkProof
      // );
      const txReceipt = await voteSessionVotingService.castEncryptedVote( // NEW
          props.voteSessionAddress,
          ciphertext, // From encryptVoteData
          g1r,        // From encryptVoteData
          g2r,        // From encryptVoteData
          alpha,      // From encryptVoteData (Uint8Array[])
          threshold   // From encryptVoteData (number)
      );
      console.log("castEncryptedVote transaction successful:", txReceipt);
      // ----------------------------------------

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
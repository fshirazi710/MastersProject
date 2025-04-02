<template>
    <div class="voting-section">
      <h2>Cast Your Vote</h2>
  
      <div>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
          <i class="lock-icon">🔒</i>
          <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released.Be sure to come back later to check the results of the vote and see if you're one of the lucky winners of the vouchers!</p>
        </div>

        <!-- Message shown if voting hasn't started -->
        <div v-if="status === 'join'" class="status-message warning">
          Voting has not started yet. Please come back when the election is active.
        </div>

        <!-- Voting form with radio options -->
        <form @submit.prevent="handleVote" class="voting-form">
          <fieldset :disabled="status === 'join'">
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
                  :disabled="status === 'join'"
                />
                <div class="option-content">
                  {{ option }}
                </div>
              </label>
            </div>
          </fieldset>
          <button 
            @click="handleVoteSubmit" 
            type="submit" 
            class="btn primary" 
            :disabled="loading || !selectedOption || status === 'join'"
          >
          {{ loading ? 'Submitting Vote...' : (status === 'join' ? 'Voting Not Active' : 'Submit Encrypted Vote') }}
        </button>
        </form>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
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
    }
  })
  
  const loading = ref(false);
  const selectedOption = ref(null)
  const g1rValue = ref(null)
  
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
      if (!response) return;

      const secret_holders = await holderApi.getAllHolders(props.voteId);
      const threshold = 3;
      const data = secret_holders.data.data;
      const public_keys = [];

      data.forEach(hexString => {
        // Push the hex string directly, don't convert back to Uint8Array
        public_keys.push(hexString);
      });

      const total = public_keys.length;

      // Get the vote-specific private key cookie
      const privateKeyCookie = `vote_${props.voteId}_privateKey`;
      const privateKeyHex = Cookies.get(privateKeyCookie);
      const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex);

      const [k, g1r, g2r, alpha] = await getKAndSecretShares(public_keys, threshold, total);
      g1rValue.value = g1r;

      const ciphertext = await AESEncrypt(selectedOption.value, k);
      
      // Submit the vote and directly read the response
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

      alert(voteResponse.data.message || 'Vote submitted successfully!');

    } catch (error) {
      // Log the error to the console in addition to alerting
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

  fieldset[disabled] .option-item {
    opacity: 0.6;
    cursor: not-allowed;
  }
  </style>
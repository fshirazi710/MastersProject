<template>
    <div class="voting-section">
      <h2>Cast Your Vote</h2>
  
      <div>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
          <i class="lock-icon">🔒</i>
          <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released.Be sure to come back later to check the results of the vote and see if you’re one of the lucky winners of the vouchers!</p>
        </div>
        <!-- Voting form with radio options -->
        <form @submit.prevent="handleVote" class="voting-form">
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
          <button @click="handleVoteSubmit" type="submit" class="btn primary" :disabled="!selectedOption">
            Submit Encrypted Vote
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
    }
  })
  
  const selectedOption = ref(null)
  const g1rValue = ref(null)
  
  // Method to validate the key pair
  const validateKeyPair = async () => {
    try {
      const privateKeyHex = Cookies.get("privateKey");

      if (!privateKeyHex) {
        throw new Error("No private key found. Please register first.");
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
      const response = await validateKeyPair();
      if (!response) return;

      const secret_holders = await holderApi.getAllHolders(props.voteId);
      const threshold = 3;
      const data = secret_holders.data.data;
      const public_keys = [];

      data.forEach(hexString => {
        const cleanedHexString = hexString.slice(2);
        const public_key = new Uint8Array(cleanedHexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        public_keys.push(public_key);
      });

      const total = public_keys.length;
      const privateKeyHex = Cookies.get("privateKey");
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

    } catch (err) {
      if (err.response?.status === 400) {
        alert('You have already voted.');
      } else {
        alert('Failed to submit vote: ' + (err.response?.data?.detail || err.message));
      }
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
  </style>
<template>
    <div class="voting-section">
      <h2>Register To Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>The key pair generated here is essential for casting your vote. Your key is stored in your browser, return here to cast your vote.</p>
      </div>
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>You can choose to be a secret holder, which means you are a part of making sure your vote remains secure.
          If you choose to become a secret holder, you will need to release your private key at the specified time.
        </p>
      </div>
    
      <!-- Voting form with radio options -->
      <form @submit.prevent="generateKeyPair" class="voting-form">
        <h3>Would you like to be a secret holder?</h3>
        <div class="options-list">
          <label class="option-item">
            <input
              type="radio"
              v-model="isSecretHolder"
              value="yes"
              name="secret-holder-option"
              required
            >
            <div class="option-content">
              Yes
            </div>
          </label>
          <label class="option-item">
            <input
              type="radio"
              v-model="isSecretHolder"
              value="no"
              name="secret-holder-option"
              required
            >
            <div class="option-content">
              No
            </div>
          </label>
        </div>
        <button class="btn primary">
          Generate Key Pair
        </button>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { voteApi, holderApi } from '@/services/api'
  import { generateBLSKeyPair } from "../../services/cryptography";
  import Cookies from "js-cookie";
  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    }
  })
  
  const isSecretHolder = ref('yes')
  const pk = ref(null);

  const generateKeyPair = async () => {
    const { sk, pk: publicKey } = generateBLSKeyPair();

    // Store the private key in a cookie for 1 day
    Cookies.set("privateKey", sk.toString(16), { expires: 5, secure: true, sameSite: "Strict" });

    // Update the reactive pk variable to trigger UI update
    pk.value = publicKey;

    storePublicKey()
  };

  // Method to generate voting token
  const storePublicKey = async () => {
    try {
      const response = await voteApi.storePublicKey(props.voteId, {
        public_key: pk.value,
        is_secret_holder: isSecretHolder.value === 'yes' ? true : false
      });

      if (isSecretHolder.value === 'yes') {
        joinAsSecretHolder(props.voteId, pk.value)
      }
      else {
        console.log("ERROR");
      }

      alert("TEMPORARY: Success");
    } catch (err) {
      console.error('Failed to store public key:', err);
      error.value = err.message || 'Failed to store public key. Please try again.';
    }
  }

  const joinAsSecretHolder = async (vote_id, public_key) => {
    try {
      const response = await holderApi.joinAsHolder(vote_id, public_key);
    } catch (err) {
      console.error('Failed to join as secret holder:', err);
      error.value = err.message || 'Failed to join as secret holder. Please try again.';
    }
  }
  </script>
  
  <style lang="scss" scoped>
  .alert-box {
    margin-top: 10px;
    padding: 10px;
    background-color: #f0f8ff;
    border: 1px solid #007bff;
    border-radius: 5px;
    color: #333;
    font-weight: bold;
    text-align: center;
  }
  </style>
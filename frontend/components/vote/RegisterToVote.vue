<template>
    <div class="voting-section">
      <h2>Register To Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">📝</i>
        <p>The key pair generated here is essential for casting your vote. Your key is stored in your browser, return here to cast your vote.</p>
      </div>
      <div class="encryption-notice">
        <i class="lock-icon">📝</i>
        <p>You can choose to be a secret holder, which means you are a part of making sure votes remain secure.
          If you choose to become a secret holder, you will need to release your private key at the end of the vote: {{props.endDate}}.
          Note: You will only have 15 minutes to release your secrets.
        </p>
      </div>
    
      <!-- Voting form with radio options -->
      <form class="voting-form">
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
        <button type="button" class="btn primary" @click="generateKeyPair" :disabled="isSecretHolder === 'no'">
          Register To Vote
        </button>
        <button type="button" class="btn primary" @click="unjoinAsSecretHolder" :disabled="isSecretHolder === 'yes'">
          Unregister To Vote
        </button>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { voteApi, holderApi } from '@/services/api'
  import { generateBLSKeyPair, getPublicKeyFromPrivate } from "../../services/cryptography";
  import Cookies from "js-cookie";
  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    },

    endDate: {
      type: String,
      required: true
    }
  })
  
  const isSecretHolder = ref('yes')
  const pk = ref(null);

  // used to check if the user has already generated a keypair for this page
  const checkExistingPrivateKey = () => {
    const cookieLabel = `privateKey_${props.voteId}`;
    const existingKey = Cookies.get(cookieLabel);

    if (existingKey) {
        // Convert stored private key back to a usable format
        const skRestored = BigInt("0x" + existingKey);  
        pk.value = getPublicKeyFromPrivate(skRestored);
    }
  };

  onMounted(checkExistingPrivateKey);

  const generateKeyPair = async () => {
    if (pk.value != null) {
      alert("You have already signed up for this vote");
      throw new Error("You have already signed up for this vote");
    }
    else {
      const { sk, pk: publicKey } = generateBLSKeyPair();

      // Store the private key in a cookie for 1 day
      Cookies.set(`privateKey_${props.voteId}`, sk.toString(16), { expires: 5, secure: true, sameSite: "Strict" });

      // Update the reactive pk variable to trigger UI update
      pk.value = publicKey;

      storePublicKey()
    }
  };

  // Method to generate voting token
  const storePublicKey = async () => {
    try {
      const response = await voteApi.storePublicKey(props.voteId, {
        public_key: pk.value,
        is_secret_holder: isSecretHolder.value === 'yes' ? true : false
      });

      if (isSecretHolder.value === 'yes') {
        await joinAsSecretHolder(props.voteId, pk.value)
        alert("Successfully registered as secret holder");
      } else if (isSecretHolder.value === 'no') {
        alert("Successfully registered as voter");
      } else {
        alert("Failed to register user. Please try again.")
      }
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

  const unjoinAsSecretHolder = async () => {
    try {
      if (!pk.value) {
            alert("Error: Your public key could not be found. Please try again.");
            return;
      }

      const response = await holderApi.unjoinAsHolder(props.voteId, pk.value);
      
      // Now remove the private key cookie
      const cookieLabel = `privateKey_${props.voteId}`;
      Cookies.remove(cookieLabel);

      // Update the UI to reflect the change (you can also reload the page if needed)
      pk.value = null;  // Clear the stored public key as well (if any)

      alert("You have successfully unregistered as a secret holder.");
    } catch (err) {
      console.error('Failed to unregister as a secret holder:', err);
      alert("Failed to unregister. Please try again.");
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
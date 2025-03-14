<template>
    <div class="voting-section">
      <h2>Register To Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>This voting token is essential for casting your vote. If you lose it, you will not be able to participate in the voting process.</p>
      </div>
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>You can choose to be a secret holder, which means you are a part of making sure your vote remains secure.
          If you choose to become a secret holder, you will need to release your specific key at the specified time.
        </p>
      </div>
    
      <!-- Voting form with radio options -->
      <form @submit.prevent="generateToken" class="voting-form">
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
        <div v-if="isSecretHolder === 'yes'" class="alert-box">
          <strong>Reward Pool: {{ rewardPool }} ETH</strong>
          <p></p>
          <strong>Required Deposit: {{ requiredDeposit }} ETH</strong>
        </div>
        <button @click="generateKeyPair()" class="btn primary">
          Register To Vote
        </button>
        <!-- New styled alert box for votingToken -->
        <div v-if="pk" class="alert-box">
          <strong>The Key Pair Needed To Vote Has Been Stored. Return to this page to Cast Your Vote Later</strong>
        </div>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import axios from 'axios'
  import { generateBLSKeyPair } from "../../services/blsUtils";
  import Cookies from "js-cookie";

  const pk = ref(null); // Make pk reactive

  const generateKeyPair = async () => {
    const { sk, pk: publicKey } = generateBLSKeyPair();
    
    console.log("Private Key:", sk.toString(16));
    console.log("Public Key:", publicKey.toHex());

    // Store the private key in a cookie for 1 day
    Cookies.set("privateKey", sk.toString(16), { expires: 1, secure: true, sameSite: "Strict" });
    storePublicKey()

    // Update the reactive pk variable to trigger UI update
    pk.value = publicKey.toHex();
  };

  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    }
  })
  
  const isSecretHolder = ref('yes')
  const votingToken = ref('')
  const rewardPool = ref(0.5) // Example value, replace with actual logic to fetch this
  const requiredDeposit = ref(0.1) // Example value, replace with actual logic to fetch this
  
  // Method to generate voting token
  const storePublicKey = async () => {
    try {
        const response = await axios.post(
            `http://127.0.0.1:8000/api/votes/store_public_key/${props.voteId}`, // voteId should be part of the URL
            {
                public_key: String(pk),  // Send only public_key and is_secret_holder in the body
                is_secret_holder: Boolean(isSecretHolder),
            }
        );
        votingToken.value = response.data.token;
    } catch (error) {
        console.error("Failed to store public key:", error);
        votingToken.value = "Error storing public key";
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
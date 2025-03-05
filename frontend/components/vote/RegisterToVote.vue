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
        <button @click="generateToken" class="btn primary">
          Generate Unique Voting Token
        </button>
        <!-- New styled alert box for votingToken -->
        <div v-if="votingToken" class="alert-box">
          <strong>Voting Token:</strong> {{ votingToken }}
        </div>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import axios from 'axios'
  
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
  const generateToken = async () => {
    try {
      const response = await axios.post(`http://127.0.0.1:8000/generate-token/${props.voteId}`);
      votingToken.value = response.data.token;
    } catch (error) {
      console.error("Failed to generate voting token:", error);
      votingToken.value = "Error generating token";
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
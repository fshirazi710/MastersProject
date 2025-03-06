<template>
    <div class="voting-section">
      <h2>Cast Your Vote</h2>
      <!-- Voting token input -->
      <form v-if="!isTokenValid" @submit.prevent="validateVotingToken" class="token-form">
        <div class="encryption-notice">
          <i class="lock-icon">🔒</i>
          <p>Once you enter a valid token, you will be allowed to cast your vote.</p>
        </div>
        <div class="form-group">
          <label for="voting-token">Enter Your Voting Token</label>
          <input 
            type="text" 
            id="voting-token" 
            v-model="votingTokenInput" 
            required 
            class="form-input"
          >
        </div>
        <button type="submit" class="btn primary token-button">Validate Token</button>
      </form>
  
      <div v-if="isTokenValid">
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
          <i class="lock-icon">🔒</i>
          <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released.</p>
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
          <button type="submit" class="btn primary" :disabled="!selectedOption">
            Submit Encrypted Vote
          </button>
        </form>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import axios from 'axios'
  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    },
    options: {
      type: Array,
      required: true
    }
  })
  
  const votingTokenInput = ref('')
  const isTokenValid = ref(false)
  const selectedOption = ref(null)
  
  // Method to validate the voting token
  const validateVotingToken = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/validate-token`, {
        params: { token: votingTokenInput.value }
      });
      if (response.data.valid) {
        isTokenValid.value = true;
      } else {
        isTokenValid.value = false;
      }
    } catch (error) {
      console.error("Failed to validate voting token:", error);
      alert('Error validating token. Please try again.');
    }
  }
  
  // Handle vote submission
  const handleVote = () => {
    // TODO: Add validation
    // TODO: Add API integration
    // TODO: Add encryption
    // TODO: Add success/error handling
    console.log('Voted for option:', selectedOption.value)
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
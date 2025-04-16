<template>
  <div class="create-vote">
    <h2>Create Vote Session</h2>

    <!-- Wallet connection status -->
    <div class="wallet-status" v-if="!walletConnected">
      <div class="alert alert-warning">
        <p>Please connect your wallet to create a vote</p>
        <button @click="connectWallet" class="btn primary">Connect Wallet</button>
      </div>
    </div>

    <div v-else class="wallet-info">
      <p>Connected Wallet: {{ walletAddress }}</p>
      <p>Balance: {{ walletBalance }} ETH</p>
    </div>

    <!-- Error message -->
    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <!-- Main form container with submit handler -->
    <form @submit.prevent="handleSubmit" class="form-container">
      <!-- Vote title input -->
      <div class="form-group">
        <label for="title">Vote Title</label>
        <input 
          type="text" 
          id="title" 
          v-model="voteSessionData.title" 
          required 
          minlength="3" 
          maxlength="100"
          class="form-input"
        >
      </div>

      <!-- Vote description textarea -->
      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="voteSessionData.description" 
          required 
          minlength="10"
          maxlength="1000"
          class="form-input"
        ></textarea>
        <p class="helper-text">Minimum 10 characters</p>
      </div>

      <!-- Date selection row with two inputs -->
      <div class="form-row">
        <!-- Start date input -->
        <div class="form-group">
          <label for="startDate">Start Date</label>
          <input 
            type="datetime-local" 
            id="startDate" 
            v-model="voteSessionData.start_date" 
            required 
            class="form-input"
          >
        </div>

        <!-- End date input -->
        <div class="form-group">
          <label for="endDate">End Date</label>
          <input 
            type="datetime-local" 
            id="endDate" 
            v-model="voteSessionData.end_date" 
            required 
            class="form-input"
          >
        </div>
      </div>

      <!-- Secret holder configuration section -->
      <div class="form-group">
        <h3>Secret Holder Requirements</h3>
        <div class="info-notice">
          <i class="info-icon">ℹ️</i>
          <p>Higher deposits may reduce participation but increase holder reliability</p>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="rewardPool">Total Reward Pool (ETH)</label>
            <input 
              type="number"
              id="rewardPool"
              v-model="voteSessionData.reward_pool"
              required
              min="0.001"
              step="0.001"
              class="form-input"
            >
            <p class="helper-text">Total amount to reward secret holders</p>
          </div>

          <div class="form-group">
            <label for="requiredDeposit">Required Holder Deposit (ETH)</label>
            <input 
              type="number"
              id="requiredDeposit"
              v-model="voteSessionData.required_deposit"
              required
              min="0.001"
              step="0.001"
              class="form-input"
            >
            <p class="helper-text">Security deposit required from each holder</p>
          </div>
        </div>
      </div>

      <!-- Question Type Selection -->
      <div class="form-group">
        <h3>Question Type</h3>
        <div class="radio-group">
          <label>
            <input type="radio" v-model="questionType" value="options" name="questionType">
            Standard Options
          </label>
          <label>
            <input type="radio" v-model="questionType" value="slider" name="questionType">
            Numerical Slider
          </label>
        </div>
      </div>

      <!-- Dynamic voting options section (Conditional) -->
      <template v-if="questionType === 'options'">
        <div class="form-group">
          <label>Options</label>
          <p class="helper-text">Minimum 2 options required</p>
          <!-- List of voting options with remove buttons -->
          <div v-for="(option, index) in voteSessionData.options" :key="index" class="option-row">
            <input 
              type="text" 
              v-model="voteSessionData.options[index]" 
              :placeholder="'Option ' + (index + 1)"
              class="form-input"
              required
            >
            <!-- Remove button (hidden for first two options) -->
            <button 
              type="button" 
              @click="removeOption(index)" 
              class="btn danger"
              v-if="voteSessionData.options.length > 2"
            >
              Remove
            </button>
          </div>
          <!-- Add new option button -->
          <button 
            type="button" 
            @click="addOption" 
            class="btn secondary"
          >
            Add Option
          </button>
        </div>
      </template>

      <!-- Slider Configuration Section (Conditional) -->
      <template v-if="questionType === 'slider'">
         <div class="form-group">
            <h3>Slider Configuration</h3>
             <div class="form-row">
              <div class="form-group">
                <label for="sliderMin">Minimum Value</label>
                <input 
                  type="number"
                  id="sliderMin"
                  v-model.number="sliderConfig.min"
                  required
                  class="form-input"
                >
              </div>
              <div class="form-group">
                <label for="sliderMax">Maximum Value</label>
                <input 
                  type="number"
                  id="sliderMax"
                  v-model.number="sliderConfig.max"
                  required
                  class="form-input"
                >
              </div>
              <div class="form-group">
                <label for="sliderStep">Step Increment</label>
                <input 
                  type="number"
                  id="sliderStep"
                  v-model.number="sliderConfig.step"
                  required
                  min="1" 
                  class="form-input"
                >
              </div>
            </div>
         </div>
      </template>

      <!-- Form submit button -->
      <button type="submit" class="btn primary" :disabled="loading || !walletConnected">
        {{ loading ? 'Creating Vote Session...' : 'Create Vote Session' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { voteSessionApi } from '@/services/api'
import { ethersService } from '~/services/ethersService'

const router = useRouter();
const loading = ref(false);
const error = ref(null);
const walletConnected = ref(false);
const walletAddress = ref('');
const walletBalance = ref(0);

// New state for question type and slider config
const questionType = ref('options'); // 'options' or 'slider'
const sliderConfig = ref({
  min: 0,
  max: 100,
  step: 1,
});

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

// Initialize form data with reactive reference
const voteSessionData = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  options: ['', ''], // Will be overwritten if slider type
  reward_pool: 0.003,
  required_deposit: 0.001,
})

// Initialize Web3 and connect wallet
const connectWallet = async () => {
  try {
    await ethersService.init();
    walletConnected.value = true;
    walletAddress.value = await ethersService.getAccount();
    walletBalance.value = await ethersService.getBalance();
  } catch (err) {
    console.error('Failed to connect wallet:', err);
    error.value = 'Failed to connect wallet. Please make sure MetaMask is installed and unlocked.';
  }
}

// Add a new empty option to the options array
const addOption = () => {
  voteSessionData.value.options.push('')
}

// Remove an option at the specified index
const removeOption = (index) => {
  voteSessionData.value.options.splice(index, 1)
}

// Validation logic (computed property example)
const isFormValid = computed(() => {
  // Basic checks (title, description, dates)
  if (!voteSessionData.value.title || voteSessionData.value.title.length < 3 || voteSessionData.value.title.length > 100) return false;
  if (!voteSessionData.value.description || voteSessionData.value.description.length < 10 || voteSessionData.value.description.length > 1000) return false;
  if (!voteSessionData.value.start_date || !voteSessionData.value.end_date) return false;
  // TODO: Add better date validation (end > start)
  
  // Options validation
  if (questionType.value === 'options') {
    if (voteSessionData.value.options.length < 2) return false;
    if (voteSessionData.value.options.some(opt => !opt.trim())) return false; // Ensure no empty options
  }

  // Slider validation
  if (questionType.value === 'slider') {
    if (sliderConfig.value.min === null || sliderConfig.value.max === null || sliderConfig.value.step === null) return false;
    if (sliderConfig.value.min >= sliderConfig.value.max) return false;
    if (sliderConfig.value.step <= 0) return false;
    // Check generated option count (example limit: 200)
    const numOptions = Math.floor((sliderConfig.value.max - sliderConfig.value.min) / sliderConfig.value.step) + 1;
    if (numOptions > 200) { 
        // error.value = "Slider range/step generates too many options (>200). Please adjust."; // Provide feedback
        return false; // Or handle differently
    }
  }
  
  // Check ETH values
  if (voteSessionData.value.reward_pool < 0.001 || voteSessionData.value.required_deposit < 0.001) return false;

  return true; // If all checks pass
});

const handleSubmit = async () => {
  if (loading.value || !isFormValid.value) { 
      if (!isFormValid.value) {
          error.value = "Please fill out all fields correctly. Ensure Min < Max, Step > 0, and slider settings don't generate excessive options (>200)." 
      }
      return;
  };
  
  loading.value = true;
  error.value = null;
  
  try {
    // Check if wallet is connected
    if (!walletConnected.value) {
      throw new Error('Please connect your wallet first');
    }

    // Check if user has enough balance
    if (Number(walletBalance.value) < Number(voteSessionData.value.reward_pool)) {
      throw new Error('Insufficient balance for reward pool');
    }

    // --- Generate options if slider type --- 
    let finalOptions = [];
    let payloadSliderConfig = null;
    let displayHint = null;

    if (questionType.value === 'slider') {
      displayHint = 'slider';
      payloadSliderConfig = {
        min: Number(sliderConfig.value.min),
        max: Number(sliderConfig.value.max),
        step: Number(sliderConfig.value.step),
      };
      
      // --- Generate options: Min, Max, and multiples of Step between Min and Max --- 
      const optionsSet = new Set(); // Use Set for unique values

      // Always include min and max (if valid range)
      if (payloadSliderConfig.max >= payloadSliderConfig.min) {
          optionsSet.add(payloadSliderConfig.min);
          optionsSet.add(payloadSliderConfig.max);
      }

      // Add multiples of step that fall BETWEEN min and max
      if (payloadSliderConfig.step > 0) { 
          for (let currentMultiple = payloadSliderConfig.step; 
               currentMultiple < payloadSliderConfig.max; // Strictly less than max
               currentMultiple += payloadSliderConfig.step)
          { 
              if (currentMultiple > payloadSliderConfig.min) { // Strictly greater than min
                  optionsSet.add(currentMultiple);
              }
          }
          // Handle negative multiples if range allows
          if (payloadSliderConfig.min < 0) {
              for (let currentMultiple = -payloadSliderConfig.step; 
                   currentMultiple > payloadSliderConfig.min; // Strictly greater than min
                   currentMultiple -= payloadSliderConfig.step)
              { 
                  if (currentMultiple < payloadSliderConfig.max) { // Strictly less than max
                     optionsSet.add(currentMultiple);
                  }
              }
          }
      }

      // Convert set to sorted array of strings
      finalOptions = Array.from(optionsSet)
                          .sort((a, b) => a - b)
                          .map(String);
      // --- End generation logic --- 

      // Validation checks (adjust if necessary for this logic)
      if (finalOptions.length < 2 && payloadSliderConfig.min < payloadSliderConfig.max) {
         throw new Error("Slider configuration must generate at least 2 unique options if Min != Max.");
      } else if (finalOptions.length === 0 && payloadSliderConfig.min <= payloadSliderConfig.max) {
           finalOptions = [String(payloadSliderConfig.min)]; 
           if (finalOptions[0] === undefined || finalOptions[0] === null || finalOptions[0] === 'NaN') { 
                 throw new Error("Slider configuration generated no valid options.");
           }
      } else if (finalOptions.length === 0) {
           throw new Error("Slider configuration generated no options (invalid range?).");
      }
      
    } else {
      finalOptions = voteSessionData.value.options.filter(opt => opt && opt.trim());
    }
    // --- End option generation ---

    // Convert to BST before sending
    const toBSTISOString = (date) => {
        if (!date) return null;
        try {
            // Assuming input is YYYY-MM-DDTHH:MM
            const localDate = new Date(date);
            // Format for display/confirmation in London time
            const bstStr = localDate.toLocaleString("en-GB", { timeZone: "Europe/London" }); 
            // Reconstruct ISO-like string for backend (might need adjustment based on backend expectation)
            const [day, month, year, hour, minute] = bstStr.match(/\d+/g);
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
        } catch(e) {
            console.error("Error formatting date:", e);
            return null; // Handle invalid date input
        }
    };

    // Format core data for the contract part of the backend request
    const coreVoteSessionData = {
      title: voteSessionData.value.title,
      description: voteSessionData.value.description,
      start_date: toBSTISOString(voteSessionData.value.start_date),
      end_date: toBSTISOString(voteSessionData.value.end_date),
      reward_pool: Number(voteSessionData.value.reward_pool),
      required_deposit: Number(voteSessionData.value.required_deposit),
      options: finalOptions, // Use the generated or original options
    };

    // Construct the full payload including metadata
    const fullPayload = {
        vote_session_data: coreVoteSessionData,
        displayHint: displayHint, // Will be 'slider' or null
        sliderConfig: payloadSliderConfig // Will contain config or null
    };
    
    // Validate formatted dates
    if (!coreVoteSessionData.start_date || !coreVoteSessionData.end_date) {
        throw new Error('Invalid start or end date format provided.');
    }

    console.log("Submitting Full Payload:", fullPayload); // Debug log

    // Call the backend API using voteSessionApi.createVoteSession
    const response = await voteSessionApi.createVoteSession(fullPayload);
    alert(response.data.message || 'Vote Session created successfully!');
    router.push('/all-vote-sessions');
  } catch (err) {
    console.error("Vote Session creation failed:", err);
    // More specific error handling
    if (err.response?.data?.detail) {
      error.value = `Error: ${err.response.data.detail}`;
    } else if (err instanceof Error) {
      error.value = err.message;
    } else {
      error.value = 'An unexpected error occurred during vote session creation.';
    }
  } finally {
    loading.value = false;
  }
}

// Connect wallet on mount
onMounted(() => {
  // Re-enable automatic connection
  connectWallet();
});

</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/create-vote';

.wallet-status {
  margin-bottom: 2rem;
}

.wallet-info {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;

  p {
    margin: 0.5rem 0;
  }
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;

  &.alert-warning {
    background: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
  }

  &.alert-error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
  }
}

/* Add styles for radio group if needed */
.radio-group label {
  margin-right: 15px;
  cursor: pointer;
}

.info-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--info-light);
  color: var(--info-dark);
  padding: 10px;
  border-radius: var(--border-radius);
  border: 1px solid var(--info);
  margin-bottom: $spacing-md;
  font-size: 0.9em;

  i {
    color: var(--info);
  }
}
</style> 
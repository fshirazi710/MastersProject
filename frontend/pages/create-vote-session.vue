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
        
        <!-- Shares End date input -->
        <div class="form-group">
          <label for="sharesEndDate">Shares Submission Deadline</label>
          <input 
            type="datetime-local" 
            id="sharesEndDate" 
            v-model="voteSessionData.shares_end_date" 
            required 
            class="form-input"
          >
          <p class="helper-text">Participants must submit shares before this time.</p>
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
          
          <!-- Min Share Threshold input -->
          <div class="form-group">
            <label for="minShareThreshold">Minimum Share Threshold</label>
            <input 
              type="number"
              id="minShareThreshold"
              v-model.number="voteSessionData.min_share_threshold"
              required
              min="1"
              step="1"
              class="form-input"
            >
            <p class="helper-text">Min shares needed for decryption (usually >= 1).</p>
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
import { ethersBaseService, factoryService } from '~/services/ethersService'
import { ethers } from 'ethers'

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
  shares_end_date: '',
  options: ['', ''],
  reward_pool: 0.003,
  required_deposit: 0.001,
  min_share_threshold: 1,
})

// Helper function to convert local datetime string to UNIX timestamp (seconds)
const toTimestamp = (dateTimeString) => {
  if (!dateTimeString) return null;
  // Ensure the browser interprets the string correctly, may need adjustments based on format
  return Math.floor(new Date(dateTimeString).getTime() / 1000);
};

// Function to check wallet connection status
async function checkWalletConnection() {
  // Use isConnected for a quick check if already initialized
  if (ethersBaseService.isConnected()) {
    walletAddress.value = ethersBaseService.getAccount();
    walletBalance.value = await ethersBaseService.getBalance(); // Use stored balance
    walletConnected.value = true;
  } else {
    // Optional: Could try a passive check without triggering connection prompt
    // e.g., checking if window.ethereum.selectedAddress exists
    walletConnected.value = false;
    walletAddress.value = '';
    walletBalance.value = 0;
  }
}

// Function to connect wallet
async function connectWallet() {
  error.value = null; // Clear previous errors
  try {
    await ethersBaseService.init(); // Use the base service init
    await checkWalletConnection(); // Update UI state after connection
  } catch (err) {
    error.value = err.message || 'Failed to connect wallet.';
    console.error('Wallet connection error:', err);
    walletConnected.value = false;
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
  if (!voteSessionData.value.start_date || !voteSessionData.value.end_date || !voteSessionData.value.shares_end_date) return false;
  // Validate date chronology
  try {
    const startDate = new Date(voteSessionData.value.start_date);
    const endDate = new Date(voteSessionData.value.end_date);
    const sharesEndDate = new Date(voteSessionData.value.shares_end_date);
    if (endDate <= startDate || sharesEndDate <= endDate) return false; // Check full sequence
  } catch (e) {
    return false; // Invalid date format
  }
  
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
  
  // Check ETH values & threshold
  if (voteSessionData.value.reward_pool < 0.001 || voteSessionData.value.required_deposit < 0.001) return false;
  if (voteSessionData.value.min_share_threshold < 1) return false; // Threshold must be at least 1

  return true; // If all checks pass
});

// Handle form submission
async function handleSubmit() {
  loading.value = true;
  error.value = null;

  if (!walletConnected.value) {
      error.value = 'Please connect your wallet first.';
      loading.value = false;
      return;
  }

  // --- Parameter Preparation ---
  let sessionOptions = [];
  let sessionMetadata = ''; // Default empty metadata

  if (questionType.value === 'options') {
    // Filter out empty options
    sessionOptions = voteSessionData.value.options.filter(opt => opt.trim() !== '');
    if (sessionOptions.length < 2) {
      error.value = 'Please provide at least two valid options.';
      loading.value = false;
      return;
    }
  } else if (questionType.value === 'slider') {
    sessionOptions = []; // No options for slider type
    // Basic validation for slider config
    if (sliderConfig.value.min >= sliderConfig.value.max || sliderConfig.value.step <= 0) {
        error.value = 'Invalid slider configuration (Min must be less than Max, Step must be positive).';
        loading.value = false;
        return;
    }
    // Encode slider config into metadata (JSON string)
    sessionMetadata = JSON.stringify({
        type: 'slider',
        min: sliderConfig.value.min,
        max: sliderConfig.value.max,
        step: sliderConfig.value.step
    });
  }

  // Convert dates to timestamps
  const startDateTimestamp = toTimestamp(voteSessionData.value.start_date);
  const endDateTimestamp = toTimestamp(voteSessionData.value.end_date);
  const sharesEndDateTimestamp = toTimestamp(voteSessionData.value.shares_end_date);

  if (!startDateTimestamp || !endDateTimestamp || !sharesEndDateTimestamp) {
    error.value = 'Please select valid start, end, and share submission dates.';
    loading.value = false;
    return;
  }
  if (startDateTimestamp >= endDateTimestamp || endDateTimestamp >= sharesEndDateTimestamp) {
    error.value = 'Dates must be in chronological order: Start < End < Shares End.';
    loading.value = false;
    return;
  }
  
  // Get Min Share Threshold from input
  const minShareThreshold = Number(voteSessionData.value.min_share_threshold);
  if (isNaN(minShareThreshold) || minShareThreshold < 1) {
      error.value = 'Minimum Share Threshold must be a number greater than or equal to 1.';
      loading.value = false;
      return;
  }

  // Prepare parameters for the factory contract
  const factoryParams = {
    title: voteSessionData.value.title,
    description: voteSessionData.value.description,
    startDate: startDateTimestamp,
    endDate: endDateTimestamp,
    sharesEndDate: sharesEndDateTimestamp,
    options: sessionOptions,
    metadata: sessionMetadata,
    requiredDeposit: voteSessionData.value.required_deposit.toString(),
    minShareThreshold: minShareThreshold
  };

  try {
    console.log('Calling factoryService.createVoteSession with params:', factoryParams);

    // --- Blockchain Transaction --- 
    // No ETH value needed here, deposit is handled by registerParticipant
    // Reward pool funding is separate
    const deployedSessionInfo = await factoryService.createVoteSession(factoryParams);

    console.log('Session created on blockchain:', deployedSessionInfo);

    if (!deployedSessionInfo || !deployedSessionInfo.sessionId === undefined || !deployedSessionInfo.voteSessionContract || !deployedSessionInfo.participantRegistryContract) {
        throw new Error('Failed to get valid session details from blockchain event.');
    }

    // --- Backend API Call --- 
    // Prepare data for backend, including the new addresses and session ID
    const backendPayload = {
        session_id: deployedSessionInfo.sessionId,
        title: voteSessionData.value.title,
        description: voteSessionData.value.description,
        start_date: voteSessionData.value.start_date,
        end_date: voteSessionData.value.end_date,
        shares_end_date: voteSessionData.value.shares_end_date,
        options: sessionOptions,
        metadata: sessionMetadata,
        reward_pool: voteSessionData.value.reward_pool,
        required_deposit: voteSessionData.value.required_deposit,
        min_share_threshold: minShareThreshold,
        vote_session_address: deployedSessionInfo.voteSessionContract,
        registry_address: deployedSessionInfo.participantRegistryContract
    };

    console.log('Sending session metadata to backend:', backendPayload);
    const response = await voteSessionApi.createVoteSession(backendPayload);

    console.log('Backend response:', response);

    // Redirect on successful creation (both blockchain and backend)
    // Use the session ID returned from the blockchain event
    router.push(`/session/${deployedSessionInfo.sessionId}`); 

  } catch (err) {
    console.error('Error creating vote session:', err);
    error.value = err.message || 'An unexpected error occurred during session creation.';
  } finally {
    loading.value = false;
  }
}

// Run connection check on component mount
onMounted(checkWalletConnection);

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
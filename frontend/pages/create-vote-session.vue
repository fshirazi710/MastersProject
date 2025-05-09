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
      <!-- General Error Message Display -->
      <div v-if="error" class="error-banner">
        <p>{{ error }}</p>
      </div>

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
          @blur="validateField('title')"
        >
        <p v-if="formErrors.title" class="error-message">{{ formErrors.title }}</p>
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
          @blur="validateField('description')"
        ></textarea>
        <p v-if="formErrors.description" class="error-message">{{ formErrors.description }}</p>
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
            @blur="validateField('start_date')"
          >
          <p v-if="formErrors.start_date" class="error-message">{{ formErrors.start_date }}</p>
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
            @blur="validateField('end_date')"
          >
          <p v-if="formErrors.end_date" class="error-message">{{ formErrors.end_date }}</p>
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
            @blur="validateField('shares_end_date')"
          >
          <p v-if="formErrors.shares_end_date" class="error-message">{{ formErrors.shares_end_date }}</p>
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
            <label for="requiredDeposit">Required Holder Deposit (ETH)</label>
            <input 
              type="number"
              id="requiredDeposit"
              v-model="voteSessionData.required_deposit"
              required
              min="0.001"
              step="any" 
              class="form-input"
              @blur="validateField('required_deposit')"
            >
            <p class="helper-text">Security deposit required from each holder (min 0.001 ETH)</p>
            <p v-if="formErrors.required_deposit" class="error-message">{{ formErrors.required_deposit }}</p>
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
              @blur="validateField('min_share_threshold')"
            >
            <p class="helper-text">Min shares needed for decryption (usually >= 1).</p>
            <p v-if="formErrors.min_share_threshold" class="error-message">{{ formErrors.min_share_threshold }}</p>
          </div>
        </div>
      </div>

      <!-- Question Type Selection -->
      <div class="form-group">
        <h3>Question Type</h3>
        <div class="radio-group">
          <label>
            <input type="radio" v-model="questionType" value="options" name="questionType" @change="validateField('options')">
            Standard Options
          </label>
          <label>
            <input type="radio" v-model="questionType" value="slider" name="questionType" @change="validateField('slider')">
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
              @blur="validateField(`option_${index}`)"
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
            <p v-if="formErrors[`option_${index}`]" class="error-message">{{ formErrors[`option_${index}`] }}</p>
          </div>
          <!-- Add new option button -->
          <button 
            type="button" 
            @click="addOption" 
            class="btn secondary"
            v-if="voteSessionData.options.length < 10"
          >
            Add Option
          </button>
          <p v-if="formErrors.options" class="error-message">{{ formErrors.options }}</p>
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
                  @blur="validateField('sliderMin')"
                >
                <p v-if="formErrors.sliderMin" class="error-message">{{ formErrors.sliderMin }}</p>
              </div>
              <div class="form-group">
                <label for="sliderMax">Maximum Value</label>
                <input 
                  type="number"
                  id="sliderMax"
                  v-model.number="sliderConfig.max"
                  required
                  class="form-input"
                  @blur="validateField('sliderMax')"
                >
                <p v-if="formErrors.sliderMax" class="error-message">{{ formErrors.sliderMax }}</p>
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
                  @blur="validateField('sliderStep')"
                >
                <p v-if="formErrors.sliderStep" class="error-message">{{ formErrors.sliderStep }}</p>
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
import { ref, onMounted, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { blockchainProviderService } from '@/services/blockchainProvider.js'
import { factoryService } from '@/services/contracts/factoryService.js'
import { ethers } from 'ethers'

const router = useRouter();
const loading = ref(false);
const error = ref(null);
const walletConnected = ref(false);
const walletAddress = ref('');
const walletBalance = ref(0);
const chainId = ref(null);

// Reactive object to hold validation errors for each field
const formErrors = reactive({});

// New state for question type and slider config
const questionType = ref('options'); // 'options' or 'slider'
const sliderConfig = reactive({
  min: 0,
  max: 100,
  step: 1,
});

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

// Initialize form data with reactive reference
const voteSessionData = reactive({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  shares_end_date: '',
  options: ['', ''],
  required_deposit: null,
  min_share_threshold: 1,
});

// Helper function to convert local datetime string to UNIX timestamp (seconds)
const toTimestamp = (dateTimeString) => {
  if (!dateTimeString) return null;
  return Math.floor(new Date(dateTimeString).getTime() / 1000);
};

// Function to check wallet connection status
async function checkWalletConnection() {
  if (blockchainProviderService.isConnected()) {
    walletAddress.value = blockchainProviderService.getAccount();
    const balanceFromService = await blockchainProviderService.getBalance(); 
    if (balanceFromService) {
      walletBalance.value = parseFloat(balanceFromService).toFixed(4);
    }
    chainId.value = blockchainProviderService.getChainId();
    walletConnected.value = true;
  } else {
    walletConnected.value = false;
    walletAddress.value = '';
    walletBalance.value = 0;
    chainId.value = null;
  }
}

// Function to connect wallet
async function connectWallet() {
  error.value = null; 
  try {
    const connected = await blockchainProviderService.init();
    if (connected) {
      await checkWalletConnection(); 
    } else {
      error.value = 'Failed to connect wallet. Please ensure you have MetaMask (or another compatible wallet) installed and enabled.';
      walletConnected.value = false;
    }
  } catch (err) {
    console.error("Error connecting wallet:", err);
    error.value = err.message || 'Error connecting wallet.';
    walletConnected.value = false;
  }
}

// Add a new empty option to the options array
const addOption = () => {
  if (voteSessionData.options.length < 10) { 
    voteSessionData.options.push('')
  }
}

// Remove an option at the specified index
const removeOption = (index) => {
  if (voteSessionData.options.length > 2) { 
    voteSessionData.options.splice(index, 1)
  }
}

// Add this new function
function validateField(fieldName) {
    // Calling validateForm will re-evaluate all fields and update formErrors.
    // This will ensure the specific field's error state is updated, 
    // along with any other related errors that might arise from the change.
    validateForm(); 
    // If we wanted to only validate a single field and not update other errors,
    // we would need a more granular validation function here that only checks 'fieldName'.
    // For now, re-validating the whole form on blur of a field is acceptable.
}

// New function to validate the form data
function validateForm() {
    const errors = {}; // Local errors object for this validation run

    // Title
    if (!voteSessionData.title) {
        errors.title = 'Vote title is required.';
    } else if (voteSessionData.title.length < 3 || voteSessionData.title.length > 100) {
        errors.title = 'Title must be between 3 and 100 characters.';
    }

    // Description
    if (!voteSessionData.description) {
        errors.description = 'Description is required.';
    } else if (voteSessionData.description.length < 10 || voteSessionData.description.length > 1000) {
        errors.description = 'Description must be between 10 and 1000 characters.';
    }

    // Dates
    const startDate = voteSessionData.start_date ? new Date(voteSessionData.start_date) : null;
    const endDate = voteSessionData.end_date ? new Date(voteSessionData.end_date) : null;
    const sharesEndDate = voteSessionData.shares_end_date ? new Date(voteSessionData.shares_end_date) : null;
    let validDates = true;

    if (!startDate || isNaN(startDate.getTime())) {
        errors.start_date = 'Valid start date is required.';
        validDates = false;
    }
    if (!endDate || isNaN(endDate.getTime())) {
        errors.end_date = 'Valid end date is required.';
        validDates = false;
    } 
    if (!sharesEndDate || isNaN(sharesEndDate.getTime())) {
        errors.shares_end_date = 'Valid shares submission deadline is required.';
        validDates = false;
    }

    // Date Chronology (only if all date inputs were valid)
    if (validDates) {
        if (endDate <= startDate) {
            errors.end_date = 'End date must be after start date.';
        }
        if (sharesEndDate <= endDate) {
            errors.shares_end_date = 'Shares deadline must be after the vote end date.';
        }
    }

    // Required Deposit
    if (voteSessionData.required_deposit === null || voteSessionData.required_deposit === undefined) {
        errors.required_deposit = 'Required deposit is required.';
    } else if (isNaN(parseFloat(voteSessionData.required_deposit)) || parseFloat(voteSessionData.required_deposit) < 0.001) {
        errors.required_deposit = 'Deposit must be a number >= 0.001 ETH.';
    }
    
    // Min Share Threshold
    if (voteSessionData.min_share_threshold === null || voteSessionData.min_share_threshold === undefined) {
         errors.min_share_threshold = 'Minimum share threshold is required.';
    } else if (isNaN(parseInt(voteSessionData.min_share_threshold)) || parseInt(voteSessionData.min_share_threshold) < 1) {
        errors.min_share_threshold = 'Threshold must be an integer >= 1.';
    }

    // Options
    if (questionType.value === 'options') {
        const validOptions = voteSessionData.options.filter(opt => opt && opt.trim() !== '');
        if (validOptions.length < 2) {
            errors.options = 'At least two non-empty options are required.';
        }
        // Add errors for individual empty options if needed
        voteSessionData.options.forEach((opt, index) => {
             if (!opt || !opt.trim()) {
                 errors[`option_${index}`] = `Option ${index + 1} cannot be empty.`; 
             }
        });
    }

    // Slider Config
    if (questionType.value === 'slider') {
        if (sliderConfig.min === null || sliderConfig.min === undefined || isNaN(Number(sliderConfig.min)) ) { errors.sliderMin = 'Min value is required.'; }
        if (sliderConfig.max === null || sliderConfig.max === undefined || isNaN(Number(sliderConfig.max)) ) { errors.sliderMax = 'Max value is required.'; }
        if (sliderConfig.step === null || sliderConfig.step === undefined || isNaN(Number(sliderConfig.step)) ) { errors.sliderStep = 'Step value is required.'; }
        
        // Only check comparison/step if basic requirements met
        if (!errors.sliderMin && !errors.sliderMax && sliderConfig.max <= sliderConfig.min) {
             errors.sliderMax = 'Max value must be greater than Min value.';
        }
        if (!errors.sliderStep && Number(sliderConfig.step) <= 0) {
             errors.sliderStep = 'Step must be greater than 0.';
        }
    }

    // Update the reactive formErrors state
    Object.keys(formErrors).forEach(key => delete formErrors[key]); // Clear old reactive errors
    Object.assign(formErrors, errors); // Assign new errors found in this run

    return Object.keys(errors).length === 0; // Return true if local errors object is empty
}

// Handle form submission
async function handleSubmit() {
    // Clear previous top-level submit error
    error.value = null;

    if (!walletConnected.value) {
        error.value = 'Please connect your wallet first.';
        return;
    }

    // Validate form using the new function
    if (!validateForm()) {
        // Set a general top-level error message
        error.value = "Please fix the errors highlighted in the form."; 
        return; // Stop submission if validation fails
    }

    // If validation passes, proceed
    loading.value = true;
    // error.value should be null here due to check in validateForm or cleared above

    // --- Parameter Preparation --- 
    const startTs = toTimestamp(voteSessionData.start_date);
    const endTs = toTimestamp(voteSessionData.end_date);
    const sharesEndTs = toTimestamp(voteSessionData.shares_end_date);
    const depositWei = ethers.parseEther((voteSessionData.required_deposit).toString());
    const sessionOptions = questionType.value === 'options' ? voteSessionData.options.filter(opt => opt.trim() !== '') : [];
    
    // Construct metadata (already validated within validateForm)
    let metadataObject = {
        displayHint: questionType.value 
    };
    if (questionType.value === 'slider') {
        metadataObject.sliderConfig = { ...sliderConfig }; 
    }
    const metadataString = JSON.stringify(metadataObject);

    // Prepare parameters for the service call
    const params = {
      title: voteSessionData.title,
      description: voteSessionData.description,
      startDate: startTs,
      endDate: endTs,
      sharesEndDate: sharesEndTs,
      options: sessionOptions, 
      metadata: metadataString, 
      requiredDeposit: depositWei, // factoryService expects string | bigint, BigInt is fine
      minShareThreshold: voteSessionData.min_share_threshold,
    };

    console.log("Submitting vote session params:", params);

    try {
      const result = await factoryService.createVoteSession(params)
      console.log("Vote session creation successful:", result)
      // TODO: Use notification system for success
      alert('Vote Session Created Successfully! Session ID: ' + result.sessionId); // Placeholder alert
      // Reset form
      Object.assign(voteSessionData, {
         title: '',
         description: '',
         start_date: '',
         end_date: '',
         shares_end_date: '',
         options: ['', ''],
         required_deposit: null,
         min_share_threshold: 1,
      });
      questionType.value = 'options';
      Object.assign(sliderConfig, { min: 0, max: 100, step: 1 });
      Object.keys(formErrors).forEach(key => delete formErrors[key]); // Clear errors on success
      
      router.push('/all-vote-sessions'); // Redirect after successful creation
    } catch (err) {
      console.error("Vote session creation failed:", err)
      error.value = `Failed to create vote session: ${err.message || 'Unknown error'}`;
      // TODO: Use notification system for error
    } finally {
      loading.value = false
    }
}

// Run connection check on component mount
onMounted(checkWalletConnection);

</script>

<style lang="scss">
  // Import the dedicated stylesheet for this page
  @use '@/assets/styles/pages/_create-vote.scss';
</style> 
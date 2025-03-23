<template>
  <div class="create-vote">
    <h1>Create New Vote</h1>

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
          v-model="voteData.title" 
          required 
          class="form-input"
        >
      </div>

      <!-- Vote description textarea -->
      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="voteData.description" 
          required 
          class="form-input"
        ></textarea>
      </div>

      <!-- Date selection row with two inputs -->
      <div class="form-row">
        <!-- Start date input -->
        <div class="form-group">
          <label for="startDate">Start Date</label>
          <input 
            type="datetime-local" 
            id="startDate" 
            v-model="voteData.start_date" 
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
            v-model="voteData.end_date" 
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
              v-model="voteData.reward_pool"
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
              v-model="voteData.required_deposit"
              required
              min="0.001"
              step="0.001"
              class="form-input"
            >
            <p class="helper-text">Security deposit required from each holder</p>
          </div>
        </div>
      </div>

      <!-- Dynamic voting options section -->
      <div class="form-group">
        <label>Options</label>
        <!-- List of voting options with remove buttons -->
        <div v-for="(option, index) in voteData.options" :key="index" class="option-row">
          <input 
            type="text" 
            v-model="voteData.options[index]" 
            :placeholder="'Option ' + (index + 1)"
            class="form-input"
          >
          <!-- Remove button (hidden for first two options) -->
          <button 
            type="button" 
            @click="removeOption(index)" 
            class="btn danger"
            v-if="voteData.options.length > 2"
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

      <!-- Form submit button -->
      <button type="submit" class="btn primary" :disabled="loading || !walletConnected">
        {{ loading ? 'Creating Vote...' : 'Create Vote' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { voteApi } from '@/services/api'
import { web3Service } from '@/services/web3'

const router = useRouter();
const loading = ref(false);
const error = ref(null);
const walletConnected = ref(false);
const walletAddress = ref('');
const walletBalance = ref(0);

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

// Initialize form data with reactive reference
const voteData = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  options: ['', ''],
  reward_pool: 0.003,
  required_deposit: 0.001,
})

// Initialize Web3 and connect wallet
const connectWallet = async () => {
  try {
    await web3Service.init();
    walletConnected.value = true;
    walletAddress.value = await web3Service.getAccount();
    walletBalance.value = await web3Service.getBalance();
  } catch (err) {
    console.error('Failed to connect wallet:', err);
    error.value = 'Failed to connect wallet. Please make sure MetaMask is installed and unlocked.';
  }
}

// Add a new empty option to the options array
const addOption = () => {
  voteData.value.options.push('')
}

// Remove an option at the specified index
const removeOption = (index) => {
  voteData.value.options.splice(index, 1)
}

const handleSubmit = async () => {
  if (loading.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // Check if wallet is connected
    if (!walletConnected.value) {
      throw new Error('Please connect your wallet first');
    }

    // Check if user has enough balance
    if (Number(walletBalance.value) < Number(voteData.value.reward_pool)) {
      throw new Error('Insufficient balance for reward pool');
    }

    // Format dates to ISO strings
    const formattedData = {
      ...voteData.value,
      start_date: new Date(voteData.value.start_date).toISOString(),
      end_date: new Date(voteData.value.end_date).toISOString(),
    };
    console.log(formattedData)
    // First create the vote in the backend
    const response = await voteApi.createVote(formattedData);
    alert(response.data.message || 'Vote created successfully!');
    router.push('/all-votes');
  } catch (err) {
    console.error('Failed to create vote:', err);
    error.value = err.message || 'Failed to create vote. Please try again.';
  } finally {
    loading.value = false;
  }
}

// Initialize Web3 when component is mounted
onMounted(() => {
  connectWallet();
})
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
</style> 
<template>
  <div class="create-vote">
    <h1>Create New Vote</h1>
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
      <button type="submit" class="btn primary">Create Vote</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { voteApi } from '@/services/api'

const router = useRouter();
const loading = ref(false);
const error = ref(null);

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
    // Format dates to ISO strings
    const formattedData = {
      ...voteData.value,
      start_date: new Date(voteData.value.start_date).toISOString(),
      end_date: new Date(voteData.value.end_date).toISOString(),
    };
    
    const response = await voteApi.createVote(formattedData);
    alert(response.data.message || 'Vote created successfully!');
    router.push('/all-votes');
  } catch (err) {
    console.error('Failed to create vote:', err);
    error.value = err.response?.data?.detail || 'Failed to create vote. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/create-vote';
</style> 
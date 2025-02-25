<template>
  <div class="become-holder">
    <h1>Available Secret Holder Positions</h1>
    
    <!-- Information section explaining the role -->
    <div class="info-card">
      <h2>What is a Secret Holder?</h2>
      <p>Secret holders are trusted parties who maintain encrypted keys that help secure the voting process. Each holder plays a crucial role in the final vote revelation.</p>
      
      <div class="reward-info">
        <h3>💰 Rewards System</h3>
        <p>The reward pool is divided equally among all participating secret holders who successfully:</p>
        <ul class="reward-list">
          <li>Maintain their key throughout the voting period</li>
          <li>Release their key share after voting ends</li>
          <li>Complete all holder responsibilities</li>
        </ul>
        <p class="note">Note: More holders = smaller individual rewards, but better system security</p>
      </div>

      <ul class="responsibilities">
        <li>Hold a portion of the decryption key</li>
        <li>Release your key share after voting ends</li>
        <li>Help maintain voting integrity</li>
        <li>Participate in result revelation</li>
      </ul>
    </div>

    <!-- Available sessions grid -->
    <div class="sessions-grid">
      <div v-for="session in availableSessions" :key="session.id" class="session-card">
        <h3>{{ session.title }}</h3>
        <p class="description">{{ session.description }}</p>
        
        <div class="session-meta">
          <div class="meta-item">
            <span class="label">Required Deposit:</span>
            <span class="value">{{ session.requiredDeposit }} ETH</span>
            <span class="note">(Returned after successful participation)</span>
          </div>
          <div class="meta-item">
            <span class="label">Reward Pool:</span>
            <span class="value">{{ session.rewardPool }} ETH</span>
            <span class="reward-per-holder">Current reward per holder: {{ (session.rewardPool / session.currentHolders).toFixed(6) }} ETH</span>
          </div>
          <div class="meta-item">
            <span class="label">Holders:</span>
            <span class="value">{{ session.currentHolders }}/{{ session.requiredHolders }}</span>
          </div>
          <div class="meta-item">
            <span class="label">Voting Period:</span>
            <span class="value">{{ formatDate(session.startDate) }} - {{ formatDate(session.endDate) }}</span>
          </div>
        </div>

        <button 
          @click="joinSession(session)"
          class="btn primary"
          :disabled="isSubmitting === session.id"
        >
          {{ isSubmitting === session.id ? 'Processing...' : `Join as Holder (${session.requiredDeposit} ETH)` }}
        </button>
      </div>
    </div>

    <!-- No sessions available message -->
    <div v-if="availableSessions.length === 0" class="no-sessions">
      <p>No voting sessions currently looking for secret holders</p>
    </div>

    <!-- Status messages -->
    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const availableSessions = ref([])
const isSubmitting = ref(null) // Holds the session ID being processed
const statusMessage = ref('')
const statusType = ref('')

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

// Fetch available sessions that need secret holders
const fetchAvailableSessions = async () => {
  try {
    const response = await axios.get('http://127.0.0.1:8000/secret-holder-positions')
    availableSessions.value = response.data.sessions
  } catch (error) {
    console.error('Failed to fetch available sessions:', error)
    statusMessage.value = 'Failed to load available positions'
    statusType.value = 'error'
  }
}

// Join a specific session as a secret holder
const joinSession = async (session) => {
  isSubmitting.value = session.id
  statusMessage.value = ''
  
  try {
    const response = await axios.post('http://127.0.0.1:8000/secret-holders/join', {
      sessionId: session.id,
      depositAmount: session.requiredDeposit
    })
    
    statusMessage.value = 'Successfully registered as a secret holder!'
    statusType.value = 'success'
    
    // Refresh the available sessions
    await fetchAvailableSessions()
    
  } catch (error) {
    statusMessage.value = error.response?.data?.message || 'Failed to process registration'
    statusType.value = 'error'
  } finally {
    isSubmitting.value = null
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

onMounted(() => {
  fetchAvailableSessions()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/become-holder';
</style> 
<template>
  <div class="vote-details" v-if="vote">
    <!-- Vote header with title, description and status -->
    <div class="vote-header">
      <div class="vote-status" :class="vote.status">
        {{ vote.status }}
      </div>
      <h1>{{ vote.title }}</h1>
      <p class="description">{{ vote.description }}</p>
    </div>

    <!-- Info cards grid: Timeline and Encryption Status -->
    <div class="vote-info-grid">
      <!-- Timeline card showing dates and countdown -->
      <div class="info-card">
        <h3>Timeline</h3>
        <div class="timeline">
          <div class="time-item">
            <span class="label">Start Date:</span>
            <span>{{ formatDate(vote.startDate) }}</span>
          </div>
          <div class="time-item">
            <span class="label">End Date:</span>
            <span>{{ formatDate(vote.endDate) }}</span>
          </div>
          <!-- Countdown for active votes -->
          <div class="time-remaining" v-if="vote.status === 'active'">
            Time Remaining: {{ timeRemaining }}
          </div>
        </div>
      </div>

      <!-- Encryption status card showing key holders info -->
      <div class="info-card">
        <h3>Encryption Status</h3>
        <div class="encryption-status">
          <div class="status-item">
            <span class="label">Total Secret Holders:</span>
            <span>{{ vote.secretHolderCount }}</span>
          </div>
          <div class="status-item">
            <span class="label">Keys Required:</span>
            <span>{{ vote.requiredKeys }}</span>
          </div>
          <!-- Show released keys count for ended votes -->
          <div v-if="vote.status === 'ended'" class="status-item">
            <span class="label">Keys Released:</span>
            <span>{{ vote.releasedKeys }}/{{ vote.requiredKeys }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Voting section - only shown for active votes -->
    <div class="voting-section" v-if="vote.status === 'active'">
      <h2>Cast Your Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released.</p>
      </div>
      <!-- Voting form with radio options -->
      <form @submit.prevent="handleVote" class="voting-form">
        <div class="options-list">
          <label v-for="(option, index) in vote.options" :key="index" class="option-item">
            <input
              type="radio"
              :id="'option-' + index"
              v-model="selectedOption"
              :value="option"
              name="vote-option"
              required
            >
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

    <!-- Results section - only shown for ended votes -->
    <div v-if="vote.status === 'ended'" class="results-section">
      <h2>Results</h2>
      <!-- Show pending state if not enough keys released -->
      <div v-if="!isDecrypted" class="decryption-pending">
        <div class="pending-message">
          <i class="lock-icon">🔒</i>
          <h3>Results are still encrypted</h3>
          <p>Waiting for secret holders to release their keys...</p>
          <!-- Progress bar for key release status -->
          <div class="key-progress">
            <div class="progress-bar">
              <div 
                class="progress" 
                :style="{ width: `${(vote.releasedKeys / vote.requiredKeys) * 100}%` }"
              ></div>
            </div>
            <span class="progress-text">
              {{ vote.releasedKeys }}/{{ vote.requiredKeys }} keys released
            </span>
          </div>
        </div>
      </div>
      <!-- Show results if decrypted -->
      <div v-else class="results-grid">
        <div v-for="option in vote.options" :key="option.id" class="result-item">
          <div class="result-header">
            <span class="option-text">{{ option.text }}</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress" 
              :style="{ width: `${(option.votes / totalVotes) * 100}%` }"
            ></div>
          </div>
          <div class="percentage">
            {{ ((option.votes / totalVotes) * 100).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- Secret holders section -->
    <div class="secret-holders-section">
      <h2>Secret Holders</h2>
      <p class="holders-description">
        Secret holders maintain encrypted keys that will be used to reveal the vote results
        after the voting period ends. A minimum of {{ vote.requiredKeys }} keys are needed
        to decrypt the results.
      </p>
      <!-- Grid of secret holder cards -->
      <div class="holders-grid">
        <div v-for="holder in vote.secretHolders" :key="holder.id" class="holder-card">
          <div class="holder-status" :class="holder.status"></div>
          <div class="holder-address">{{ truncateAddress(holder.address) }}</div>
          <div class="holder-info">
            <span class="label">Status:</span>
            <span>{{ holder.status }}</span>
          </div>
          <div v-if="vote.status === 'ended'" class="key-status">
            {{ holder.hasReleasedKey ? 'Key Released' : 'Awaiting Key' }}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <p>Loading vote details...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

// Get route params for vote ID
const route = useRoute()
const selectedOption = ref(null)

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

const vote = ref({}) // Initialize vote as an empty object

const fetchVoteData = async () => {
  try {
    const response = await axios.get(`http://127.0.0.1:8000/vote/${route.params.id}`)
    console.log(response)
    vote.value = {
      ...response.data.data,
      secretHolderCount: 5, // Fixed value
      requiredKeys: 3,      // Fixed value
      releasedKeys: 0,      // Fixed value
      secretHolders: [      // Fixed value
        { 
          id: 1, 
          address: '0x1234...5678', 
          status: 'active',
          hasReleasedKey: false 
        },
        { 
          id: 2, 
          address: '0x8765...4321', 
          status: 'active',
          hasReleasedKey: false 
        }
      ]
    }
  } catch (error) {
    console.error("Failed to fetch vote data:", error)
  }
}

// Hook to execute the fetchVoteData function when the component is mounted
onMounted(() => {
  fetchVoteData()
})

// Compute total votes for percentage calculations
const totalVotes = computed(() => {
  return vote.value.options.reduce((sum, option) => sum + option.votes, 0)
})

// Compute time remaining until vote ends
const timeRemaining = computed(() => {
  const end = new Date(vote.value.endDate)
  const now = new Date()
  const diff = end - now

  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `${days}d ${hours}h ${minutes}m`
})

// Check if enough keys have been released to decrypt results
const isDecrypted = computed(() => {
  return vote.value.releasedKeys >= vote.value.requiredKeys
})

// Format date strings for display
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Truncate blockchain addresses for display
const truncateAddress = (address) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
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
// All styles moved to _vote-details.scss
</style> 
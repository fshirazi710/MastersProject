<template>
  <!-- Loading spinner and message shown while fetching vote data -->
  <div v-if="loading" class="loading">
    <div class="spinner"></div>
    <p>Loading Vote Details...</p>
  </div>

  <div class="vote-details" v-else-if="vote">
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

    <!-- Registration section - only shown for join votes -->
    <RegisterToVote 
      v-if="vote.status === 'join'"
      :vote-id="route.params.id"
    />

    <!-- Voting section - only shown for active votes -->
    <CastYourVote 
      v-if="vote.status === 'active'"
      :vote-id="route.params.id"
      :options="vote.options"
    />

    <!-- Results section - only shown for ended votes -->
    <VoteResults
      v-if="vote.status === 'ended'"
      :options="vote.options"
      :released-keys="vote.releasedKeys"
      :required-keys="vote.requiredKeys"
    />

    <!-- Secret holders section -->
    <SecretHolders
      :secret-holders="vote.secretHolders"
      :required-keys="vote.requiredKeys"
      :vote-status="vote.status"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import RegisterToVote from '~/components/vote/RegisterToVote.vue'
import CastYourVote from '~/components/vote/CastYourVote.vue'
import VoteResults from '~/components/vote/VoteResults.vue'
import SecretHolders from '~/components/vote/SecretHolders.vue'

// Get route params for vote ID
const route = useRoute()
const loading = ref(true)
const vote = ref({})


const fetchVoteData = () => {
    loading.value = true
    axios.get(`http://127.0.0.1:8000/vote/${route.params.id}`)
    .then(response => {
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
      ],
      }
    })
    .catch(error => {
      console.error("Failed to fetch vote data:", error)
    })
    .finally(() => {
      loading.value = false
    })
}

// Hook to execute the fetchVoteData function when the component is mounted
onMounted(() => {
  fetchVoteData()
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
</script>

<style lang="scss" scoped>
// All styles moved to _vote-details.scss
.loading {
  text-align: center;
  font-size: 1.2em;
  color: #666;

  // Spinner styles
  .spinner {
    border: 8px solid #f3f3f3; /* Light grey */
    border-top: 8px solid #3498db; /* Blue */
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto; /* Center the spinner */
  }
}

// Spinner animation
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 
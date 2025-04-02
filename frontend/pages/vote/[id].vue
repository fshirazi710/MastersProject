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
            <span class="label">Total Vote Participants:</span>
            <span>{{ vote.participantCount }}</span>
          </div>
          <div class="status-item">
            <span class="label">Total Secret Holders:</span>
            <span>{{ vote.secretHolderCount }}</span>
          </div>
          <!-- Show released keys count for ended votes -->
          <div v-if="vote.status === 'ended'" class="status-item">
            <span class="label">Keys Released:</span>
            <span>{{ vote.releasedKeys }}/{{ vote.requiredKeys }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Registration section OR message - only shown if vote status is 'join' -->
    <template v-if="vote?.status === 'join'">
      <RegisterToVote 
        v-if="!isRegisteredForVote"
        :vote-id="route.params.id"
        :endDate="vote.endDate"
      />
      <div v-else class="status-message info">
        You are registered for this vote.
      </div>
    </template>

    <!-- Voting section - shown during join and active phases -->
    <CastYourVote 
      v-if="['join', 'active'].includes(vote?.status)"
      :vote-id="route.params.id"
      :options="vote.options"
      :endDate="vote.endDate"
      :status="vote.status"
    />

    <!-- Submit Secret Share section - only shown if registered as holder and vote has ended -->
    <SubmitSecretShare
      v-if="isRegisteredHolderForVote && vote?.status === 'ended'"
      :vote-id="route.params.id"
      :is-submission-time="isSubmissionTime"
    />

    <!-- Results section - only shown for ended votes -->
    <VoteResults
      :options="vote.options"
      :voteId="route.params.id"
    />

  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { holderApi, electionApi } from '@/services/api'
  import Cookies from 'js-cookie'
  import CastYourVote from '@/components/vote/CastYourVote.vue'
  import VoteResults from '@/components/vote/VoteResults.vue'
  import RegisterToVote from '@/components/vote/RegisterToVote.vue'
  import SubmitSecretShare from '~/components/vote/SubmitSecretShare.vue'

  // Get route params for vote ID
  const route = useRoute()
  const loading = ref(true)
  const error = ref(null)
  const vote = ref(null)

  // Computed property to check if user is registered (checks for public key cookie)
  const isRegisteredForVote = computed(() => {
    if (!vote.value) return false;
    const publicKeyCookie = `vote_${vote.value.id}_publicKey`;
    return Cookies.get(publicKeyCookie) !== undefined;
  });

  // Computed property to check if the user is registered as a holder for this vote via cookies
  const isRegisteredHolderForVote = computed(() => {
    if (!vote.value) return false;
    const isHolderCookie = `vote_${vote.value.id}_isHolder`;
    return Cookies.get(isHolderCookie) === 'true';
  });

  const fetchVoteData = async () => {
      loading.value = true
      error.value = null
      
      try {
          // Fetch vote details
          const voteResponse = await electionApi.getElectionById(route.params.id)
          const voteData = voteResponse.data.data

          const holdersResponse = await holderApi.getHolderCount(route.params.id)
          const holderData = holdersResponse.data.data
          
          // Transform the response data to match the expected format
          vote.value = {
              id: voteData.id,
              title: voteData.title || `Vote ${voteData.id}`,
              description: voteData.description || 'No description available',
              status: voteData.status || 'active',
              startDate: voteData.start_date || new Date().toISOString(),
              endDate: voteData.end_date || new Date(Date.now() + 86400000).toISOString(),
              options: voteData.options || [],
              participantCount: voteData.participant_count || 0,
              rewardPool: voteData.reward_pool || 0,
              requiredDeposit: voteData.required_deposit || 0,
              secretHolderCount: holderData.count || 0,
              requiredKeys: voteData.required_keys || 0,
              releasedKeys: voteData.released_keys || 0,
          }
      } catch (err) {
          console.error("Failed to fetch vote data:", err)
          error.value = "Failed to load vote details. Please try again later."
      } finally {
          loading.value = false
      }
  }

  // Hook to execute the fetchVoteData function when the component is mounted
  onMounted(() => {
    fetchVoteData()
  })

  // Compute time remaining until vote ends
  const timeRemaining = computed(() => {
    if (!vote.value) return ''
    
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

  // Compute if the current time is within the submission window
  const isSubmissionTime = computed(() => {
    if (!vote.value) return false
    
    const end = new Date(vote.value.endDate)
    const now = new Date()
    const fifteenMinutesAfterEnd = new Date(end.getTime() + 15 * 60000)

    return now >= end && now <= fifteenMinutesAfterEnd
  })

  // Compute if the current time is at least 15 minutes after the end of the vote
  const isResultTime = computed(() => {
    if (!vote.value) return false
    
    const end = new Date(vote.value.endDate)
    const now = new Date()
    const fifteenMinutesAfterEnd = new Date(end.getTime() + 15 * 60000)

    return now >= fifteenMinutesAfterEnd
  })
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

.status-message {
  padding: 10px 15px;
  margin-bottom: 15px;
  border-radius: var(--border-radius);
  text-align: center;
  font-weight: 500;
  margin-top: 20px; // Give it some space like the component it replaces
}

.info {
  background-color: var(--info-light);
  border: 1px solid var(--info);
  color: var(--info-dark);
}

.warning {
// ... existing warning styles ...
}
</style> 
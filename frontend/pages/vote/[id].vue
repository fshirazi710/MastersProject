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
          <div class="timeline-item">
            <span class="label">Start Date:</span>
            <span class="value">{{ formatDateTime(vote.startDate) }}</span>
          </div>
          <div class="timeline-item">
            <span class="label">End Date:</span>
            <span class="value">{{ formatDateTime(vote.endDate) }}</span>
          </div>
          <div class="timeline-item">
            <span class="label">Time Remaining:</span>
            <span class="value" :class="{ 'ending-soon': timeRemaining && timeRemaining !== 'Ended' && !timeRemaining.includes('d') && timeRemaining.startsWith('00:') }">
              {{ timeRemaining }}
            </span>
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
        @registration-successful="handleRegistrationSuccess"
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
      :is-registered="isRegisteredForVote"
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
      :endDate="vote.endDate"
    />

  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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

  const timeRemaining = ref('');
  const timeUpdateInterval = ref(null);
  // Track if we've already done the "time hit zero" refresh
  const hasRefreshedAtZero = ref(false);

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

  const fetchVoteData = async (showLoading = true) => {
      if (showLoading) loading.value = true
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
          if (showLoading) loading.value = false
      }
  }

  // Fetch only the dynamic data that changes frequently
  const fetchDynamicData = async () => {
      try {
          // Use Promise.all to fetch multiple endpoints in parallel
          const [voteResponse, holdersResponse] = await Promise.all([
              electionApi.getElectionById(route.params.id),
              holderApi.getHolderCount(route.params.id)
          ]);

          const voteData = voteResponse.data.data;
          const holderData = holdersResponse.data.data;
          
          // Only update the specific properties that change frequently
          // without replacing the entire object
          if (vote.value) {
              // Update counts
              vote.value.participantCount = voteData.participant_count || 0;
              vote.value.secretHolderCount = holderData.count || 0;
              vote.value.releasedKeys = voteData.released_keys || 0;
              vote.value.requiredKeys = voteData.required_keys || 0;
              
              // Update status - important if vote phases change
              if (vote.value.status !== voteData.status) {
                  vote.value.status = voteData.status;
                  // Force a full refresh if status changed
                  fetchVoteData(false);
              }
          }
      } catch (err) {
          console.error("Background data update failed:", err);
          // Don't show errors to user for background updates
      }
  }

  // Calculate time remaining between now and endDate, formatted as days, hours, minutes, seconds
  const updateTimeRemaining = () => {
    if (!vote.value || !vote.value.endDate) {
      timeRemaining.value = 'Not available';
      return;
    }
    
    const now = new Date();
    const end = new Date(vote.value.endDate);
    const diff = end - now;
    
    // Check if we just hit zero (or went negative)
    if (diff <= 0) {
      // If the time just hit zero and we haven't refreshed yet
      if (timeRemaining.value !== 'Ended' && !hasRefreshedAtZero.value) {
        console.log('Vote just ended, refreshing data...');
        hasRefreshedAtZero.value = true;
        // Refresh data to update the status
        fetchVoteData(false);
      }
      
      timeRemaining.value = 'Ended';
      return;
    }
    
    // If we're here, time hasn't ended yet
    hasRefreshedAtZero.value = false;
    
    // Calculate days, hours, minutes, seconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Format the time remaining
    let formattedTime = '';
    if (days > 0) formattedTime += `${days}d `;
    formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    timeRemaining.value = formattedTime;
  };

  onMounted(async () => {
      // Initial full data load (with loading indicator)
      await fetchVoteData(true);
      updateTimeRemaining();
      
      // Instead of a regular polling interval, check if we need to update status
      // on specific time-based events using the existing second-by-second timer
      
      // Update time remaining every second
      timeUpdateInterval.value = setInterval(updateTimeRemaining, 1000);
  });

  onBeforeUnmount(() => {
    // Clean up intervals when component is unmounted
    if (timeUpdateInterval.value) {
      clearInterval(timeUpdateInterval.value);
      timeUpdateInterval.value = null;
    }
  });

  // Format date strings for display
  function formatDateTime(dateString) {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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

  const handleRegistrationSuccess = () => {
    console.log('Registration successful, refreshing vote data...');
    // Refresh data without showing the main loading spinner
    // We might need to update isRegisteredForVote immediately too,
    // though a full refresh might handle that.
    fetchVoteData(false);
    // Optionally, force re-evaluation of computed properties if needed, 
    // but Vue 3 reactivity should handle this if fetchVoteData updates the cookies/state.
  };
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/_vote-details.scss';

// Styles are now fully imported from _vote-details.scss

</style> 
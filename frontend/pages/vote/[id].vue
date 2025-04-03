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
            <span class="label">{{ timerLabel }}</span>
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
      :releasedKeys="vote.releasedKeys"
      :requiredKeys="vote.requiredKeys"
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
  const timerLabel = ref('Time Remaining:');
  const isLocallyRegistered = ref(false); // Add local registration state

  // Computed property to check if user is registered (checks for public key cookie)
  const isRegisteredForVote = computed(() => {
    if (isLocallyRegistered.value) return true; // Check local state first
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
          startTimerUpdates();
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
      } finally {
          updateTimerState();
      }
  }

  // Helper function to format time difference
  const formatTimeDifference = (diff) => {
      if (diff <= 0) return '00:00:00'; // Handle ended/zero case

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let formattedTime = '';
      if (days > 0) formattedTime += `${days}d `;
      formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      return formattedTime;
  };

  // Renamed and refactored function to update timer label and value based on vote state
  const updateTimerState = () => {
      if (!vote.value || !vote.value.startDate || !vote.value.endDate) {
          timerLabel.value = 'Status:';
          timeRemaining.value = 'Not available';
          // Stop timer if running
          if (timeUpdateInterval.value) {
             clearInterval(timeUpdateInterval.value);
             timeUpdateInterval.value = null;
          }
          return;
      }

      const now = new Date();
      const start = new Date(vote.value.startDate);
      const end = new Date(vote.value.endDate);

      let needsDataRefresh = false;
      let potentialStatusChange = false; // Flag to check if a refresh *might* change the state

      if (now < start) {
          // State: Pending (Before Start Date)
          timerLabel.value = 'Starts in:';
          const diffToStart = start - now;
          timeRemaining.value = formatTimeDifference(diffToStart);

          // Check if start time just passed in this interval tick
          if (diffToStart <= 0) {
               console.log('Vote start time reached or passed.');
               potentialStatusChange = true; // Status might change to active
               timeRemaining.value = 'Starting...'; // Temp state
          }
      } else if (now < end) {
          // State: Active (Between Start and End Date)
          timerLabel.value = 'Ends in:';
          const diffToEnd = end - now;
          timeRemaining.value = formatTimeDifference(diffToEnd);

          // If status is still pending/join, refresh to ensure it reflects active state
           if (['pending', 'join'].includes(vote.value.status)) {
              console.log('Vote should be active now, ensuring status update.');
              potentialStatusChange = true;
           }

          // Check if end time just passed in this interval tick
          if (diffToEnd <= 0) {
              console.log('Vote end time reached or passed.');
              potentialStatusChange = true; // Status might change to ended
              timeRemaining.value = 'Ending...'; // Temp state
          }

      } else {
          // State: Ended (After End Date)
          timerLabel.value = 'Status:';
          timeRemaining.value = 'Ended';

          // If status isn't 'ended' yet, refresh
          if (vote.value.status !== 'ended') {
               console.log('Vote should have ended, ensuring status update.');
               potentialStatusChange = true;
          }

          // Stop the timer interval if it's still running
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
              console.log('Vote ended, stopping timer interval.');
          }
      }

      // If a state transition likely occurred AND status isn't already 'ended'
      if (potentialStatusChange && vote.value.status !== 'ended') {
          console.log('Refreshing vote data due to potential state change.');
          // Fetch data without showing loading spinner
          // The next tick of the timer (if still running) will use the updated data/status
          fetchVoteData(false); // This now calls startTimerUpdates in its finally block
      }
  };

  // Function to start/restart the timer interval
  const startTimerUpdates = () => {
      // Clear any existing interval first
      if (timeUpdateInterval.value) {
          clearInterval(timeUpdateInterval.value);
          timeUpdateInterval.value = null; // Ensure it's cleared before setting new one
      }
      // Update immediately to set the initial state correctly
      updateTimerState();
      // Set interval only if the vote is not already ended (based on the immediate update)
      // Use a check against the calculated state, not just vote.value.status
      if (timeRemaining.value !== 'Ended' && timeRemaining.value !== 'Not available') {
           console.log('Starting timer interval.');
           timeUpdateInterval.value = setInterval(updateTimerState, 1000);
      } else {
           console.log('Timer not started (already ended or unavailable).');
      }
  };

  onMounted(async () => {
      // Initial full data load triggers startTimerUpdates in its finally block
      await fetchVoteData(true);

      // Ensure background interval is cleared on unmount
      onBeforeUnmount(() => {
          // Clear the main timer interval as well (already handled in updateTimerState when ended)
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
          }
      });
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
    isLocallyRegistered.value = true; // Set local flag on successful registration
    // Re-fetch dynamic data (like participant count) after registration
    fetchDynamicData();
    // No need to explicitly update isRegisteredForVote, computed property handles it
  };
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/_vote-details.scss';

// Styles are now fully imported from _vote-details.scss

</style> 
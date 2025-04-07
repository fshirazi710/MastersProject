<template>
  <!-- Loading spinner and message shown while fetching vote data -->
  <div v-if="loading" class="loading">
    <div class="spinner"></div>
    <p>Loading Vote Details...</p>
  </div>

  <!-- Error Message Display -->
  <div v-else-if="error" class="error-message">
    <h2>Error Loading Vote</h2>
    <p>{{ error }}</p>
    <nuxt-link to="/" class="btn">Go to Homepage</nuxt-link>
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
      :displayHint="displayHint"
      :sliderConfig="sliderConfig"
      :existingThreshold="vote.requiredKeys || 0"
    />

    <!-- Submit Secret Share section - only shown if registered as holder and vote has ended -->
    <SubmitSecretShare
      v-if="isRegisteredHolderForVote && vote?.status === 'ended'"
      :vote-id="route.params.id"
      :is-submission-time="isSubmissionTime"
      :endDate="vote.endDate"
    />

    <!-- Results section - only shown for ended votes -->
    <VoteResults
      :options="vote.options"
      :voteId="route.params.id"
      :endDate="vote.endDate"
      :releasedKeys="vote.releasedKeys"
      :requiredKeys="vote.requiredKeys"
      :displayHint="displayHint"
      :sliderConfig="sliderConfig"
    />

  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
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

  // Add state for metadata
  const displayHint = ref(null);
  const sliderConfig = ref(null);

  // --- onBeforeUnmount Hook --- 
  // Clear the main timer interval on unmount
  onBeforeUnmount(() => {
    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
        timeUpdateInterval.value = null; 
    }
  });
  // ---------------------------

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
      // --- Guard for voteId (kept for safety, though watch should prevent invalid calls mostly) --- 
      const voteId = route.params.id;
      if (!voteId || voteId === 'undefined' || voteId === ':id') { 
          console.warn("fetchVoteData called with invalid voteId:", voteId);
          error.value = "Invalid or missing vote ID.";
          loading.value = false; 
          vote.value = null; 
          displayHint.value = null;
          sliderConfig.value = null;
          if (timeUpdateInterval.value) { 
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
          return; 
      }
      // -------------------------

      if (showLoading) loading.value = true
      error.value = null 
      
      try {
          const [voteResponse, holdersResponse, metadataResponse] = await Promise.all([
              electionApi.getElectionById(voteId),
              holderApi.getHolderCount(voteId),
              electionApi.getElectionMetadata(voteId) 
          ]);
          
          const metadata = metadataResponse.data.data; 
          let parsedSliderConfig = null;
          if (metadata && typeof metadata.sliderConfig === 'string') {
              try { parsedSliderConfig = JSON.parse(metadata.sliderConfig); } catch (e) { console.error("Failed to parse sliderConfig JSON:", e); }
          } else if (metadata && typeof metadata.sliderConfig === 'object') { parsedSliderConfig = metadata.sliderConfig; }

          const voteData = voteResponse.data.data;
          const holderData = holdersResponse.data.data;
          
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
          
          displayHint.value = metadata?.displayHint; 
          sliderConfig.value = parsedSliderConfig;
          
      } catch (err) {
          console.error("Failed to fetch vote data or metadata:", err)
          let specificError = `Failed to load details for vote ${voteId}. Please try again later.`; // Default error
          if (err.response) {
            const status = err.response.status;
            const detail = err.response.data?.detail || '';
            // Check for 404 or specific backend error message
            if (status === 404 || (typeof detail === 'string' && detail.includes('Election does not exist'))) {
              specificError = `Vote with ID ${voteId} was not found. It may have been deleted or the ID is incorrect.`;
            } else if (detail) {
              specificError = `Error loading vote ${voteId}: ${detail}`; // Use backend detail if available and not 404
            }
          } else {
            specificError = `Error loading vote ${voteId}: ${err.message || 'Network error or unknown issue'}`;
          }
          error.value = specificError;
          vote.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
      } finally {
          if (showLoading) loading.value = false
          if (vote.value) {
            startTimerUpdates();
          } else {
             if (timeUpdateInterval.value) {
                 clearInterval(timeUpdateInterval.value);
                 timeUpdateInterval.value = null;
             }
          }
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
              potentialStatusChange = true;
           }

          // Check if end time just passed in this interval tick
          if (diffToEnd <= 0) {
              potentialStatusChange = true; // Status might change to ended
              timeRemaining.value = 'Ending...'; // Temp state
          }

      } else {
          // State: Ended (After End Date)
          timerLabel.value = 'Status:';
          timeRemaining.value = 'Ended';

          // If status isn't 'ended' yet, refresh
          if (vote.value.status !== 'ended') {
               potentialStatusChange = true;
          }

          // Stop the timer interval if it's still running
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
      }

      // If a state transition likely occurred AND status isn't already 'ended'
      if (potentialStatusChange && vote.value.status !== 'ended') {
          // Fetch data without showing loading spinner
          // The next tick of the timer (if still running) will use the updated data/status
          fetchVoteData(false); // This now calls startTimerUpdates in its finally block
      }
  };

  // Function to start the timer updates
  const startTimerUpdates = () => {
    // Clear existing interval before starting a new one
    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
    }
    // Update time immediately and then set interval
    updateTimerState(); 
    timeUpdateInterval.value = setInterval(updateTimerState, 1000);
  };

  // Function to update the timer display
  const updateTimer = () => {
    updateTimerState();
  };

  // --- Watch route parameter for changes --- 
  watch(() => route.params.id, (newId, oldId) => {
      // Check if the new ID is valid before fetching
      if (newId && newId !== 'undefined' && newId !== ':id') {
          // Clear old data before fetching new, show loading
          vote.value = null; 
          displayHint.value = null;
          sliderConfig.value = null;
          error.value = null;
          // Stop timer associated with old vote ID
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
          // Fetch data for the new valid ID
          fetchVoteData(true); 
      } else {
          // Handle cases where the route changes to an invalid ID
          // (e.g., navigating away or to a placeholder)
          error.value = "Invalid vote ID in route.";
          vote.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
          loading.value = false;
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
      }
  }, { immediate: true }); // immediate: true runs the watcher once on component mount
  // ----------------------------------------

  onMounted(() => {
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
    fetchVoteData();
    // No need to explicitly update isRegisteredForVote, computed property handles it
  };

  // Function to check and update vote status if needed
  const updateVoteStatusIfNeeded = async () => {
    if (!vote.value) return;

    const now = Date.now();
    const startDate = new Date(vote.value.startDate).getTime();
    const endDate = new Date(vote.value.endDate).getTime();
    let expectedStatus = 'pending';

    if (now >= endDate) {
        expectedStatus = 'ended';
    } else if (now >= startDate) {
        expectedStatus = 'active';
    } else { 
        expectedStatus = 'join'; 
    }

    // Refresh data if the calculated status differs from the current vote status
    if (vote.value.status !== expectedStatus) {
        await fetchVoteData(false); // Fetch without showing the main loading spinner
    }
  };
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/_vote-details.scss';

/* Styles for Error Message */
.error-message {
  text-align: center;
  padding: 40px 20px;
  background-color: #fff3f3; /* Light red background */
  border: 1px solid #ffcccc; /* Reddish border */
  border-radius: var(--border-radius);
  margin: 20px auto;
  max-width: 600px;
}

.error-message h2 {
  color: #cc0000; /* Dark red */
  margin-bottom: 15px;
}

.error-message p {
  color: #333;
  margin-bottom: 20px;
}

.error-message .btn {
  display: inline-block;
  padding: 10px 20px;
  background-color: var(--primary);
  color: white;
  text-decoration: none;
  border-radius: var(--border-radius);
  transition: background-color 0.3s ease;
}

.error-message .btn:hover {
  background-color: var(--primary-dark);
}

.vote-details {
  /* ... */
}

</style> 
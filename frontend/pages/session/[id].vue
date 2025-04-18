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

    <!-- Registration section OR message - updated v-if -->
    <template v-if="vote?.status === 'join'">
      <div v-if="isCheckingStatus" class="loading-message">Checking registration status...</div>
      <RegisterToVote 
        v-else-if="!isRegisteredForVote"
        :vote-session-id="route.params.id"
        :endDate="vote.endDate"
        :rewardPool="vote.rewardPool"
        :requiredDeposit="vote.requiredDeposit"
        @registration-successful="handleRegistrationSuccess"
      />
      <div v-else class="status-message info">
        You are registered for this vote.
      </div>
    </template>

    <!-- Voting section - Pass updated isRegisteredForVote -->
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

    <!-- Submit Secret Share section - Needs accurate holder check -->
    <SubmitSecretShare
      v-if="isRegisteredForVote && vote?.status === 'ended'"
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
  import { holderApi, voteSessionApi } from '@/services/api'
  import Cookies from 'js-cookie'
  import CastYourVote from '@/components/vote/CastYourVote.vue'
  import VoteResults from '@/components/vote/VoteResults.vue'
  import RegisterToVote from '@/components/vote/RegisterToVote.vue'
  import SubmitSecretShare from '~/components/vote/SubmitSecretShare.vue'
  import { ethersService } from '~/services/ethersService'
  import { config } from '@/config'

  // Get route params for vote ID
  const route = useRoute()
  const loading = ref(true)
  const error = ref(null)
  const vote = ref(null)
  const actualIsRegistered = ref(false)
  const isCheckingStatus = ref(true)

  const timeRemaining = ref('');
  const timeUpdateInterval = ref(null);
  const timerLabel = ref('Time Remaining:');

  // Add state for metadata
  const displayHint = ref(null);
  const sliderConfig = ref(null);

  onBeforeUnmount(() => {
    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
        timeUpdateInterval.value = null;
    }
  });

  const isRegisteredForVote = computed(() => {
    return actualIsRegistered.value;
  });

  const isRegisteredHolderForVote = computed(() => {
    if (!vote.value) return false;
    const isHolderCookie = `vote_${vote.value.id}_isHolder`;
    return Cookies.get(isHolderCookie) === 'true';
  });

  const fetchVoteData = async (showLoading = true) => {
      const voteSessionId = route.params.id;
      if (!voteSessionId || voteSessionId === 'undefined' || voteSessionId === ':id') {
          console.warn("fetchVoteData called with invalid voteSessionId:", voteSessionId);
          error.value = "Invalid or missing Vote Session ID.";
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

      if (showLoading) loading.value = true
      error.value = null

      try {
          const [sessionResponse, holdersResponse, metadataResponse] = await Promise.all([
              voteSessionApi.getVoteSessionById(voteSessionId),
              holderApi.getHolderCount(voteSessionId),
              voteSessionApi.getVoteSessionMetadata(voteSessionId)
          ]);

          const metadata = metadataResponse.data.data;
          let parsedSliderConfig = null;
          if (metadata && typeof metadata.sliderConfig === 'string') {
              try { parsedSliderConfig = JSON.parse(metadata.sliderConfig); } catch (e) { console.error("Failed to parse sliderConfig JSON:", e); }
          } else if (metadata && typeof metadata.sliderConfig === 'object') { parsedSliderConfig = metadata.sliderConfig; }

          const sessionData = sessionResponse.data.data;
          const holderData = holdersResponse.data.data;
          
          vote.value = {
              id: sessionData.id,
              title: sessionData.title || `Vote Session ${sessionData.id}`,
              description: sessionData.description || 'No description available',
              status: sessionData.status || 'active',
              startDate: sessionData.start_date || new Date().toISOString(),
              endDate: sessionData.end_date || new Date(Date.now() + 86400000).toISOString(),
              options: sessionData.options || [],
              participantCount: sessionData.participant_count || 0,
              rewardPool: sessionData.reward_pool || 0,
              requiredDeposit: sessionData.required_deposit || 0,
              secretHolderCount: holderData.count || 0,
              requiredKeys: sessionData.required_keys || 0,
              releasedKeys: sessionData.released_keys || 0,
          }
          
          displayHint.value = metadata?.displayHint;
          sliderConfig.value = parsedSliderConfig;
          
      } catch (err) {
          console.error("Failed to fetch vote session data or metadata:", err)
          let specificError = `Failed to load details for Vote Session ${voteSessionId}. Please try again later.`;
          if (err.response) {
            const status = err.response.status;
            const detail = err.response.data?.detail || '';
            if (status === 404 || (typeof detail === 'string' && (detail.includes('Election does not exist') || detail.includes('Vote Session does not exist')))) {
              specificError = `Vote Session with ID ${voteSessionId} was not found. It may have been deleted or the ID is incorrect.`;
            } else if (detail) {
              specificError = `Error loading Vote Session ${voteSessionId}: ${detail}`;
            }
          } else {
            specificError = `Error loading Vote Session ${voteSessionId}: ${err.message || 'Network error or unknown issue'}`;
          }
          error.value = specificError;
          vote.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
          actualIsRegistered.value = false;
      } finally {
          if (showLoading) loading.value = false
          if (vote.value) {
            startTimerUpdates();
          } else {
             if (timeUpdateInterval.value) {
                 clearInterval(timeUpdateInterval.value);
                 timeUpdateInterval.value = null;
             }
             actualIsRegistered.value = false;
          }
      }
  }

  const formatTimeDifference = (diff) => {
      if (diff <= 0) return '00:00:00';

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let formattedTime = '';
      if (days > 0) formattedTime += `${days}d `;
      formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      return formattedTime;
  };

  const updateTimerState = () => {
      if (!vote.value || !vote.value.startDate || !vote.value.endDate) {
          timerLabel.value = 'Status:';
          timeRemaining.value = 'Not available';
          if (timeUpdateInterval.value) {
             clearInterval(timeUpdateInterval.value);
             timeUpdateInterval.value = null;
          }
          return;
      }

      const now = new Date();
      const start = new Date(vote.value.startDate);
      const end = new Date(vote.value.endDate);

      let potentialStatusChange = false;

      if (now < start) {
          timerLabel.value = 'Starts in:';
          const diffToStart = start - now;
          timeRemaining.value = formatTimeDifference(diffToStart);

          if (diffToStart <= 0) {
               potentialStatusChange = true;
               timeRemaining.value = 'Starting...';
          }
      } else if (now < end) {
          timerLabel.value = 'Ends in:';
          const diffToEnd = end - now;
          timeRemaining.value = formatTimeDifference(diffToEnd);

          if (['pending', 'join'].includes(vote.value.status)) {
              potentialStatusChange = true;
          }

          if (diffToEnd <= 0) {
              potentialStatusChange = true;
              timeRemaining.value = 'Ending...';
          }

      } else {
          timerLabel.value = 'Status:';
          timeRemaining.value = 'Ended';

          if (vote.value.status !== 'ended') {
               potentialStatusChange = true;
          }

          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
      }

      if (potentialStatusChange && vote.value.status !== 'ended') {
          fetchVoteData(false);
      }
  };

  const startTimerUpdates = () => {
    if (timeUpdateInterval.value) {
        clearInterval(timeUpdateInterval.value);
    }
    updateTimerState(); 
    timeUpdateInterval.value = setInterval(updateTimerState, 1000);
  };

  const updateTimer = () => {
    updateTimerState();
  };

  watch(() => route.params.id, async (newId, oldId) => {
      if (newId && oldId && newId !== oldId && newId !== 'undefined' && newId !== ':id') {
          vote.value = null; 
          displayHint.value = null;
          sliderConfig.value = null;
          error.value = null;
          actualIsRegistered.value = false;
          isCheckingStatus.value = true;
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
          await fetchVoteData(true);
          await checkActualRegistrationStatus();
      } else if (!newId || newId === 'undefined' || newId === ':id') {
          error.value = "Invalid vote ID in route.";
          vote.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
          actualIsRegistered.value = false;
          loading.value = false;
          isCheckingStatus.value = false;
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
      }
  });

  onMounted(async () => {
      console.log("Vote Session page mounted. Initializing...");
      loading.value = true;
      isCheckingStatus.value = true;
      error.value = null;
  
      try {
          if (!ethersService.getAccount()) {
              console.log("Attempting to initialize wallet connection...");
              await ethersService.init(); 
              console.log("Wallet initialized, account:", ethersService.getAccount());
          } else {
              console.log("Wallet connection already established, account:", ethersService.getAccount());
          }
  
          const voteSessionId = route.params.id;
          if (!voteSessionId || voteSessionId === 'undefined' || voteSessionId === ':id') {
              throw new Error("Invalid or missing Vote Session ID on initial load.");
          }
          await fetchVoteData(false);
          
          if (vote.value) {
             await checkActualRegistrationStatus();
          }
          
      } catch (err) {
          console.error("Error during component mount initialization:", err);
          if (!error.value) {
             error.value = err.message || "Failed to initialize vote session details or wallet connection.";
          }
          actualIsRegistered.value = false;
          if (vote.value) {
            loading.value = false; 
          } else {
            loading.value = false;
          } 
      } finally {
          if(loading.value) loading.value = false;
          if(isCheckingStatus.value) isCheckingStatus.value = false;
          console.log("Initialization complete. Loading:", loading.value, "Checking Status:", isCheckingStatus.value);
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

  const handleRegistrationSuccess = async () => {
    console.log("Registration transaction potentially sent, re-checking status...");
    await checkActualRegistrationStatus();
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
        await fetchVoteData(false);
    }
  };

  const checkActualRegistrationStatus = async () => {
    isCheckingStatus.value = true;
    error.value = null;
    const currentAccount = ethersService.getAccount();
    const voteSessionId = route.params.id;

    if (!currentAccount || !voteSessionId || voteSessionId === 'undefined' || voteSessionId === ':id') {
        console.log("Cannot check status: Missing account or vote ID.");
        actualIsRegistered.value = false;
        isCheckingStatus.value = false;
        return;
    }

    console.log(`Checking actual registration status for ${currentAccount} in vote session ${voteSessionId}...`);
    try {
        const statusResult = await ethersService.readContract(
            config.contract.address,
            config.contract.abi,
            'getHolderStatus',
            [parseInt(voteSessionId), currentAccount]
        );
        actualIsRegistered.value = statusResult[0]; 
        console.log("Actual on-chain registration status:", actualIsRegistered.value);
    } catch (err) {
        console.error("Error checking actual registration status:", err);
        error.value = "Could not verify registration status. Please ensure your wallet is connected correctly and try refreshing.";
        actualIsRegistered.value = false; 
    } finally {
        isCheckingStatus.value = false;
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
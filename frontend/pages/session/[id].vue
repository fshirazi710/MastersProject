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

    <!-- Submit Secret Share section -->
    <SubmitSecretShare
      v-if="isRegisteredForVote && vote?.status === 'ended'"
      :vote-id="route.params.id"
      :endDate="vote.endDate"
    />

    <!-- Submit Decryption Value Section (New) -->
    <div 
      v-if="isRegisteredForVote && vote && (vote.status === 'shares' || vote.status === 'ended' || vote.status === 'complete') && !hasSubmittedDecryptionValue"
      class="voting-section"
    >
      <h3>Submit Decryption Value</h3>
      <p>Submit your value to help decrypt the results.</p>
       <!-- Add Password Input Here -->
       <!-- Example (Needs v-model binding):
       <div class="form-group">
            <label for="decval-password">Enter Vote Session Key Password:</label>
            <input 
              type="password" 
              id="decval-password" 
              placeholder="Password used during registration"
              required
              class="form-input"
            />
          </div>
        -->
      <button 
        @click="submitMyDecryptionValue"
        class="btn secondary"
        :disabled="submitDecryptionValueLoading"
      >
        {{ submitDecryptionValueLoading ? 'Submitting Value...' : 'Submit Decryption Value' }}
      </button>
      <p v-if="submitDecryptionValueError" class="error-message">{{ submitDecryptionValueError }}</p>
    </div>
    <div 
      v-if="isRegisteredForVote && hasSubmittedDecryptionValue"
      class="status-message success"
    >
      <i class="icon check">✔️</i> You have submitted your decryption value.
    </div>

    <!-- Claim Deposit/Reward Section (New) -->
    <div 
      v-if="isRegisteredForVote && canClaim"
      class="voting-section"
    >
        <h3>Claim Deposit/Reward</h3>
        <p>You are eligible to claim your refundable deposit and any potential rewards.</p>
        <!-- Optional: Display claimable amounts if fetched 
        <p>Deposit: {{ claimableDeposit }} ETH</p>
        <p>Reward: {{ claimableReward }} ETH</p>
        -->
        <button
            @click="submitClaim"
            class="btn secondary"
            :disabled="claimLoading"
        >
            {{ claimLoading ? 'Processing Claim...' : 'Claim Deposit & Reward' }}
        </button>
        <p v-if="claimError" class="error-message">{{ claimError }}</p>
    </div>
    <div 
        v-if="isRegisteredForVote && hasClaimed"
        class="status-message success"
    >
        <i class="icon check">✔️</i> You have already claimed your deposit/reward for this session.
    </div>

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
  import { ethersBaseService, factoryService, registryService, voteSessionService } from '~/services/contracts/ethersService'

  // Get route params for vote ID
  const route = useRoute()
  const loading = ref(true)
  const error = ref(null)
  const vote = ref(null)
  const voteSessionAddress = ref(null);
  const participantRegistryAddress = ref(null);
  const actualIsRegistered = ref(false)
  const hasSubmittedDecryptionValue = ref(false)
  const hasClaimed = ref(false)
  const canClaim = ref(false)
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
      const voteSessionIdString = route.params.id;
      if (!voteSessionIdString || voteSessionIdString === 'undefined' || voteSessionIdString === ':id') {
          console.warn("fetchVoteData called with invalid voteSessionId:", voteSessionIdString);
          error.value = "Invalid or missing Vote Session ID.";
          loading.value = false;
          vote.value = null;
          voteSessionAddress.value = null;
          participantRegistryAddress.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
          if (timeUpdateInterval.value) {
              clearInterval(timeUpdateInterval.value);
              timeUpdateInterval.value = null;
          }
          return;
      }
      // Convert ID from route param (string) to number for service calls
      const voteSessionId = parseInt(voteSessionIdString, 10); 
      if (isNaN(voteSessionId)) {
          console.error("fetchVoteData: Invalid vote session ID format:", voteSessionIdString);
          error.value = "Invalid Vote Session ID format.";
          loading.value = false;
          return;
      }

      if (showLoading) loading.value = true
      error.value = null

      try {
          // --- Blockchain Data Fetching ---
          console.log(`Fetching addresses for session ID: ${voteSessionId}`);
          const addresses = await factoryService.getSessionAddresses(voteSessionId);
          if (!addresses || !addresses.sessionAddress || !addresses.registryAddress) {
              throw new Error(`Could not fetch contract addresses for session ${voteSessionId}. It might not exist or the factory is unavailable.`);
          }
          voteSessionAddress.value = addresses.sessionAddress;
          participantRegistryAddress.value = addresses.registryAddress;
          console.log(`Addresses found - Session: ${voteSessionAddress.value}, Registry: ${participantRegistryAddress.value}`);

          // Fetch session info directly from the VoteSession contract
          console.log(`Fetching session info from contract: ${voteSessionAddress.value}`);
          const blockchainSessionInfo = await voteSessionService.getSessionInfo(voteSessionId); // Assumes service handles using the address
          if (!blockchainSessionInfo) {
               throw new Error(`Failed to fetch session details from contract ${voteSessionAddress.value}.`);
          }
          console.log("Blockchain session info:", blockchainSessionInfo);

          // Fetch participant count from the ParticipantRegistry contract
          console.log(`Fetching participant count from contract: ${participantRegistryAddress.value}`);
          const participantCount = await registryService.getNumberOfActiveParticipants(voteSessionId); // Assumes service handles using the address
          console.log("Blockchain participant count:", participantCount);

          // --- Backend API Data Fetching (Optional / Supplementary) ---
          // Example: Fetch metadata or other off-chain data if needed
          // const metadataResponse = await voteSessionApi.getVoteSessionMetadata(voteSessionId);
          // const metadata = metadataResponse.data.data;
          // displayHint.value = metadata?.displayHint; 
          // Handle slider config from metadata if applicable
          // let parsedSliderConfig = null;
          // ... parsing logic ...
          // sliderConfig.value = parsedSliderConfig;

          // --- Check Registration & Submission Statuses --- (After getting addresses)
          const currentAccount = ethersBaseService.getAccount();
          if (currentAccount) {
               console.log(`Checking registration, decryption, and claim status for ${currentAccount}...`);
               try {
                   const details = await registryService.getParticipantDetails(voteSessionId, currentAccount);
                   actualIsRegistered.value = !!details;
                   hasSubmittedDecryptionValue.value = details ? details.hasSubmittedDecryptionValue : false;
                   hasClaimed.value = details ? details.hasClaimed : false;
                   console.log(`Status - Registered: ${actualIsRegistered.value}, Submitted Decryption: ${hasSubmittedDecryptionValue.value}, Claimed: ${hasClaimed.value}`);

                   // Determine eligibility to claim (example logic)
                   const isSessionEnded = vote.value && (vote.value.status === 'ended' || vote.value.status === 'complete');
                   canClaim.value = actualIsRegistered.value && !hasClaimed.value && isSessionEnded;
                   console.log(`Can Claim: ${canClaim.value}`);
                   
                   // TODO: Fetch specific claimable amounts if needed
                   // if (canClaim.value) {
                   //    const amounts = await registryService.getClaimableAmount(voteSessionId, currentAccount);
                   //    claimableDeposit.value = amounts.deposit;
                   //    claimableReward.value = amounts.reward;
                   // }

               } catch (statusError) {
                    console.error("Error checking participant status during fetch:", statusError);
                    // Don't necessarily fail the whole fetch, but log it
                    actualIsRegistered.value = false;
                    hasSubmittedDecryptionValue.value = false;
                    hasClaimed.value = false;
                    canClaim.value = false;
               }
          } else {
              actualIsRegistered.value = false;
              hasSubmittedDecryptionValue.value = false;
              hasClaimed.value = false;
              canClaim.value = false;
          }
          // ---------------------------------------------

          // --- Combine Data ---
          // Prioritize blockchain data for on-chain state
          vote.value = {
              id: voteSessionId, // Use the ID from the route
              title: blockchainSessionInfo.title,
              description: blockchainSessionInfo.description,
              status: getStatusString(blockchainSessionInfo.sessionStatus), // Convert enum number to string
              startDate: new Date(blockchainSessionInfo.startDate * 1000).toISOString(), // Convert timestamp to ISO string
              endDate: new Date(blockchainSessionInfo.endDate * 1000).toISOString(),
              sharesEndDate: new Date(blockchainSessionInfo.sharesEndDate * 1000).toISOString(), // Added shares end date
              options: blockchainSessionInfo.options,
              metadata: blockchainSessionInfo.metadata, // Store raw metadata
              participantCount: participantCount, 
              secretHolderCount: participantCount, // Assuming registered participants are holders for now
              requiredDeposit: blockchainSessionInfo.requiredDeposit, // Already formatted ETH string from service
              minShareThreshold: blockchainSessionInfo.minShareThreshold, // Already number from service
              // TODO: Need functions in services/contracts for these?
              requiredKeys: blockchainSessionInfo.minShareThreshold, // Placeholder - Use threshold for now
              releasedKeys: 0, // Placeholder - Need contract view function
              rewardPool: 0, // Placeholder - Reward pool might be off-chain or managed differently
          };

          // Parse metadata for slider if present
          if (vote.value.metadata) {
              try {
                  const parsedMeta = JSON.parse(vote.value.metadata);
                  if (parsedMeta.type === 'slider') {
                      sliderConfig.value = {
                          min: parsedMeta.min,
                          max: parsedMeta.max,
                          step: parsedMeta.step,
                      };
                  }
              } catch (e) {
                   console.warn("Metadata is not valid JSON or doesn't contain slider config:", e);
                   sliderConfig.value = null;
              }
          } else {
               sliderConfig.value = null;
          }
          
          
      } catch (err) {
          console.error("Failed to fetch vote session data:", err);
          error.value = `Error loading Vote Session ${voteSessionId}: ${err.message || 'Network error or unknown issue'}`;
          vote.value = null;
          voteSessionAddress.value = null;
          participantRegistryAddress.value = null;
          displayHint.value = null;
          sliderConfig.value = null;
          actualIsRegistered.value = false;
          hasSubmittedDecryptionValue.value = false;
          hasClaimed.value = false;
          canClaim.value = false;
      } finally {
          if (showLoading) loading.value = false
          if (vote.value) {
              startTimerUpdates(); // Start timer based on fetched blockchain dates
          } else {
             if (timeUpdateInterval.value) {
                 clearInterval(timeUpdateInterval.value);
                 timeUpdateInterval.value = null;
             }
             actualIsRegistered.value = false;
             hasSubmittedDecryptionValue.value = false;
             hasClaimed.value = false;
             canClaim.value = false;
          }
          isCheckingStatus.value = false; // Assume status check is done here
      }
  }

  // Helper to convert session status enum (number) to string
  // Adjust based on actual enum order in Structs.sol
  function getStatusString(statusEnum) {
      switch (statusEnum) {
          case 0: return 'pending'; // Assuming Pending = 0
          case 1: return 'active'; // Assuming Active = 1
          case 2: return 'ended'; // Assuming Ended = 2
          case 3: return 'shares'; // Assuming SharesSubmission = 3
          case 4: return 'complete'; // Assuming Complete = 4
          default: return 'unknown';
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
    // ... rest of script ...
  };

  // ... rest of script ...
</script>
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

    <!-- Reward Funding Section (for Session Owner) -->
    <div v-if="blockchainProviderService.isConnected() && isSessionOwner && isSessionActiveForFunding" class="admin-section reward-funding-section">
      <h3>Fund Reward Pool</h3>
      <p>As the session owner, you can add funds to the reward pool.</p>
      <div class="form-group">
        <label for="reward-amount">Amount in ETH to Add:</label>
        <input 
          type="number" 
          id="reward-amount" 
          v-model="rewardAmountToAdd" 
          placeholder="e.g., 0.5" 
          min="0.000001" 
          step="any" 
          class="form-input"
        />
      </div>
      <button @click="fundRewardPool" class="btn primary" :disabled="fundingLoading">
        {{ fundingLoading ? 'Processing Funding...' : 'Fund Rewards' }}
      </button>
      <p v-if="fundingError" class="error-message">{{ fundingError }}</p>
      <p v-if="fundingLoading" class="loading-message-inline">Please wait for the transaction to confirm...</p>
    </div>

    <!-- Registration section OR message - updated v-if -->
    <template v-if="vote && vote.status === 'RegistrationOpen'">
      <div v-if="isCheckingStatus" class="loading-message">Checking registration status...</div>
      <RegisterToVote 
        v-else-if="!isRegisteredForVote"
        :vote-session-id="vote.id"
        :vote-session-address="voteSessionAddress"
        :end-date="vote.endDate"
        :reward-pool="vote.rewardPool"
        :required-deposit="vote.requiredDeposit"
        @registration-successful="handleRegistrationSuccess"
      />
      <div v-else class="status-message info">
        You are registered for this vote.
      </div>
    </template>

    <!-- Voting section - Pass updated isRegisteredForVote -->
    <CastYourVote 
      v-if="vote && ['RegistrationOpen', 'VotingOpen'].includes(vote.status)"
      :vote-id="vote.id"
      :vote-session-address="voteSessionAddress"
      :options="vote.options"
      :end-date="vote.endDate"
      :status="vote.status"
      :is-registered="isRegisteredForVote"
      :displayHint="displayHint"
      :sliderConfig="sliderConfig"
      :existingThreshold="vote.requiredKeys || 0"
    />

    <!-- Submit Secret Share section -->
    <SubmitSecretShare
      v-if="vote && isRegisteredForVote && vote.status === 'ShareCollectionOpen'"
      :vote-id="vote.id"
      :vote-session-address="voteSessionAddress"
      :end-date="vote.endDate"
    />

    <!-- Submit Decryption Value Section (New) -->
    <div 
      v-if="vote && isRegisteredForVote && vote.status === 'ShareCollectionOpen' && !hasSubmittedDecryptionValue"
      class="voting-section"
    >
      <h3>Submit Decryption Value</h3>
      <p>Submit your value to help decrypt the results.</p>
       <!-- Add Password Input Here -->
       <div class="form-group">
            <label for="decval-password">Enter Vote Session Key Password:</label>
            <input 
              type="password" 
              id="decval-password" 
              v-model="decryptionPassword"
              placeholder="Password used during registration"
              required
              class="form-input"
            />
          </div>
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
      v-if="vote && isRegisteredForVote && hasSubmittedDecryptionValue"
      class="status-message success"
    >
      <i class="icon check">✔️</i> You have submitted your decryption value.
    </div>

    <!-- Claim Deposit/Reward Section (New) -->
    <div 
      v-if="vote && isRegisteredForVote && canClaim"
      class="voting-section"
    >
        <h3>Claim Deposit/Reward</h3>
        <p>You are eligible to claim your refundable deposit and any potential rewards.</p>
        <div v-if="canClaim && (claimableDeposit !== '0' || claimableReward !== '0')" class="claimable-amounts">
          <p>Claimable Deposit: <strong>{{ claimableDeposit }} ETH</strong></p>
          <p>Claimable Reward: <strong>{{ claimableReward }} ETH</strong></p>
        </div>
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
        v-if="vote && isRegisteredForVote && hasClaimed"
        class="status-message success"
    >
        <i class="icon check">✔️</i> You have already claimed your deposit/reward for this session.
    </div>

    <!-- Results section - only shown for ended votes -->
    <VoteResults
      v-if="vote"
      :options="vote.options"
      :vote-id="vote.id"
      :vote-session-address="voteSessionAddress"
      :end-date="vote.endDate"
      :released-keys="vote.releasedKeys"
      :required-keys="vote.requiredKeys"
      :displayHint="displayHint"
      :sliderConfig="sliderConfig"
    />

  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
  import { voteSessionApi, participantApi } from '@/services/api'
  import Cookies from 'js-cookie'
  import CastYourVote from '@/components/vote/CastYourVote.vue'
  import VoteResults from '@/components/vote/VoteResults.vue'
  import RegisterToVote from '@/components/vote/RegisterToVote.vue'
  import SubmitSecretShare from '~/components/vote/SubmitSecretShare.vue'
  import { decryptWithPassword } from '@/services/utils/aesUtils.js'
  import { calculateDecryptionValue } from '@/services/utils/cryptographyUtils.js'

  // Add new service imports
  import { blockchainProviderService } from '@/services/blockchainProvider.js';
  import { factoryService } from '@/services/contracts/factoryService.js'; // Assuming this is the new one
  import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
  import { registryFundService } from '@/services/contracts/registryFundService.js';
  import { voteSessionVotingService } from '@/services/contracts/voteSessionVotingService.js'; // Added for submitMyDecryptionValue
  import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js'; // Added for owner check & other view functions

  // Import the new date utility
  import { normaliseTs } from '~/utils/date.js'; // Adjust path if Nuxt alias is different (e.g., @/utils/date.js)

  // Import new composables
  import { useSessionTimer } from '~/composables/useSessionTimer.js';
  import { useVoteSessionData } from '~/composables/useVoteSessionData.js'; // Adjust path if Nuxt alias is different

  // --- Initialize Composables ---
  const {
    loading, error, vote, voteSessionAddress, participantRegistryAddress,
    actualIsRegistered, hasSubmittedDecryptionValue, hasClaimed, canClaim,
    isCheckingStatus, claimableDeposit, claimableReward, isSessionOwner,
    displayHint, sliderConfig, fetchVoteData
  } = useVoteSessionData();

  const { 
    timeRemaining, 
    timerLabel, 
    formatDateTime 
  } = useSessionTimer(vote); 

  // --- Computed Properties ---
  const isRegisteredForVote = computed(() => actualIsRegistered.value);

  const isRegisteredHolderForVote = computed(() => {
    if (!vote.value) return false;
    const isHolderCookie = `vote_${vote.value.id}_isHolder`;
    return Cookies.get(isHolderCookie) === 'true';
  });

  const isSessionActiveForFunding = computed(() => {
    if (!vote.value || !vote.value.status) return false;
    // Define statuses where funding is no longer allowed
    const terminalStatuses = ['Completed', 'Aborted', 'Cancelled', 'DecryptionOpen']; // DecryptionOpen might be too late too
    return !terminalStatuses.includes(vote.value.status);
  });

  // --- Refs for actions still managed by this component ---
  const decryptionPassword = ref('');
  const submitDecryptionValueLoading = ref(false);
  const submitDecryptionValueError = ref(null);
  const claimLoading = ref(false);
  const claimError = ref(null);
  const rewardAmountToAdd = ref('');
  const fundingLoading = ref(false);
  const fundingError = ref(null);

  // --- Lifecycle Hooks ---
  onMounted(async () => {
    await fetchVoteData(); 
  });

  // onBeforeUnmount is handled by useSessionTimer for its interval

  // --- Methods ---

  // Placeholder for registration success handler
  const handleRegistrationSuccess = () => {
    console.log('Vote session page: Registration successful event received!');
    fetchVoteData(false); 
  };

  // getEncryptedSessionSK remains here as it uses localStorage directly for now
  async function getEncryptedSessionSK(voteSessionId) {
    const storedKeyHex = localStorage.getItem(`vote_${voteSessionId}_encrypted_sk_hex`); 
    if (!storedKeyHex) {
      console.error("Encrypted SK hex string not found for session:", voteSessionId);
      throw new Error("Encrypted secret key not found. Please ensure you registered correctly and stored the key.");
    }
    return storedKeyHex; 
  }

  const submitMyDecryptionValue = async () => {
    if (!vote.value || !vote.value.id) {
        submitDecryptionValueError.value = "Vote session details are not loaded.";
        return;
    }
    if (!decryptionPassword.value) {
        submitDecryptionValueError.value = "Please enter your vote session key password.";
        return;
    }
    submitDecryptionValueLoading.value = true;
    submitDecryptionValueError.value = null;
    try {
        const voteIdForAction = vote.value.id; // Use id from vote ref
        const currentAccount = blockchainProviderService.getAccount();
        if (!currentAccount) {
            throw new Error("Wallet not connected or account not found.");
        }
        const encryptedSkHex = await getEncryptedSessionSK(voteIdForAction);
        if (!encryptedSkHex) {
          throw new Error("Could not retrieve complete encrypted key information string.");
        }
        const secretKeyHex = await decryptWithPassword(encryptedSkHex, decryptionPassword.value); 
        if (!secretKeyHex) {
            throw new Error("Failed to decrypt the secret key. Please check your password.");
        }
        const decryptionValue = await calculateDecryptionValue(secretKeyHex); 
        const tx = await voteSessionVotingService.submitDecryptionValue(voteSessionAddress.value, decryptionValue);
        await tx.wait(); 
        hasSubmittedDecryptionValue.value = true; // This ref is from useVoteSessionData
        decryptionPassword.value = ''; 
    } catch (err) {
        console.error("Error submitting decryption value:", err);
        submitDecryptionValueError.value = `Error: ${err.message || 'An unexpected error occurred.'}`;
    } finally {
        submitDecryptionValueLoading.value = false;
    }
  };

  const submitClaim = async () => {
    if (!vote.value || !vote.value.id || !canClaim.value) { // canClaim is from useVoteSessionData
      claimError.value = "Not eligible to claim or vote details not loaded.";
      return;
    }
    claimLoading.value = true;
    claimError.value = null;
    try {
      const voteIdForAction = vote.value.id;
      const currentAccount = blockchainProviderService.getAccount();
      if (!currentAccount) {
        throw new Error("Wallet not connected or account not found.");
      }
      let depositTx, rewardTx;
      if (claimableDeposit.value !== '0' && claimableDeposit.value !== '0.0') { 
        depositTx = await registryParticipantService.claimDeposit(voteIdForAction);
        await depositTx.wait();
      }
      if (claimableReward.value !== '0' && claimableReward.value !== '0.0') { 
        rewardTx = await registryFundService.claimReward(voteIdForAction);
        await rewardTx.wait();
      }
      if (depositTx || rewardTx) {
          // If any claim was successful, update relevant state from useVoteSessionData
          hasClaimed.value = true; 
          canClaim.value = false; 
          // Consider re-fetching or directly setting claimable amounts to 0 if appropriate
          // fetchVoteData(false); // Or just update local view if backend isn't instantly consistent
          claimableDeposit.value = '0'; // Assuming these are correctly updated by the composable upon re-fetch or should be manually reset here for UI
          claimableReward.value = '0';
      }
    } catch (err) {
      console.error("Error submitting claim:", err);
      claimError.value = `Claim Error: ${err.message || 'An unexpected error occurred.'}`;
    } finally {
      claimLoading.value = false;
    }
  };

  const fundRewardPool = async () => {
    if (!rewardAmountToAdd.value || parseFloat(rewardAmountToAdd.value) <= 0) {
      fundingError.value = "Please enter a valid positive amount to fund.";
      return;
    }
    if (!isSessionOwner.value) { // isSessionOwner from useVoteSessionData
      fundingError.value = "Only the session owner can fund the reward pool.";
      return;
    }
    fundingLoading.value = true;
    fundingError.value = null;
    try {
      const amountInEth = String(rewardAmountToAdd.value);
      const amountInWei = blockchainProviderService.parseEther(amountInEth);
      const tx = await registryFundService.addRewardFunding(vote.value.id, amountInWei);
      rewardAmountToAdd.value = ''; 
      fetchVoteData(false); // Re-fetch to update reward pool display
    } catch (err) {
      console.error("Error funding reward pool:", err);
      fundingError.value = `Failed to fund reward pool: ${err.message || 'Unknown error'}`;
    } finally {
      fundingLoading.value = false;
    }
  };

  // Ensure all imports are used or remove unused ones (e.g. useRoute if not directly used here anymore)
  // Keep blockchainProviderService if parseEther is still used locally (it is for fundRewardPool)
  // Keep contract services if action handlers remain in this file (they do)
  // Keep aesUtils and cryptographyUtils if their functions are used here (they are for submitMyDecryptionValue)

</script>

<style lang="scss" scoped>
/* Styles will be moved to _session-detail.scss or _vote-details.scss later */
.loading, .error-message {
  text-align: center;
  padding: 2rem;
}
// ... existing styles ...
</style>
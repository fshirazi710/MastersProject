<template>
  <div class="results-section">
    <h2>Results</h2>

    <!-- Conditional Rendering of States -->
    <ResultsPending 
      v-if="!isDecrypted && !submissionFailed"
      :releasedKeys="internalReleasedKeys" 
      :requiredKeys="internalRequiredKeys"
      :votingStatusText="votingStatusText"
      :submissionDeadline="submissionDeadline"
    />
    
    <DecryptionFailed 
      v-else-if="submissionFailed && !isDecrypted"
      :releasedKeys="internalReleasedKeys"
      :requiredKeys="internalRequiredKeys"
      :error="error" 
    />

    <ResultsDisplay 
      v-else-if="isDecrypted"
      :tallyResults="tallyResults"
      :totalVotes="totalVotes"
      :displayHint="props.displayHint"
      :sliderConfig="props.sliderConfig"
      :error="error" 
      :options="props.options"
    />

    <!-- Holder Status and Claim Section (Rendered Separately) -->
    <HolderStatusAndClaim 
      :voteId="props.voteId"
      :sessionStatus="votingStatusText"
      :voteSessionAddress="props.voteSessionAddress"
    /> 

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
// Remove old service import
// import { voteSessionService } from '~/services/contracts/ethersService.js';
// Add new service import
import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js';
// --- Import Chart.js components --- 
// import { Bar } from 'vue-chartjs'
// import { 
//     Chart as ChartJS, 
//     Title, 
//     Tooltip, 
//     Legend, 
//     BarElement, 
//     CategoryScale, 
//     LinearScale 
// } from 'chart.js'

// --- Register Chart.js components --- 
// ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
// ------------------------------------

// Import the new child components
import ResultsPending from './ResultsPending.vue';
import DecryptionFailed from './DecryptionFailed.vue';
import ResultsDisplay from './ResultsDisplay.vue';
import HolderStatusAndClaim from './HolderStatusAndClaim.vue';

const props = defineProps({
  options: {
    type: Array,
    required: true
  },
  voteId: {
    type: [String, Number],
    required: true
  },
  voteSessionAddress: {
    type: String,
    required: true
  },
  releasedKeys: {
    type: Number,
    required: true
  },
  requiredKeys: {
    type: Number,
    required: true
  },
  // --- Add metadata props ---
  displayHint: {
    type: String,
    default: null
  },
  sliderConfig: {
    type: Object,
    default: null
  }
  // -------------------------
})

const loading = ref(false);
const isDecrypted = ref(false);
const tallyResults = ref({});
const totalVotes = ref(0);
const error = ref(null);
const votingEnded = ref(false);
const submissionDeadlinePassed = ref(false);
const submissionFailed = ref(false);
const submissionDeadline = ref(null);
let statusCheckInterval = null;

// --- Internal state mirroring props (in case props update late) ---
const internalReleasedKeys = ref(props.releasedKeys);
const internalRequiredKeys = ref(props.requiredKeys);

watch(() => props.releasedKeys, (newVal) => { internalReleasedKeys.value = newVal; });
watch(() => props.requiredKeys, (newVal) => { internalRequiredKeys.value = newVal; });

// --- Computed Property for Status Text (Passed to Pending component) ---
const votingStatusText = computed(() => {
  if (submissionFailed.value) return 'failed';
  if (isDecrypted.value) return 'complete';
  if (!votingEnded.value) return 'active';
  if (!submissionDeadlinePassed.value) return 'shares';
  return 'ended';
});

onMounted(() => {
  checkStatusAndTriggerDecryption();
  
  if (!isDecrypted.value && !submissionFailed.value) {
    statusCheckInterval = setInterval(checkStatusAndTriggerDecryption, 30000); 
  }
})

onUnmounted(() => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
})

watch([() => props.releasedKeys, () => props.requiredKeys], () => {
  console.log(`VoteResults: Props changed: Released ${props.releasedKeys}/${props.requiredKeys}. Re-checking status.`);
  checkStatusAndTriggerDecryption();
});

const checkStatusAndTriggerDecryption = async () => {
  const sessionId = Number(props.voteId);
  if (isNaN(sessionId)) {
      error.value = "Invalid Vote ID for status check.";
      return;
  }

  try {
      console.log(`VoteResults: Checking status for session ${props.voteId} using address ${props.voteSessionAddress}...`);
      const sessionInfo = await voteSessionViewService.getSessionInfo(props.voteSessionAddress);
      const submittedSharesCount = props.releasedKeys;
      internalReleasedKeys.value = submittedSharesCount;
      
      const requiredThreshold = sessionInfo ? sessionInfo.minShareThreshold : props.requiredKeys;
      internalRequiredKeys.value = requiredThreshold;
      
      if (!sessionInfo || requiredThreshold <= 0) {
          console.warn(`VoteResults: Could not get session info or valid threshold for session ${sessionId}. Cannot determine status accurately.`);
          error.value = "Could not retrieve essential session information.";
          if (statusCheckInterval) clearInterval(statusCheckInterval);
        return;
    }

    const now = new Date();
      const endDateTime = new Date(sessionInfo.endDate * 1000);
      const sharesEndDateTime = new Date(sessionInfo.sharesEndDate * 1000);
      submissionDeadline.value = sharesEndDateTime;

    votingEnded.value = now > endDateTime;
      submissionDeadlinePassed.value = now > sharesEndDateTime;
      const enoughShares = submittedSharesCount >= requiredThreshold;

      console.log(`VoteResults Status Check: VotingEnded=${votingEnded.value}, DeadlinePassed=${submissionDeadlinePassed.value}, EnoughShares=${enoughShares} (${submittedSharesCount}/${requiredThreshold})`);

      if (votingEnded.value && enoughShares && !isDecrypted.value && !submissionFailed.value && !loading.value) {
          console.log("VoteResults: Conditions met. Triggering decryption...");
          await runDecryptionProcess();
      } else if (submissionDeadlinePassed.value && !enoughShares && !isDecrypted.value) {
          console.warn("VoteResults: Deadline passed with insufficient shares.");
        submissionFailed.value = true;
          error.value = "The share submission deadline passed before enough shares were collected.";
    }

    if (isDecrypted.value || submissionFailed.value) {
        if (statusCheckInterval) {
              console.log("VoteResults: Decryption complete or failed, stopping status checks.");
            clearInterval(statusCheckInterval);
              statusCheckInterval = null;
        }
    }

  } catch (err) {
      console.error("VoteResults: Error during status check:", err);
      error.value = `Failed to check session status: ${err.message}`; 
      if (statusCheckInterval) clearInterval(statusCheckInterval); 
      }
};

const runDecryptionProcess = async () => {
  if (loading.value || isDecrypted.value) {
    console.log(`VoteResults: Decryption already running or completed. Skipping.`);
    return;
  }

  console.log("VoteResults: Running decryption process...");
  loading.value = true;
  error.value = null;
  submissionFailed.value = false;
  tallyResults.value = {};
  totalVotes.value = 0;
  
  const sessionId = Number(props.voteId);
  if (isNaN(sessionId)) {
       error.value = "Invalid Vote ID for decryption.";
         loading.value = false;
         return;
    }

  try {
    console.warn("TODO: Implement data fetching using services for decryption!");
    const threshold = internalRequiredKeys.value;
    const submittedSharesCount = internalReleasedKeys.value;

    const allSharesData = Array(submittedSharesCount).fill({ holderAddress: '0x...', share: { x: '0', y: '0'} });
    const encryptedVotes = [ { c1: {x:'0', y:'0'}, c2: {x:'0', y:'0'} }, { c1: {x:'0', y:'0'}, c2: {x:'0', y:'0'} } ];

    if (submittedSharesCount < threshold) {
      throw new Error(`Not enough shares (${submittedSharesCount}) submitted for threshold (${threshold}). Should have been caught earlier.`);
    }

    console.warn("Decryption loop logic needs actual implementation using cryptography service.");
    const tempTally = props.options.reduce((acc, option) => { 
        acc[String(option)] = Math.floor(Math.random() * 10) + 1; 
        return acc; 
    }, {});
    tallyResults.value = tempTally;
    totalVotes.value = Object.values(tallyResults.value).reduce((sum, count) => sum + count, 0);
         isDecrypted.value = true;

  } catch (err) {
    console.error("VoteResults: Decryption process failed:", err);
    error.value = `Failed to decrypt results: ${err.message}`;
    isDecrypted.value = false;
    submissionFailed.value = true;
  } finally {
      loading.value = false;
      if (statusCheckInterval && (isDecrypted.value || submissionFailed.value)) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
      }
  }
};

</script>

<style lang="scss" scoped>
// Keep only styles relevant to the main container or general layout
.results-section {
  margin-top: 20px;
  /* Add other container styles if needed */
}

/* Remove styles that were moved to child components or SCSS file */

.error-message {
  /* Keep general error message style if used directly here for decryption errors */
  color: #dc3545; /* Use var(--danger) */
  margin-top: 10px;
  text-align: center; /* Center decryption errors */
}
</style>

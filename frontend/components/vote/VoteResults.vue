<template>
  <div class="results-section">
    <h2>Results</h2>

    <!-- Show pending state if not enough keys released -->
    <div v-if="!isDecrypted && !submissionFailed" class="decryption-pending">
      <div class="pending-message">
        <div class="lock-container">
          <i class="lock-icon">🔒</i>
        </div>
        <h3>Results are still encrypted</h3>
        <p>Results will be available once:</p>
        <ul class="requirements-list">
          <li>
            <span class="requirement-label">Status:</span>
            <div class="requirement-status-container">
              <span class="requirement-status" :class="{ 'completed': votingEnded && submissionDeadlinePassed, 'warning': votingEnded && !submissionDeadlinePassed }">
                {{ votingStatusText }}
              </span>
            </div>
          </li>
          <li>
            <span class="requirement-label">Secret shares:</span>
            <div class="requirement-status-container">
              <span class="requirement-status" :class="{ 'completed': props.releasedKeys >= props.requiredKeys }">
                {{ props.releasedKeys }}/{{ props.requiredKeys }} released
              </span>
              <div class="shares-progress">
                <div class="shares-progress-bar" :style="{ width: `${props.requiredKeys > 0 ? (props.releasedKeys / props.requiredKeys) * 100 : 0}%` }"></div>
              </div>
            </div>
          </li>
        </ul>
        <p v-if="!submissionDeadlinePassed" class="check-back">
          Please check back after the share submission deadline ({{ submissionDeadline ? submissionDeadline.toLocaleString() : 'Calculating...' }}) to see the final results.
        </p>
        <p v-else class="check-back">
          Checking for results...
        </p>
      </div>
    </div>

    <!-- Show failed state -->
    <div v-if="submissionFailed && !isDecrypted" class="decryption-pending decryption-failed">
      <div class="pending-message">
        <div class="lock-container">
          <i class="lock-icon">❌</i> <!-- Failure Icon -->
        </div>
        <h3>Decryption Failed</h3>
        <p>The required number of secret shares ({{ props.requiredKeys }}) were not submitted before the deadline.</p>
        <p>Released: {{ props.releasedKeys }} / {{ props.requiredKeys }}</p>
        <p class="check-back">The results for this vote cannot be displayed.</p>
        <p v-if="error" class="error-message">{{ error }}</p> <!-- Display specific error if available -->
      </div>
    </div>

    <!-- Show results when decrypted -->
    <div v-if="isDecrypted" class="results-display">
      
      <!-- Standard Options Results (Bar Chart) -->
      <template v-if="!displayHint || displayHint === 'options'">
         <h3>Vote Results</h3>
          <div v-for="(votes, option) in decryptedVoteCounts" :key="option" class="result-item">
            <div class="result-header">
              <span class="option-text">{{ option }}</span>
            </div>
            <div class="progress-bar">
              <div 
                class="progress" 
                :style="{ width: `${totalVotes > 0 ? (votes / totalVotes) * 100 : 0}%` }"
              ></div>
            </div>
            <div class="percentage">
              {{ totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '0.0' }}% ({{ votes }} votes)
            </div>
          </div>
      </template>

      <!-- Slider Results (Distribution Chart & Average) -->
      <template v-if="displayHint === 'slider'">
        <h3>Voting Distribution</h3>
        <div v-if="distributionChartData.labels?.length > 0">
            <Bar 
                id="distribution-chart"
                :options="distributionChartOptions"
                :data="distributionChartData"
            />
        </div>
        <div v-if="sliderAverage !== null" class="average-result">
            Average Selected Value: <strong>{{ sliderAverage.toFixed(2) }}</strong>
        </div>
        <div v-if="totalVotes > 0" class="total-votes-slider">
           Total Votes Cast: {{ totalVotes }}
        </div>
        <div v-else>
            <p>No votes cast yet.</p>
        </div>
      </template>

      <!-- Display error if decryption succeeded partially -->
       <p v-if="error && isDecrypted" class="error-message" style="text-align: center;">{{ error }}</p>

      <!-- Redirect user to exit questionnaire -->
      <div class="encryption-notice">
        <i class="lock-icon">🎉</i>
        <p>Click below to complete the exit questionnaire and see if you've won</p>
      </div>

      <button class="btn primary">
        <a href="https://forms.office.com/e/iB5pshF3k2" style="color: inherit; text-decoration: none;">Complete Questionnaire</a>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { voteApi, shareApi, electionApi } from '@/services/api';
import { recomputeKey, AESDecrypt } from '@/services/cryptography';

// --- Import Chart.js components --- 
import { Bar } from 'vue-chartjs'
import { 
    Chart as ChartJS, 
    Title, 
    Tooltip, 
    Legend, 
    BarElement, 
    CategoryScale, 
    LinearScale 
} from 'chart.js'

// --- Register Chart.js components --- 
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
// ------------------------------------

const props = defineProps({
  options: {
    type: Array,
    required: true
  },
  voteId: {
    type: String,
    required: true
  },
  endDate: {
    type: String,
    required: false,
    default: null
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
  },
  totalSecretHolders: {
    type: Number,
    required: true
  }
  // -------------------------
})

const isDecrypted = ref(false);
const decryptedVoteCounts = ref({});
const totalVotes = ref(0);
const error = ref(null);
const votingEnded = ref(false);
const submissionDeadlinePassed = ref(false);
const submissionFailed = ref(false);
const submissionDeadline = ref(null);
let statusCheckInterval = null;

// --- New refs for slider results --- 
const sliderAverage = ref(null);
const distributionData = ref({ labels: [], datasets: [] });
// ---------------------------------

// --- Computed Property for Status Text ---
const votingStatusText = computed(() => {
  if (submissionFailed.value) return 'Ended, Submission Failed (Insufficient Keys)';
  if (!votingEnded.value) return 'In progress';
  if (!submissionDeadlinePassed.value) return 'Ended, Share Submission Open (15 min)';
  // If deadline passed and not failed (implies enough keys)
  return 'Ended, Share Submission Closed';
});

// --- Chart.js Options --- 
const distributionChartData = computed(() => {
    if (props.displayHint !== 'slider' || !isDecrypted.value) {
        return { labels: [], datasets: [] };
    }
    
    const labels = Object.keys(decryptedVoteCounts.value).sort((a, b) => Number(a) - Number(b)); // Sort numerically
    const data = labels.map(label => decryptedVoteCounts.value[label] || 0); // Ensure count is number

    return {
        labels: labels,
        datasets: [
            {
                label: 'Votes per Value',
                backgroundColor: '#42b983', // Example color
                borderColor: '#42b983',
                borderWidth: 1,
                data: data
            }
        ]
    };
});

const distributionChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false, // Adjust as needed
  scales: {
      y: {
          beginAtZero: true,
          ticks: { // Ensure only integers are shown on y-axis
            stepSize: 1
          },
          title: {
              display: true,
              text: 'Number of Votes'
          }
      },
      x: {
           title: {
              display: true,
              text: 'Selected Value'
          }
      }
  },
  plugins: {
      legend: {
          display: false // Hide legend for single dataset
      },
       tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += context.parsed.y + ' votes';
                    }
                    return label;
                }
            }
        }
  }
});
// ----------------------

onMounted(() => {
  checkStatusAndDecrypt();
  if (!submissionDeadlinePassed.value || (!isDecrypted.value && !submissionFailed.value)) {
    statusCheckInterval = setInterval(checkStatusAndDecrypt, 30000);
  }
})

onUnmounted(() => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
})

watch([() => props.releasedKeys, () => props.requiredKeys], ([newReleased, newRequired], [oldReleased, oldRequired]) => {
    if (newReleased !== oldReleased || newRequired !== oldRequired) {
        console.log(`Key counts changed: Released ${newReleased}/${newRequired}`);
        if (submissionDeadlinePassed.value && !isDecrypted.value && !submissionFailed.value) {
            console.log("Key count changed after deadline passed. Re-checking status and attempting decryption if possible.");
            checkStatusAndDecrypt();
        }
    }
});

watch(isDecrypted, (newValue) => {
  if (newValue && props.displayHint === 'slider') {
    calculateSliderAverage();
  }
});

const calculateSliderAverage = () => {
    if (Object.keys(decryptedVoteCounts.value).length === 0 || totalVotes.value === 0) {
        sliderAverage.value = 0; // Default to 0 if no votes
        return;
    }

    let weightedSum = 0;
    for (const optionStr in decryptedVoteCounts.value) {
        const optionNum = Number(optionStr);
        const count = decryptedVoteCounts.value[optionStr];
        if (!isNaN(optionNum) && typeof count === 'number') {
            weightedSum += optionNum * count;
        }
    }
    sliderAverage.value = totalVotes.value > 0 ? weightedSum / totalVotes.value : 0;

    storeRewardTokenValue(sliderAverage.value)
};


const storeRewardTokenValue = async (numOfTokens) => {
  await electionApi.submitRewardTokenValue(props.voteId, numOfTokens);
}

const checkStatusAndDecrypt = async () => {
  if (props.endDate) {
    const now = new Date();
    const endDateTime = new Date(props.endDate);
    const deadlineTime = new Date(endDateTime.getTime() + 15 * 60000); // Add 15 minutes
    submissionDeadline.value = deadlineTime; // Store it

    votingEnded.value = now > endDateTime;
    submissionDeadlinePassed.value = now > deadlineTime;

    // --- Check if ready for decryption --- 
    const enoughKeys = props.releasedKeys >= props.requiredKeys;
    const allHoldersSubmitted = props.totalSecretHolders > 0 && props.releasedKeys === props.totalSecretHolders;
    const canDecryptEarly = votingEnded.value && enoughKeys && allHoldersSubmitted;
    const canDecryptAfterDeadline = submissionDeadlinePassed.value && enoughKeys;

    if (!isDecrypted.value && !submissionFailed.value) { // Only proceed if not already done or failed
      if (canDecryptEarly) {
        console.log("Voting ended and all secret holders submitted shares. Attempting decryption early...");
        await decryptVotes();
        if (statusCheckInterval) clearInterval(statusCheckInterval);
      } else if (canDecryptAfterDeadline) {
        console.log("Submission deadline passed with enough keys. Attempting decryption...");
        await decryptVotes();
        if (statusCheckInterval) clearInterval(statusCheckInterval);
      } else if (submissionDeadlinePassed.value && !enoughKeys) {
        // Deadline passed, but not enough keys
        submissionFailed.value = true;
        console.warn("Submission deadline passed with insufficient keys.");
        if (statusCheckInterval) clearInterval(statusCheckInterval); // Stop checking if failed
      }
      // If none of the above conditions are met, the interval continues
    }
    else { // Already decrypted or failed
         if (statusCheckInterval) clearInterval(statusCheckInterval);
    }

  } else {
    // No end date logic (remains the same)
    votingEnded.value = false;
    submissionDeadlinePassed.value = false;
    submissionFailed.value = false;
    if (statusCheckInterval) clearInterval(statusCheckInterval);
  }
};

const decryptVotes = async () => {
  if (props.releasedKeys < props.requiredKeys) {
      console.warn("Attempted decryption without enough keys.");
      error.value = "Cannot decrypt results: Not enough secret shares have been released.";
      submissionFailed.value = true; // Mark as failed if attempted under threshold
      return;
  }
  if (isDecrypted.value) {
    console.log("Already decrypted, skipping redundant attempt.");
    return;
  }

  console.log("Starting decryption process...");
  decryptedVoteCounts.value = {};
  totalVotes.value = 0;
  sliderAverage.value = null;
  error.value = null;

  try {
    const sharesResponse = await shareApi.getShares(props.voteId);
    const votesInfoResponse = await voteApi.getVoteInformation(props.voteId);

    const indexes = sharesResponse.data[0];
    const shares = sharesResponse.data[1];
    const votesInfo = votesInfoResponse.data.data;

    if (!indexes || !shares || !votesInfo) {
        throw new Error("Incomplete share or vote information received from API.");
    }

    if (!(shares[0] && shares[0].length >= props.requiredKeys)) {
       console.warn("Not enough shares released for decryption (checked again inside decryptVotes).");
       error.value = "Cannot decrypt results: Not enough secret shares have been released.";
       submissionFailed.value = true; // Mark as failed
       return;
     }

    const currentDecryptedCounts = {};
    let currentTotalVotes = 0;
    let decryptionErrors = 0;

    for (const voteIndexStr in shares) {
        const voteIndex = parseInt(voteIndexStr, 10);
        if (isNaN(voteIndex)) continue; // Skip if key is not a valid index

        const voteMetadata = votesInfo.find(v => v.vote_id === voteIndex);
        if (!voteMetadata) {
            console.warn(`Missing vote metadata for index ${voteIndex}, skipping decryption.`);
            decryptionErrors++; // Count missing metadata as an error for this vote index
            continue;
        }

        const currentShares = shares[voteIndexStr];
        const currentIndexes = indexes[voteIndexStr];
        

        // --- Remove Debugging Logs ---
        // console.log(`--- Processing Vote Index: ${voteIndex} ---`);
        // console.log("Raw API Indexes for this vote:", indexes[voteIndexStr]);
        // console.log("Raw API Shares for this vote:", shares[voteIndexStr]);
        // console.log("Extracted Current Indexes:", currentIndexes);
        // console.log("Extracted Current Shares:", currentShares);
        // console.log("Vote Metadata (Threshold, Alphas etc.):", voteMetadata);
        // -------------------------

        if (!currentShares || !currentIndexes || currentShares.length < voteMetadata.threshold) {
             console.warn(`Insufficient shares/indexes provided for vote index ${voteIndex}, skipping.`);
             decryptionErrors++; // Count insufficient data as an error
             continue;
        }

        const shareBigInts = currentShares.map(share => {
             try {
                // Handle potential '0x' prefix
                return BigInt(share.startsWith('0x') ? share : '0x' + share);
            } catch(e) {
                console.error(`Failed to convert share '${share}' to BigInt for index ${voteIndex}:`, e);
                // Throw error or handle? For now, throw to make it clear
                throw new Error(`Invalid share format '${share}' for BigInt conversion.`);
            }
        });

        try {
             if (!currentIndexes || !shareBigInts || !voteMetadata.alphas || voteMetadata.threshold === undefined) {
                console.error("Missing critical data for recomputeKey:",
                    { currentIndexes, shareBigIntsExists: !!shareBigInts, alphasExist: !!voteMetadata.alphas, threshold: voteMetadata.threshold }
                );
                throw new Error(`Cannot recompute key for vote index ${voteIndex} due to missing data.`);
            }

            const key = await recomputeKey(currentIndexes, shareBigInts, voteMetadata.alphas, voteMetadata.threshold);
            const decryptedResult = await AESDecrypt(voteMetadata.ciphertext, key);

            currentDecryptedCounts[decryptedResult] = (currentDecryptedCounts[decryptedResult] || 0) + 1;
            currentTotalVotes++;
        } catch (decErr) {
            console.error(`Failed to decrypt vote at index ${voteIndex}:`, decErr);
            decryptionErrors++;
        }
    } // End for loop

    // --- Final Result Handling ---
    decryptedVoteCounts.value = currentDecryptedCounts;
    totalVotes.value = currentTotalVotes;

    if (currentTotalVotes > 0 && decryptionErrors === 0) {
         // Only consider fully successful if all votes decrypted (or attempted) without error
         isDecrypted.value = true;
         console.log("Decryption successful.");
         error.value = null; // Clear any previous error messages if now successful
     } else if (decryptionErrors > 0) {
         // Handle partial or total failure
         const totalVoteSets = Object.keys(shares).length;
         error.value = `Could not decrypt ${decryptionErrors} out of ${totalVoteSets} vote set(s). Results shown may be incomplete.`;
         console.warn(error.value);
         isDecrypted.value = false; // Explicitly set to false on error
         // If any decryption failed, consider the overall submission failed if we reached this point after deadline
         if (submissionDeadlinePassed.value) {
            submissionFailed.value = true;
         }
     } else if (currentTotalVotes === 0 && decryptionErrors === 0) {
         // No votes cast, but no errors?
         console.log("Decryption process completed, but no votes were found/decrypted.");
         isDecrypted.value = true; // Consider it "decrypted" in the sense that the process finished.
         error.value = null;
     }


  } catch (fetchError) {
    console.error("Failed to fetch data for vote decryption:", fetchError);
    error.value = "Failed to load data required to show results.";
    isDecrypted.value = false;
    submissionFailed.value = true; // Mark failed on fetch error too
  }
};

</script>

<style lang="scss" scoped>
/* Use SASS variables if defined globally, otherwise use CSS vars or fallback values */
$spacing-xs: 5px;
$spacing-sm: 10px;
$spacing-md: 15px;
$spacing-lg: 20px;

:root {
    --background-light: #f8f9fa;
    --border-radius: 4px;
    --text-secondary: #6c757d;
    --info-light: #e2f3ff;
    --info-dark: #0c5460;
    --info: #17a2b8;
    --success-light: #d4edda;
    --success-dark: #155724;
    --success: #28a745;
    --warning-light: #fff3cd;
    --warning-dark: #856404;
    --warning: #ffc107;
    --danger-light: #f8d7da;
    --danger-dark: #721c24;
    --danger: #dc3545;
}

.results-display {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.result-header {
  font-weight: bold;
  margin-bottom: 5px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease-in-out;
}

.percentage {
  font-size: 14px;
  color: #333;
}

.loading-message {
  text-align: center;
}

.winner-check-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.email-form {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px; /* Limit width */
}

.success-message {
  color: var(--success);
  font-weight: bold;
  margin-top: 10px;
}

.error-message {
  color: var(--danger);
  margin-top: 10px;
}

.requirements-list {
  text-align: left;
  margin: 15px auto;
  padding-left: 0;
  list-style: none;
  max-width: 360px;
}

.requirements-list li {
  margin-bottom: 15px;
  line-height: 1.4;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.requirement-label {
  font-weight: 500;
  flex-shrink: 0;
}

.requirement-status-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-grow: 1;
}

.requirement-status {
  color: var(--warning);
  text-align: right;
}

.requirement-status.completed {
  color: var(--success);
  font-weight: 500;
}

.shares-progress {
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 5px;
  width: 100px;
}

.shares-progress-bar {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.5s ease;
}

.lock-container {
  margin-bottom: 15px;
}

.lock-icon {
  font-size: 40px;
  display: inline-block;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.check-back {
  margin-top: 15px;
  font-style: italic;
  color: var(--text-muted);
}

.decryption-pending {
  background-color: var(--light-bg);
  border-radius: var(--border-radius);
  padding: 30px 20px;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}

.average-result {
    margin-top: $spacing-md; /* SCSS variable */
    font-size: 1.1em;
    text-align: center;
    padding: $spacing-sm; /* SCSS variable */
    background-color: var(--background-light); /* CSS variable */
    border-radius: var(--border-radius); /* CSS variable */
}

.total-votes-slider {
    margin-top: $spacing-xs; /* SCSS variable */
    font-size: 0.9em;
    text-align: center;
    color: var(--text-secondary); /* CSS variable */
}

/* Ensure chart has a defined height */
#distribution-chart {
    max-height: 400px; /* Or use a variable */
    margin: $spacing-md 0; /* SCSS variable */
}

.decryption-failed .lock-icon {
  color: var(--danger); /* Use danger color for failed state */
  animation: none; /* Optional: disable animation for failed state */
}

.requirement-status.warning {
    color: var(--warning); /* Indicate submission window open */
}
</style>

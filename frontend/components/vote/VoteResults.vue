<template>
  <div class="results-section">
    <h2>Results</h2>

    <!-- Show pending state if not enough keys released -->
    <div v-if="!isDecrypted" class="decryption-pending">
      <div class="pending-message">
        <div class="lock-container">
          <i class="lock-icon">🔒</i>
        </div>
        <h3>Results are still encrypted</h3>
        <p>Results will be available once:</p>
        <ul class="requirements-list">
          <li>
            <span class="requirement-label">Voting period:</span>
            <div class="requirement-status-container">
              <span class="requirement-status" :class="{ 'completed': votingEnded }">
                {{ votingEnded ? 'Ended' : 'In progress' }}
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
        <p class="check-back">Please check back later to see the final results.</p>
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

      <!-- Winner Check Section (Common for both types) -->
      <div v-if="!isWinner && !emailSent" class="encryption-notice">
        <i class="lock-icon">🎉</i>
        <p>To check if you've won, click the button. If you're a winner, enter your email to claim your prize!</p>
        <button @click="checkWinners" type="submit" class="btn primary" :disabled="loading">
          {{ loading ? 'Checking...' : "See If I'm a Winner" }}
        </button>
        <!-- Display Status Message after checking -->
        <p v-if="winnerCheckStatusMessage" :class="{ 'success-message': isWinner, 'error-message': error || !isWinner }">
          {{ winnerCheckStatusMessage }}
        </p>
      </div>
    </div>

    <!-- Email Form (Common for both types) -->
    <div v-if="showEmailForm" class="winner-form">
        <p>Congratulations! Enter your email below to claim your prize.</p>
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            v-model="formData.email" 
            required 
            class="form-input"
            placeholder="Enter your email"
          >
        </div>
        <button @click="submitEmail" class="btn primary" :disabled="loading">
          {{ loading ? 'Submitting...' : 'Claim Prize' }}
        </button>
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { voteApi, shareApi, electionApi } from '@/services/api';
import { getPublicKeyFromPrivate, recomputeKey, AESDecrypt } from '@/services/cryptography';
import Cookies from 'js-cookie';

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
  }
  // -------------------------
})

const loading = ref(false);
const isDecrypted = ref(false);
const isWinner = ref(false);
const emailSent = ref(false);
const decryptedVoteCounts = ref({});
const totalVotes = ref(0);
const formData = ref({ email: '' });
const voteResults = ref('');
const winnerInfo = ref('');
const error = ref(null);
const showEmailForm = ref(false);
const winnerCheckStatusMessage = ref('');
const votingEnded = ref(false);

// --- New refs for slider results --- 
const sliderAverage = ref(null);
const distributionData = ref({ labels: [], datasets: [] });
// ---------------------------------

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

onMounted(async () => {
  checkVotingPeriodStatus();
  await decryptVotes();
})

// Watch for decryption completion to calculate slider average
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
};

const checkVotingPeriodStatus = () => {
  if (props.endDate) {
    votingEnded.value = new Date() > new Date(props.endDate);
  } else {
    // If no end date provided, assume not ended (or handle as error?)
    votingEnded.value = false; 
  }
};

const submitEmail = async () => {
  if (!formData.value.email) {
    alert("Please enter your email address.");
    return;
  }
  // Add logic to submit email via API
  try {
    // Assuming an API endpoint exists
    const response = await electionApi.submitEmail(props.voteId, { email: formData.value.email });
    alert(response.data.message || "Email submitted successfully!");
    showEmailForm.value = false; // Hide form after submission
  } catch (err) {
    console.error("Failed to submit email:", err);
    alert(err.response?.data?.message || err.message || "Failed to submit email.");
  }
};

const checkWinners = async () => {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  winnerCheckStatusMessage.value = ''; // Clear previous status
  isWinner.value = false; // Reset winner status
  showEmailForm.value = false; // Hide email form initially

  try {
    // Retrieve the vote-specific private key
    const privateKeyCookie = `vote_${props.voteId}_privateKey`;
    const privateKeyHex = Cookies.get(privateKeyCookie);

    if (!privateKeyHex) {
      throw new Error('Private key not found for this vote. Cannot check results/rewards.');
    }

    // Get the current user's public key
    const currentUserPublicKeyHex = getPublicKeyFromPrivate(privateKeyHex);

    // Prepare data for the API call 
    const requestData = {
      requesterPublicKey: currentUserPublicKeyHex, 
    };
    
    // Call the API endpoint to check/get winners
    const response = await electionApi.checkWinners(props.voteId, requestData);

    if (response.data.success) {
      const winnersList = response.data.data.results || [];
      // Check if the current user is in the winners list
      const currentUserIsWinner = winnersList.includes(currentUserPublicKeyHex);

      if (currentUserIsWinner) {
        isWinner.value = true;
        showEmailForm.value = true; // Show email form
        winnerCheckStatusMessage.value = 'Congratulations! You are one of the winners!';
      } else {
        winnerCheckStatusMessage.value = 'Sorry, you were not selected as a winner this time.';
      }
      // Store general results info if needed elsewhere
      voteResults.value = winnersList; 
      winnerInfo.value = response.data.data.winnerInfo || '';

      // --- REMOVED generic alert --- 
      // alert(response.data.message || 'Successfully checked results.');
    } else {
      throw new Error(response.data.message || 'Failed to retrieve results.');
    }

  } catch (err) {
    console.error('Failed to retrieve winner information:', err);
    error.value = err.message || 'Failed to check winner status. Please try again.';
    winnerCheckStatusMessage.value = error.value; // Show error message
    // alert(error.value); // Avoid alert if showing message in component
  } finally {
    loading.value = false;
  }
};

const decryptVotes = async () => {
  isDecrypted.value = false; // Reset state initially
  decryptedVoteCounts.value = {};
  totalVotes.value = 0;
  sliderAverage.value = null;
  error.value = null; // Clear previous errors

  try {
    const sharesResponse = await shareApi.getShares(props.voteId);
    const votesInfoResponse = await voteApi.getVoteInformation(props.voteId);

    const indexes = sharesResponse.data[0];
    const shares = sharesResponse.data[1];
    const votesInfo = votesInfoResponse.data.data;

    if (!indexes || !shares || !votesInfo) {
        throw new Error("Incomplete share or vote information received from API.");
    }

    // Check if enough shares are available based on required prop
    // Assuming shares[0] corresponds to the first (and likely only) ciphertext set for a simple vote
    if (!(shares[0] && shares[0].length >= props.requiredKeys)) {
      console.warn("Not enough shares released for decryption.");
      isDecrypted.value = false; // Keep as false
      return; // Exit early
    }

    const currentDecryptedCounts = {};
    let currentTotalVotes = 0;
    let decryptionErrors = 0;

    // Iterate through the different sets of shares (usually just one, index 0)
    for (const voteIndexStr in shares) {
        const voteIndex = parseInt(voteIndexStr, 10);
        if (isNaN(voteIndex)) continue; // Skip if key is not a valid index

        // Find the corresponding vote metadata (ciphertext, alphas, threshold)
        const voteMetadata = votesInfo.find(v => v.vote_id === voteIndex);
        if (!voteMetadata) {
            console.warn(`Missing vote metadata for index ${voteIndex}, skipping decryption.`);
            continue;
        }

        const currentShares = shares[voteIndexStr];
        const currentIndexes = indexes[voteIndexStr];
        
        if (!currentShares || !currentIndexes || currentShares.length < voteMetadata.threshold) {
             console.warn(`Insufficient shares/indexes provided for vote index ${voteIndex}, skipping.`);
             continue;
        }

        // Use only the required number of shares
        const shareArray = currentShares.slice(0, voteMetadata.threshold);
        const shareBigInts = shareArray.map(share => BigInt("0x" + share));
        const slicedIndexes = currentIndexes.slice(0, voteMetadata.threshold);

        try {
            const key = await recomputeKey(slicedIndexes, shareBigInts, voteMetadata.alphas, voteMetadata.threshold);
            const decryptedResult = await AESDecrypt(voteMetadata.ciphertext, key);
            
            currentDecryptedCounts[decryptedResult] = (currentDecryptedCounts[decryptedResult] || 0) + 1;
            currentTotalVotes++;
        } catch (decErr) {
            console.error(`Failed to decrypt vote at index ${voteIndex}:`, decErr);
            decryptionErrors++;
            // Decide how to handle individual decryption errors - skip vote?
        }
    }
    
    if (currentTotalVotes > 0 || decryptionErrors > 0) {
       // Consider decryption successful if at least one vote decrypted, even with errors
       isDecrypted.value = true; 
    }
    
    decryptedVoteCounts.value = currentDecryptedCounts;
    totalVotes.value = currentTotalVotes;

    if (decryptionErrors > 0) {
        error.value = `Could not decrypt ${decryptionErrors} vote(s). Results shown may be incomplete.`;
        console.warn(error.value);
    }
    
    // Average calculation is triggered by the watcher watching isDecrypted

  } catch (fetchError) {
    console.error("Failed to fetch data for vote decryption:", fetchError);
    error.value = "Failed to load data required to show results.";
    isDecrypted.value = false;
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
</style>

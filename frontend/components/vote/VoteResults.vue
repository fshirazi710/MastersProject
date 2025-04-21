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
         <h3>Tally Results</h3>
          <div v-for="(count, option) in tallyResults" :key="option" class="result-item">
            <div class="result-header">
              <span class="option-text">{{ option }}</span>
            </div>
            <div class="progress-bar">
              <div 
                class="progress" 
                :style="{ width: `${totalVotes > 0 ? (count / totalVotes) * 100 : 0}%` }"
              ></div>
            </div>
            <div class="percentage">
              {{ totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0' }}% ({{ count }} votes)
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
    </div>

    <!-- Holder Status Section -->
    <div v-if="!isCheckingHolderStatus && isHolder" class="holder-status-section">
      <h3>Your Holder Status</h3>
      <ul>
        <li>
          <span class="status-label">Deposit Amount:</span>
          <span class="status-value">{{ holderDeposit }} ETH</span>
        </li>
        <li>
          <span class="status-label">Share Submitted:</span>
          <span class="status-value">
            {{ didHolderSubmitShare ? 'Yes' : 'No' }}
            <span v-if="didHolderSubmitShare" class="status-icon">✅</span>
            <span v-else class="status-icon">❌</span>
          </span>
        </li>
        <li>
          <span class="status-label">Reward Eligibility:</span>
          <span class="status-value">
             {{ didHolderSubmitShare ? 'Eligible' : 'Not Eligible' }}
             <span v-if="didHolderSubmitShare" class="status-icon">🏆</span>
             <span v-else class="status-icon"></span>
          </span>
        </li>
         <li>
          <span class="status-label">Deposit Refund Eligibility:</span>
          <span class="status-value">
             {{ didHolderSubmitShare ? 'Eligible' : 'Not Eligible' }}
             <span v-if="didHolderSubmitShare" class="status-icon">↩️</span>
             <span v-else class="status-icon"></span>
          </span>
        </li>
        <li>
          <span class="status-label">Reward Distribution:</span>
          <span class="status-value">{{ rewardDistributionStatus }}</span>
        </li>
        <!-- Add Claim Deposit button here -->
        <li v-if="didHolderSubmitShare && parseFloat(holderDeposit) > 0">
            <span class="status-label">Deposit Action:</span>
            <span class="status-value">
                <button 
                  @click="claimDepositHandler" 
                  class="btn secondary btn-sm" 
                  :disabled="isClaimingDeposit"
                >
                  {{ isClaimingDeposit ? 'Processing...' : 'Claim Deposit' }}
                </button>
            </span>
        </li>
        <li v-if="claimError" class="error-message-li">
            <small>{{ claimError }}</small>
        </li>
      </ul>
    </div>
    <div v-else-if="isCheckingHolderStatus">
        <p>Checking your holder status...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { shareApi, voteSessionApi, encryptedVoteApi } from '@/services/api';
import { recomputeKey, AESDecrypt } from '@/services/cryptography';
// --- Import ethers --- 
import { ethers } from 'ethers'; 
// --- Re-import ethersService --- 
import { ethersService } from '@/services/ethersService.js';
import { config } from '@/config';

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
const tallyResults = ref({});
const totalVotes = ref(0);
const voteResults = ref('');
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

// --- New refs for holder status ---
const isHolder = ref(false);
const holderDeposit = ref('0'); // Store as string formatted ETH
const didHolderSubmitShare = ref(false);
const rewardDistributionStatus = ref('Unknown'); // e.g., Pending, Distributed, Failed
const isCheckingHolderStatus = ref(false);
const currentAccount = ref(null);
// --- Add loading state for claim button ---
const isClaimingDeposit = ref(false);
const claimError = ref(null); // Specific error ref for claiming
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
    
    const labels = Object.keys(tallyResults.value).sort((a, b) => Number(a) - Number(b));
    const data = labels.map(label => tallyResults.value[label] || 0);

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
  checkStatusAndDecryptVotes();
  // Also check holder status on mount
  checkHolderStatus(); 
  if (!submissionDeadlinePassed.value || (!isDecrypted.value && !submissionFailed.value)) {
    statusCheckInterval = setInterval(checkStatusAndDecryptVotes, 30000);
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
            checkStatusAndDecryptVotes();
        }
    }
});

watch(isDecrypted, (newValue) => {
  if (newValue && props.displayHint === 'slider') {
    calculateSliderAverage();
  }
});

const calculateSliderAverage = () => {
    if (Object.keys(tallyResults.value).length === 0 || totalVotes.value === 0) {
        sliderAverage.value = 0; // Default to 0 if no votes
        return;
    }

    let weightedSum = 0;
    for (const optionStr in tallyResults.value) {
        const optionNum = Number(optionStr);
        const count = tallyResults.value[optionStr];
        if (!isNaN(optionNum) && typeof count === 'number') {
            weightedSum += optionNum * count;
        }
    }
    sliderAverage.value = totalVotes.value > 0 ? weightedSum / totalVotes.value : 0;
};

const checkStatusAndDecryptVotes = async () => {
  if (props.endDate) {
    const now = new Date();
    const endDateTime = new Date(props.endDate);
    const deadlineTime = new Date(endDateTime.getTime() + 15 * 60000); // Add 15 minutes
    submissionDeadline.value = deadlineTime; // Store it

    votingEnded.value = now > endDateTime;
    submissionDeadlinePassed.value = now > deadlineTime;

    // --- Revised Logic for Decryption Trigger ---
    const enoughKeys = props.releasedKeys >= props.requiredKeys;

    if (votingEnded.value && enoughKeys && !isDecrypted.value && !submissionFailed.value) {
        // Voting ended and threshold met: Attempt decryption NOW, even if deadline hasn't passed.
        console.log("Voting ended and threshold met. Attempting decryption...");
        await decryptSubmittedVotes();
        // If decryption succeeds (isDecrypted becomes true), the interval will be cleared below.
        // If it fails cryptographically here, error handling within decryptSubmittedVotes applies.
    }
    // --- End Revised Logic ---
    
    // --- Logic for Final Submission Failure (Only check AFTER deadline) ---
    if (submissionDeadlinePassed.value) {
      if (!enoughKeys && !isDecrypted.value) { // Check if deadline passed WITHOUT enough keys
        submissionFailed.value = true;
        console.warn("Submission deadline passed with insufficient keys.");
        // Interval will be cleared below because submissionFailed is true.
      } 
      // If deadline passed and we already decrypted or already failed, interval will also be cleared.
    }
    // --- End Failure Logic ---

    // --- Clear Interval Logic ---
    // Stop checking interval if decryption succeeded OR if submission deadline passed and failed.
    if (isDecrypted.value || submissionFailed.value) {
        if (statusCheckInterval) {
            console.log("Clearing status check interval (decrypted or failed).");
            clearInterval(statusCheckInterval);
            statusCheckInterval = null; // Good practice to nullify
        }
    }
    // --- End Clear Interval Logic ---

    /* --- OLD Logic Block (for reference) ---
    if (submissionDeadlinePassed.value) {
      if (props.releasedKeys < props.requiredKeys && !isDecrypted.value) { 
        submissionFailed.value = true;
        console.warn("Submission deadline passed with insufficient keys.");
        if (statusCheckInterval) clearInterval(statusCheckInterval); 
      } else if (props.releasedKeys >= props.requiredKeys && !isDecrypted.value && !submissionFailed.value) {
         console.log("Submission deadline passed with enough keys. Attempting decryption...");
         await decryptSubmittedVotes(); 
         if (statusCheckInterval) clearInterval(statusCheckInterval);
      } else {
          if (statusCheckInterval) clearInterval(statusCheckInterval);
      }
    } 
    */

  } else {
    // No end date, treat as not ended.
    votingEnded.value = false;
    submissionDeadlinePassed.value = false;
    submissionFailed.value = false;
    if (statusCheckInterval) clearInterval(statusCheckInterval); // Stop checking if no date
  }
};

const checkHolderStatus = async () => {
  currentAccount.value = ethersService.getAccount();
  if (!currentAccount.value) {
    console.log("Wallet not connected, cannot check holder status.");
    isHolder.value = false;
    return;
  }

  isCheckingHolderStatus.value = true;
  try {
    const statusResult = await ethersService.readContract(
        config.contract.address,
        config.contract.abi,
        'getHolderStatus',
        [parseInt(props.voteId), currentAccount.value]
    );

    // Assuming getHolderStatus returns [isActive, hasSubmitted, deposit]
    isHolder.value = statusResult[0];
    didHolderSubmitShare.value = statusResult[1];
    // Format deposit from Wei to ETH string
    holderDeposit.value = ethers.formatEther(statusResult[2]); 

    console.log(`Holder Status for ${currentAccount.value}: Active=${isHolder.value}, Submitted=${didHolderSubmitShare.value}, Deposit=${holderDeposit.value} ETH`);
    
    // --- Fetch reward distribution status --- 
    rewardDistributionStatus.value = await fetchRewardStatus();

  } catch (err) {
    console.error("Error checking holder status:", err);
    // Don't set a user-facing error, but reset state
    isHolder.value = false;
    didHolderSubmitShare.value = false;
    holderDeposit.value = '0';
  } finally {
    isCheckingHolderStatus.value = false;
  }
};

// --- NEW FUNCTION to fetch reward status ---
const fetchRewardStatus = async () => {
  try {
    console.log(`Fetching reward distribution status for session ${props.voteId}...`);
    const isDistributed = await ethersService.readContract(
      config.contract.address,
      config.contract.abi,
      'rewardsHaveBeenDistributed',
      [parseInt(props.voteId)]
    );
    console.log(`On-chain rewardsHaveBeenDistributed status: ${isDistributed}`);

    if (isDistributed) {
      return 'Distributed';
    } else {
      // Check if submission deadline has passed to differentiate between pending and potentially failed/not run
      if (submissionDeadlinePassed.value) {
        return 'Pending Distribution Call'; // Deadline passed, but function not called/completed
      } else {
        return 'Pending Submission Deadline'; // Deadline hasn't passed yet
      }
    }
  } catch (err) {
    console.error("Error fetching reward distribution status:", err);
    return 'Error Checking Status'; // Return specific error string
  }
};

const claimDepositHandler = async () => {
  if (!currentAccount.value || !isHolder.value || !didHolderSubmitShare.value || parseFloat(holderDeposit.value) <= 0) {
    claimError.value = "Cannot claim deposit: Conditions not met.";
    return;
  }

  isClaimingDeposit.value = true;
  claimError.value = null;
  try {
    console.log(`Attempting to claim deposit for election ${props.voteId} by ${currentAccount.value}`);
    
    const contractArgs = [
      parseInt(props.voteId)
    ];

    const txOptions = {}; // No value needed for claim

    const txResponse = await ethersService.sendTransaction(
      config.contract.address,
      config.contract.abi,
      'claimDeposit',
      contractArgs,
      txOptions
    );

    console.log("Claim deposit transaction sent:", txResponse.hash);
    alert("Deposit claim transaction sent successfully! Waiting for confirmation...");

    // Optional: Wait for confirmation, then refresh status
    // await txResponse.wait(); 
    // console.log("Claim transaction confirmed.");
    // await checkHolderStatus(); // Refresh status after confirmation

    // For now, refresh status immediately after sending for quicker UI update
    // (though the deposit might not reflect 0 until confirmed on-chain)
    await checkHolderStatus();

  } catch (err) {
    console.error("Failed to claim deposit:", err);
    claimError.value = `Failed to claim deposit: ${err.message || 'Please try again.'}`;
    alert(claimError.value); // Also show error in alert
  } finally {
    isClaimingDeposit.value = false;
  }
};

const decryptSubmittedVotes = async () => {
  if (isDecrypted.value) {
    console.log("Already decrypted, skipping redundant attempt.");
    return;
  }

  console.log("Starting decryption process...");
  loading.value = true; // Indicate loading during decryption
  tallyResults.value = {};
  totalVotes.value = 0;
  sliderAverage.value = null;
  error.value = null; // Clear previous errors
  submissionFailed.value = false; // Reset failed status

  try {
    // Fetch necessary data from backend API
    const [sharesResponse, votesInfoResponse] = await Promise.all([
      shareApi.getShares(props.voteId), 
      encryptedVoteApi.getEncryptedVoteInfo(props.voteId)
    ]);

    const sharesData = sharesResponse.data; // This is the list: [{vote_index, submitted_shares:[{...}]}, ...]
    const votesInfo = votesInfoResponse.data.data; // This is the list: [{id, vote_id, ciphertext, g1r, g2r, alphas, voter, threshold}, ...]

    if (!sharesData || !votesInfo) {
        throw new Error("Incomplete share or vote information received from API.");
    }

    // Check if *any* vote index has enough shares before proceeding (improves initial check)
    const hasEnoughSharesForAny = sharesData.some(voteShareInfo => 
        voteShareInfo.submitted_shares && voteShareInfo.submitted_shares.length >= props.requiredKeys
    );

    if (!hasEnoughSharesForAny) {
         console.warn("Not enough shares released for decryption (checked after fetching API data).");
         error.value = "Cannot decrypt results: Not enough secret shares have been released.";
         submissionFailed.value = true; // Mark as failed
         loading.value = false;
         return;
    }

    const currentDecryptedCounts = {};
    let currentTotalVotes = 0;
    let decryptionErrors = 0;

    // Iterate through the votes that have been submitted (from votesInfo)
    for (const voteMetadata of votesInfo) {
        const voteIndex = voteMetadata.vote_id;

        // Find the corresponding shares for this vote index from the sharesData
        const shareInfoForVote = sharesData.find(s => s.vote_index === voteIndex);

        if (!shareInfoForVote || !shareInfoForVote.submitted_shares || shareInfoForVote.submitted_shares.length < voteMetadata.threshold) {
            console.warn(`Insufficient shares found for vote index ${voteIndex} (Need ${voteMetadata.threshold}, Got ${shareInfoForVote?.submitted_shares?.length || 0}). Skipping.`);
            decryptionErrors++;
            continue; // Skip to the next voteMetadata
        }

        // --- REVISED SHARE SELECTION LOGIC ---
        const threshold = voteMetadata.threshold;
        const alphas = voteMetadata.alphas || []; // Ensure alphas is an array
        const allSubmittedShares = shareInfoForVote.submitted_shares;

        // 1. Determine indices needing alphas
        const alphaIndicesNeeded = new Set();
        for (let i = 0; i < alphas.length; i++) {
            alphaIndicesNeeded.add(threshold + 1 + i);
        }

        // 2. Filter submitted shares into eligible groups
        const thresholdShares = allSubmittedShares.filter(s => s.share_index <= threshold);
        const alphaShares = allSubmittedShares.filter(s => alphaIndicesNeeded.has(s.share_index));
        
        // 3. Check if enough *eligible* shares were submitted
        if (thresholdShares.length + alphaShares.length < threshold) {
            console.warn(`Insufficient *eligible* shares for vote index ${voteIndex}. Need ${threshold}, Eligible Threshold Shares: ${thresholdShares.length}, Eligible Alpha Shares: ${alphaShares.length}. Skipping.`);
            decryptionErrors++;
            continue;
        }

        // 4. Construct the final list of shares to use for reconstruction
        let sharesToUse = [];
        sharesToUse = sharesToUse.concat(thresholdShares);
        // Add needed alpha shares until threshold is met
        let alphaSharesToAdd = threshold - sharesToUse.length;
        if (alphaSharesToAdd > 0) {
            sharesToUse = sharesToUse.concat(alphaShares.slice(0, alphaSharesToAdd));
        }
        // Ensure we didn't exceed threshold (e.g., if thresholdShares > threshold initially)
        if (sharesToUse.length > threshold) {
             sharesToUse = sharesToUse.slice(0, threshold);
        }
        // ----------------------------------------

        // --- Ensure exactly threshold shares were selected --- 
        if (sharesToUse.length !== threshold) {
            console.error(`Logic error: Failed to select exactly ${threshold} shares for vote index ${voteIndex}. Selected: ${sharesToUse.length}. Skipping.`);
            decryptionErrors++;
            continue;
        }
        // --------------------------------------------------

        // Extract indexes and shares IN ORDER from the *correctly selected* subset
        const currentIndexes = sharesToUse.map(s => s.share_index); 
        const currentSharesHex = sharesToUse.map(s => 
             s.share_value.startsWith('0x') ? s.share_value : `0x${s.share_value}` // Ensure 0x prefix
        );
        const shareBigInts = currentSharesHex.map(share => {
             try {
                return BigInt(share);
            } catch(e) {
                console.error(`Failed to convert share '${share}' to BigInt for index ${voteIndex}:`, e);
                throw new Error(`Invalid share format '${share}' for BigInt conversion.`);
            }
        });

        // --- Double check we have enough shares AFTER slicing (Redundant after above check, but safe) ---
        if (currentIndexes.length < threshold || shareBigInts.length < threshold) {
            console.warn(`Logic error: Not enough shares selected for vote index ${voteIndex} after final selection. Need ${threshold}, Got ${currentIndexes.length}. Skipping.`);
            decryptionErrors++;
            continue;
        }
        // ------------------------------------------------------

        try {
             if (!currentIndexes || !shareBigInts || !alphas || threshold === undefined) { // Use the potentially empty 'alphas' from top
                console.error("Missing critical data for recomputeKey:",
                    { currentIndexes, shareBigIntsExists: !!shareBigInts, alphasExist: !!alphas, threshold: threshold }
                );
                throw new Error(`Cannot recompute key for vote index ${voteIndex} due to missing data.`);
            }

            // Call recomputeKey with correctly extracted data
            const aesCryptoKey = await recomputeKey(currentIndexes, shareBigInts, alphas, threshold);
            
            // Decrypt the vote ciphertext
            const decryptedVoteString = await AESDecrypt(voteMetadata.ciphertext, aesCryptoKey);
            
            // Parse the decrypted vote string (assuming it's JSON like { vote: "Option A" })
            const decryptedVoteData = JSON.parse(decryptedVoteString); 
            const chosenOption = decryptedVoteData.vote; // Extract the actual vote choice

            // Tally the result
            if (chosenOption) {
                 currentDecryptedCounts[chosenOption] = (currentDecryptedCounts[chosenOption] || 0) + 1;
                 currentTotalVotes++;
            } else {
                 console.warn(`Decrypted vote for index ${voteIndex} did not contain a 'vote' property.`);
                 decryptionErrors++; // Count as error if format is wrong
            }

        } catch (decErr) {
            console.error(`Failed to decrypt vote at index ${voteIndex}:`, decErr);
            decryptionErrors++;
        }
    } // End for loop

    // --- Final Result Handling ---
    tallyResults.value = currentDecryptedCounts;
    totalVotes.value = currentTotalVotes;

    if (currentTotalVotes > 0 || (votesInfo.length === 0 && decryptionErrors === 0)) {
         // Consider success if at least one vote decrypted OR if there were no votes and no errors
         isDecrypted.value = true;
         console.log("Decryption process finished.");
         if (decryptionErrors > 0) {
             error.value = `Could not decrypt ${decryptionErrors} out of ${votesInfo.length} vote(s). Results shown may be incomplete.`;
             console.warn(error.value);
         } else {
             error.value = null; // Clear error if all succeeded
         }
     } else if (decryptionErrors > 0) {
         // Handle total failure (no votes decrypted, but there were errors)
         error.value = `Could not decrypt any of the ${votesInfo.length} vote(s).`;
         console.error(error.value);
         isDecrypted.value = false; 
         submissionFailed.value = true; // Mark overall as failed if errors occurred after deadline
     } else { 
         // Should not happen if votesInfo.length > 0, but handle defensively
         console.log("Decryption process completed, but no votes were successfully decrypted.");
         isDecrypted.value = false; 
         submissionFailed.value = true;
     }

  } catch (fetchError) {
    console.error("Failed to fetch data or run decryption:", fetchError);
    error.value = "Failed to load data required to show results.";
    isDecrypted.value = false;
    submissionFailed.value = true; // Mark failed on fetch error too
  } finally {
      loading.value = false; // Ensure loading indicator stops
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

/* Add styles for holder status section */
.holder-status-section {
  margin-top: 30px;
  padding: 20px;
  background-color: var(--background-alt);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);

  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
  }

  .status-label {
    font-weight: 500;
  }

  .status-value {
    text-align: right;
  }

  .status-icon {
    margin-left: 5px;
  }
}

/* Style for claim error message within the list */
.error-message-li {
  justify-content: flex-end; /* Align error to the right */
  small {
    color: var(--danger);
  }
}

/* Smaller button variant */
.btn-sm {
    padding: 4px 8px;
    font-size: 0.85em;
}
</style>

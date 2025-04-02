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
              <span class="requirement-status" :class="{ 'completed': releasedSharesCount >= requiredSharesCount }">
                {{ releasedSharesCount }}/{{ requiredSharesCount }} released
              </span>
              <div class="shares-progress">
                <div class="shares-progress-bar" :style="{ width: `${(releasedSharesCount / requiredSharesCount) * 100}%` }"></div>
              </div>
            </div>
          </li>
        </ul>
        <p class="check-back">Please check back later to see the final results.</p>
      </div>
    </div>

    <!-- Show results as progress bars when decrypted -->
    <div v-if="isDecrypted" class="results-display">
      <div v-for="(votes, option) in decryptedVoteCounts" :key="option" class="result-item">
        <div class="result-header">
          <span class="option-text">{{ option }}</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress" 
            :style="{ width: `${(votes / totalVotes) * 100}%` }"
          ></div>
        </div>
        <div class="percentage">
          {{ ((votes / totalVotes) * 100).toFixed(1) }}% ({{ votes }} votes)
        </div>
      </div>
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

    <!-- Use showEmailForm for consistency with checkWinners logic -->
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
import { ref, onMounted } from 'vue';
import { voteApi, shareApi, electionApi } from '@/services/api';
import { getPublicKeyFromPrivate, recomputeKey, AESDecrypt } from '@/services/cryptography';
import Cookies from 'js-cookie';

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
  }
})

const loading = ref(false);
const isDecrypted = ref(false);  // Reactive state for isDecrypted
const isWinner = ref(false);  // Tracks if the user is a winner
const emailSent = ref(false);  // Track whether the email has been submitted
const decryptedVoteCounts = ref({});  // Store decrypted results
const totalVotes = ref(0);  // Total number of votes
const formData = ref({ email: '' });
const voteResults = ref('');
const winnerInfo = ref('');
const error = ref(null);
const showEmailForm = ref(false); // Control visibility of email form
const winnerCheckStatusMessage = ref(''); // Message to display after checking
const releasedSharesCount = ref(0);
const requiredSharesCount = ref(0);
const votingEnded = ref(false);

onMounted(async () => {
  // Check if voting period has ended
  checkVotingPeriodStatus();
  await decryptVotes();
})

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

const fetchVoteInformation = async () => {
  try {
    const response = await voteApi.getVoteInformation(props.voteId);
    return response.data.data;
  } catch (error) {
    console.error("Failed to retrieve vote information:", error);
    alert('Error retrieving vote information. Please try again.');
  }
}

const decryptVotes = async () => {
  try {
    const response = await shareApi.getShares(props.voteId);
    const votes = await fetchVoteInformation();

    const indexes = response.data[0];
    const shares = response.data[1];

    // Update share count information
    if (shares[0]) {
      releasedSharesCount.value = shares[0].length;
      requiredSharesCount.value = votes[0].threshold;
    }

    if (shares[0] && shares[0].length >= votes[0].threshold) {
      isDecrypted.value = true;
    } else {
      isDecrypted.value = false;
      return;
    }

    const decryptedResults = [];
    const voteOptions = [...props.options];

    for (let voteId in shares) {
      const shareArray = shares[voteId].slice(0, votes[voteId].threshold);
      const shareBigInts = shareArray.map(share => BigInt("0x" + share));
      const slicedIndexes = indexes[voteId].slice(0, votes[voteId].threshold);
      const vote = votes[voteId];

      const key = await recomputeKey(slicedIndexes, shareBigInts, vote.alphas, vote.threshold);
      
      const decryptedResponse = await AESDecrypt(vote.ciphertext, key);
      decryptedResults.push(decryptedResponse);
    }

    const voteCounts = {};

    voteOptions.forEach(option => {
      voteCounts[option] = 0;
    });

    // Count occurrences of each option in decryptedVotes
    decryptedResults.forEach(vote => {
      if (voteCounts.hasOwnProperty(vote)) {
        voteCounts[vote] += 1;
      }
    });

    decryptedVoteCounts.value = voteCounts;
    totalVotes.value = decryptedResults.length; // Calculate total votes
  } catch (error) {
    console.error("Failed to decrypt vote:", error);
    alert('Error decrypting vote. Please try again.');
  }
};

// Add method to check voting status
const checkVotingPeriodStatus = () => {
  if (props.endDate) {
    const endDateTime = new Date(props.endDate);
    const currentTime = new Date();
    votingEnded.value = currentTime >= endDateTime;
  } else {
    // If end date not available, fetch from API
    electionApi.getElection(props.voteId)
      .then(response => {
        if (response.data && response.data.data && response.data.data.end_date) {
          const endDateTime = new Date(response.data.data.end_date);
          const currentTime = new Date();
          votingEnded.value = currentTime >= endDateTime;
        }
      })
      .catch(error => {
        console.error("Failed to fetch election end date:", error);
      });
  }
}

</script>

<style scoped>
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
</style>

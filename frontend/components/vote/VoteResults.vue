<template>
  <div class="results-section">
    <h2>Results</h2>

    <!-- Show pending state if not enough keys released -->
    <div v-if="!isDecrypted" class="decryption-pending">
      <div class="pending-message">
        <i class="lock-icon">🔒</i>
        <h3>Results are still encrypted</h3>
        <p>Waiting for secret holders to release their secrets...</p>
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
          {{ loading ? 'Checking...' : 'See If I’m a Winner' }}
        </button>
      </div>
    </div>

    <div v-if="isWinner && !emailSent" class="winner-form">
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
  }
})

const loading = ref(false);
const isDecrypted = ref(false);  // Reactive state for isDecrypted
const isWinner = ref(false);  // Tracks if the user is a winner
const emailSent = ref(false);  // Track whether the email has been submitted
const decryptedVoteCounts = ref({});  // Store decrypted results
const totalVotes = ref(0);  // Total number of votes
const formData = ref({ email: '' });

onMounted(async () => {
  await decryptVotes();
})

const submitEmail = async () => {
  try {
    if (!formData.value.email) {
      alert("Please enter your email.");
      return;
    }

    const response = await electionApi.submitEmail(props.voteId, {
      email: formData.value.email,
    });
    console.log(response)
    alert(response.data.message)
    emailSent.value = true;
  } catch (error) {
    console.error("Error submitting email:", error);
    alert("An error occurred. Please try again.");
  }
};

const checkWinners = async () => {
  try {
    if (loading.value) return;
    loading.value = true;

    const privateKeyHex = Cookies.get("privateKey");

    if (!privateKeyHex) {
      throw new Error("No private key found. Please register first.");
    }

    const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex)
    
    const response = await electionApi.checkWinners(props.voteId, {public_key: publicKeyHex});

    if (response.data === true) {
      isWinner.value = true;
    } else {
      alert("Unfortunately, you didn't win this time.");
    }
  } catch (error) {
    console.error("Failed to retrieve vote information:", error);
    alert('Error retrieving vote information. Please try again.');
  } finally {
    loading.value = false;
  }
}

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
</style>

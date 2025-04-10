<template>
    <div class="container">
        <div class="voting-section">
            <h2>Check Raffle Winners</h2>
            <!-- Winner Check Section (Common for both types) -->
            <div v-if="!isWinner && !emailSent">
                <div class="encryption-notice">
                    <i class="lock-icon">🎉</i>
                    <p>To check if you've won, click the button. If you're a winner, enter your email to claim your prize!</p>
                </div>

                <button @click="checkWinners" type="submit" class="btn primary" :disabled="loading">
                    {{ loading ? 'Checking...' : "See If I'm a Winner" }}
                </button>
                    <!-- Display Status Message after checking -->
                <p v-if="winnerCheckStatusMessage" :class="{ 'success-message': isWinner, 'error-message': !isWinner && winnerCheckStatusMessage }">
                    {{ winnerCheckStatusMessage }}
                </p>
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
    </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { electionApi } from '@/services/api';
import { getPublicKeyFromPrivate } from '@/services/cryptography';
import Cookies from 'js-cookie';

const router = useRouter();
const route = useRoute();
const voteId = route.params.id;
const loading = ref(false);
const isWinner = ref(false);
const emailSent = ref(false);
const winnerCheckStatusMessage = ref('');
const showEmailForm = ref(false);
const formData = ref({ email: '' });
const winnerInfo = ref('');
const voteResults = ref('');
const error = ref(null);

const submitEmail = async () => {
  if (!formData.value.email) {
    alert("Please enter your email address.");
    return;
  }
  // Add logic to submit email via API
  try {
    // Assuming an API endpoint exists
    const response = await electionApi.submitEmail(voteId, { email: formData.value.email });
    alert(response.data.message || "Email submitted successfully!");
    showEmailForm.value = false; // Hide form after submission
    router.push('/');
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
    console.log(voteId)
    const privateKeyCookie = `vote_${voteId}_privateKey`;
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
    const response = await electionApi.checkWinners(voteId, requestData);

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
</script>

<style scoped>
.voting-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}
</style>
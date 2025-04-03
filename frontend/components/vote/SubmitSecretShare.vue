<template>
    <div class="voting-section">
        <h2>Submit Secret Share</h2>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
            <i class="lock-icon">🔒</i>
            <p>Clicking the button below will release your secret share. Be sure to come back later to check the results of the vote and see if you're one of the lucky winners of the vouchers!</p>
        </div>

        <!-- Show submission UI only if share hasn't been submitted -->
        <template v-if="!hasSubmittedShare">
            <button @click="generateSecretShare" type="submit" class="btn primary" :disabled="loading || !isSubmissionTime">
              {{ loading ? 'Submitting Share...' : 'Submit Secret Share' }}
            </button>
            <p v-if="error" class="error-message">{{ error }}</p>
        </template>

        <!-- Show thank you message if share has been submitted -->
        <div v-if="hasSubmittedShare" class="submitted-message">
            <i class="success-icon">✅</i>
            <p>Thank you! Your secret share has been successfully submitted.</p>
        </div>
    </div>
</template>

<script setup>
    import { voteApi, shareApi } from '@/services/api'
    import { getPublicKeyFromPrivate, generateShares, generateShares2 } from '@/services/cryptography';
    import Cookies from "js-cookie";
    import { ref, onMounted } from 'vue';

    const props = defineProps({
        voteId: {
        type: String,
        required: true
        },
        isSubmissionTime: {
            type: Boolean,
            required: true,
        },
    })

    const loading = ref(false);
    const error = ref(null);
    const successMessage = ref('');
    const hasSubmittedShare = ref(false);

    const shareSubmittedCookie = `vote_${props.voteId}_shareSubmitted`;

    onMounted(() => {
        if (Cookies.get(shareSubmittedCookie) === 'true') {
            hasSubmittedShare.value = true;
        }
    });

    const generateSecretShare = async () => {
        error.value = null;
        try {
            if (loading.value) return;
            loading.value = true;

            const secretShares = [];
            const privateKeyCookie = `vote_${props.voteId}_privateKey`;
            const privateKeyHex = Cookies.get(privateKeyCookie);

            if (!privateKeyHex) {
                throw new Error('Private key not found for this vote. Cannot generate share.');
            }

            const publicKey = getPublicKeyFromPrivate(privateKeyHex);
            const voteInformation = await fetchVoteInformation();

            for (const vote of voteInformation) {
                if (vote.g1r) {
                    const generatedShare = generateShares(vote.g1r, privateKeyHex);
                    secretShares.push({ vote_id: vote.vote_id, share: generatedShare });
                } else {
                    console.error("g1r is not set for vote ID:", vote.vote_id);
                }
            }

            if (secretShares.length > 0) {
                await submitSecretShares(secretShares, publicKey);
            } else {
                error.value = "No valid secret shares generated.";
            }
        } catch (err) {
            console.error("Failed to generate or submit secret share:", err);
            error.value = err.message || 'Error generating or submitting secret share. Please try again.';
        } finally {
            loading.value = false;
        }
    };


    const fetchVoteInformation = async () => {
        try {
            const response = await voteApi.getVoteInformation(props.voteId);
            return response.data.data
        } catch (error) {
            console.error("Failed to retrive vote information:", error);
            alert('Error retrieving vote information. Please try again.');
        }
    };

    const submitSecretShares = async (secretShares, publicKey) => {
        const response = await shareApi.submitShare(props.voteId, { shares: secretShares, public_key: publicKey });
        
        console.log("Submission response:", response.data);

        hasSubmittedShare.value = true;
        Cookies.set(shareSubmittedCookie, 'true', { expires: 365 });
    };
</script>

<style lang="scss" scoped>
/* Add specific styles for this component or import shared styles */
.voting-section {
  margin-top: 20px;
  padding: 20px;
  background-color: var(--background-light);
  border-radius: var(--border-radius);
}

.encryption-notice {
  margin-bottom: 15px;
  font-size: 0.95em;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    color: var(--warning); /* Or choose a suitable color */
  }
}

.success-message {
  color: var(--success);
  margin-top: 10px;
}

.error-message {
  color: var(--danger);
  margin-top: 10px;
}

/* Styles for the submitted message */
.submitted-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background-color: var(--success-light);
  border: 1px solid var(--success);
  border-radius: var(--border-radius);
  color: var(--success-dark);

  i {
    font-size: 1.2em;
    color: var(--success);
  }
}
</style>
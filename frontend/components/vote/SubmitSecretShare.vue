<template>
    <div class="voting-section">
        <h2>Submit Secret Share</h2>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
            <i class="lock-icon">🔒</i>
            <p>Clicking the button below will release your secret share. The deadline for submission is {{ submissionDeadline?.toLocaleString() }}.</p>
        </div>

        <!-- Show submission UI only if share hasn't been submitted -->
        <template v-if="!hasSubmittedShare">
            <!-- Message/Button before deadline -->
            <div v-if="!isDeadlinePassed">
                <button @click="generateSecretShare" type="submit" class="btn primary" :disabled="loading">
                  {{ loading ? 'Submitting Share...' : 'Submit Secret Share' }}
                </button>
                <p v-if="error" class="error-message">{{ error }}</p>
            </div>

            <!-- Message after deadline -->
            <div v-else class="deadline-passed-message">
                 <i class="late-icon">⏳</i>
                 <p>The deadline for submitting secret shares ({{ submissionDeadline?.toLocaleString() }}) has passed. You can no longer submit your share for this vote.</p>
            </div>
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
    import { ref, onMounted, computed } from 'vue';

    const props = defineProps({
        voteId: {
        type: String,
        required: true
        },
        endDate: {
            type: String, // Assuming ISO string format
            required: true,
            default: null
        }
    })

    const loading = ref(false);
    const error = ref(null);
    const successMessage = ref('');
    const hasSubmittedShare = ref(false);

    const shareSubmittedCookie = `vote_${props.voteId}_shareSubmitted`;

    // --- Deadline Calculation ---
    const submissionDeadline = computed(() => {
        if (!props.endDate) return null;
        try {
            const endDateTime = new Date(props.endDate);
            // Ensure valid date before calculation
            if (isNaN(endDateTime.getTime())) {
                throw new Error('Invalid endDate provided');
            }
            return new Date(endDateTime.getTime() + 15 * 60000); // Add 15 minutes
        } catch (e) {
            console.error("Error calculating submission deadline:", e);
            return null;
        }
    });

    const isDeadlinePassed = computed(() => {
        if (!submissionDeadline.value) return true; // Treat as passed if deadline can't be calculated
        return new Date() > submissionDeadline.value;
    });
    // ------------------------

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
            return []; // Return empty array on error
        }
    };

    const submitSecretShares = async (secretShares, publicKey) => {
        try {
            const response = await shareApi.submitShare(props.voteId, { shares: secretShares, public_key: publicKey });
            console.log("Submission response:", response.data);
            hasSubmittedShare.value = true;
            Cookies.set(shareSubmittedCookie, 'true', { expires: 365 });
        } catch (submitError) {
             console.error("Failed to submit secret shares:", submitError);
             error.value = submitError.response?.data?.message || submitError.message || 'Failed to submit shares to the server.';
             // Do not set hasSubmittedShare to true on error
        }
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

/* Styles for the deadline passed message */
.deadline-passed-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background-color: var(--warning-light); /* Or another appropriate color */
  border: 1px solid var(--warning);
  border-radius: var(--border-radius);
  color: var(--warning-dark);

  i.late-icon {
    font-size: 1.2em;
    color: var(--warning);
  }
}
</style>
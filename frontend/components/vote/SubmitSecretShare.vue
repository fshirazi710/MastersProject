<template>
    <div class="voting-section">
        <h2>Submit Secret Share</h2>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
            <i class="lock-icon">🔒</i>
            <p>Clicking the button below will release your secret share. Be sure to come back later to check the results of the vote and see if you’re one of the lucky winners of the vouchers!</p>
        </div>

        <button @click="generateSecretShare" type="submit" class="btn primary" :disabled="loading">
          {{ loading ? 'Submitting Share...' : 'Submit Secret Share' }}
        </button>
    </div>
</template>

<script setup>
    import { voteApi, shareApi } from '@/services/api'
    import { getPublicKeyFromPrivate, generateShares, generateShares2 } from '@/services/cryptography';
    import Cookies from "js-cookie";

    const loading = ref(false);

    const props = defineProps({
        voteId: {
        type: String,
        required: true
        },
    })

    const generateSecretShare = async () => {
        try {
            if (loading.value) return;
            loading.value = true;

            const secretShares = [];
            const privateKey = Cookies.get("privateKey");

            if (!privateKey) {
                throw new Error("No private key found. Please register first.");
            }

            const publicKey = getPublicKeyFromPrivate(privateKey);
            const voteInformation = await fetchVoteInformation();

            for (const vote of voteInformation) {
                if (vote.g1r) {
                    const generatedShare = generateShares(vote.g1r, privateKey);
                    secretShares.push({ vote_id: vote.vote_id, share: generatedShare });
                } else {
                    console.error("g1r is not set for vote ID:", vote.vote_id);
                }
            }

            if (secretShares.length > 0) {
                await submitSecretShares(secretShares, publicKey);
            } else {
                alert("No valid secret shares to submit.");
            }
        } catch (error) {
            console.error("Failed to generate secret share:", error);
            alert('Error generating secret share. Please try again.');
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
        try {
            const response = await shareApi.submitShare(props.voteId, { shares: secretShares, public_key: publicKey });
            alert(response.data.message || 'Secret share submitted successfully!');
        } catch (error) {
            if (error.response?.status === 400) {
                alert(error.response.data.detail);
            } else {
                console.error("Failed to submit secret shares:", error);
                alert('Error submitting secret shares. Please try again.');
            }
        }
    };
</script>
<template>
    <div class="voting-section">
        <h2>Submit Secret Share</h2>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
            <i class="lock-icon">🔒</i>
            <p>You can choose to be a secret holder, which means you are a part of making sure your vote remains secure.
            If you choose to become a secret holder, you will need to release your private key at the specified time.
            </p>
        </div>

        <button @click="getSecretShare" type="submit" class="btn primary">
          Get Secret Share
        </button>
        
        <button @click="decryptVotes" type="submit" class="btn primary">
          Decrypt Votes
        </button>
    </div>
</template>

<script setup>
    import { voteApi, shareApi } from '@/services/api'
    import { getPublicKeyFromPrivate, generateShares, generateShares2 } from '@/services/cryptography';
    import Cookies from "js-cookie";

    const props = defineProps({
        voteId: {
        type: String,
        required: true
        },
    })

    const getSecretShare = async () => {
        try {
            const secretShares = []

            const privateKey = Cookies.get("privateKey");

            if (!privateKey) {
                throw new Error("No private key found. Please register first.");
            }

            const publicKey = getPublicKeyFromPrivate(privateKey)
            
            const voteInformation = await fetchVoteInformation()            
            for (const vote in voteInformation) {
                if (voteInformation[vote].g1r) {
                    const generatedShare = generateShares(voteInformation[vote].g1r, privateKey)
                    const generatedShare2 = generateShares2(voteInformation[vote].g1r, privateKey)
                    // const verifiedShare = verifyShares(generatedShare, generatedShare2, publicKey, voteInformation[vote].g2r)
                    secretShares.push({vote_id: voteInformation[vote].vote_id, share: generatedShare})
                } else {
                    console.error("g1r is not set.");
                }
            }
            submitSecretShares(secretShares, publicKey)
        } catch (error) {
            console.error("Failed to submit secret share:", error);
            alert('Error submitting secret share. Please try again.');
        }
    }

    const fetchVoteInformation = async () => {
        try {
            const response = await voteApi.getVoteInformation(props.voteId);
            return response.data.data
        } catch (error) {
            console.error("Failed to retrive vote information:", error);
            alert('Error retrieving vote information. Please try again.');
        }
    }

    const submitSecretShares = async (secretShares, publicKey) => {
        try {
            const response = await shareApi.submitShare(props.voteId, {shares: secretShares, public_key: publicKey})
        } catch (error) {
            console.error("Failed to submit secret shares:", error);
            alert('Error submitting secret shares. Please try again.');
        }
    }
</script>
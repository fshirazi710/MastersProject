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
    </div>
</template>

<script setup>
    import { voteApi } from '@/services/api'
    import { recomputeKey, AESDecrypt, generateShares, getShares } from '@/services/cryptography';
    import Cookies from 'js-cookie';

    const props = defineProps({
        voteId: {
        type: String,
        required: true
        },
    })

    const getSecretShare = async () => {
        try {
            const secretShares = []
            // const privateKeyHex = Cookies.get("privateKey");

            // if (!privateKeyHex) {
            //     throw new Error("No private key found. Please register first.");
            // }
            const voteInformation = await fetchVoteInformation()
            const privateKeys = ["241ae400369b71889b94825a8790aa05d20711a10d4bf4cebaa6e26f8df4e7d9", "ffcad271d2b2e606839292697d7e0e7b102ee25b852a51147e6d8a05942fde1a", "76bb0ec1bb2c4027419781e3af38b0287c8f987a9f085550b6c373a20ce8b5e5", "b2d3f4a7fe81826dad4abc58a9eab526aaf976920b4c07a30d8fb9ad68ca0ac8"]
            for (const key in privateKeys) {
                console.log(key)
                for (const vote in voteInformation) {
                    const g1r = voteInformation[vote].g1r
                    if (g1r) {
                        secretShares.push(generateShares(g1r, privateKeys[key]))
                    } else {
                        console.error("g1r is not set.");
                    }
                }
            }
            console.log(secretShares)
            const key = await recomputeKey([1, 2, 3, 4], secretShares, voteInformation[0].alphas, voteInformation[0].threshold)

            // const key = recomputeKey([1, 2, 3, 4], secretShares, privateKeys, voteInformation[0].g1r, voteInformation[0].alphas, voteInformation[0].threshold)
            const response = AESDecrypt(voteInformation[0].ciphertext, key)
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
</script>
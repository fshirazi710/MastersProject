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
    import { AESDecrypt, generateShares, recomputeKey } from '@/services/cryptography';

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
            const privateKeys = ["b564c8fb0c5c5c45ce4b6bef4020e407ada126d66effba5ecf9147f1943e7760", "29c038d48b36541e6552233bd3bf3802aee1af2b7fa7ce721f44aadea26af5e8", "fa4208ed8a42413b5c954e7aa7c8fadd80702aa65df0cd0306f9f7d5003f9ff6"]
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
            const key = await recomputeKey([4, 5, 6], secretShares, voteInformation[0].alphas, voteInformation[0].threshold)

            // const key = recomputeKey([1, 2, 3, 4], secretShares, privateKeys, voteInformation[0].g1r, voteInformation[0].alphas, voteInformation[0].threshold)
            const response = AESDecrypt(voteInformation[0].ciphertext, key)
            console.log(response)
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
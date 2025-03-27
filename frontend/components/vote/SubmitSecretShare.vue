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
    import { AESDecrypt, generateShares } from '@/services/cryptography';

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
            const privateKeys = ["fdc566efcde86bcca560ba552524dd84301fdda8f167196ef94db825c6288ec7", "ce420317825080e56ff92a1f9996c63b6778d8b7f3fc4471c71d8240d30ba35e", "3a060591d3b26f291508ee8bcafa230f535e5fb1fa1c0ee9861171b6c996801f", "4aea3220d822266fc9ed22299a4137f72e852926a9565227ea5b9d56f9afc81"]
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
            // const response = AESDecrypt(voteInformation[0].ciphertext, key)
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
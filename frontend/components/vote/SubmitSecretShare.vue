<template>
    <div class="voting-section">
        <h2>Submit Secret Share</h2>
        <!-- Encryption notice to inform users -->
        <div class="encryption-notice">
            <i class="lock-icon">🔒</i>
            <p>Clicking the button below will prompt your wallet to sign and submit your secret share. Deadline: {{ submissionDeadline?.toLocaleString() }}.</p>
        </div>

        <!-- Show submission UI only if share hasn't been submitted -->
        <template v-if="!hasSubmittedShare">
            <!-- Message/Button before deadline -->
            <div v-if="!isDeadlinePassed">
                <button @click="prepareAndSubmitShare" type="submit" class="btn primary" :disabled="loading || !isWalletConnected">
                    <span v-if="!isWalletConnected">Connect Wallet First</span>
                    <span v-else-if="loading">{{ loadingMessage }}</span>
                    <span v-else>Submit Secret Share</span>
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
    import { ref, computed, onMounted, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { voteApi, shareApi } from '@/services/api';
    import { ethersService } from '~/services/ethersService.js'; // Use ethersService
    import { generateShares } from '@/services/cryptography.js'; // getPublicKeyFromPrivate removed
    import { config } from '@/config'; // Assuming config has contract address/abi
    import Cookies from "js-cookie"; // Still used for status cookie (TEMP - should be removed)
    import { ethers } from 'ethers'; // Import ethers for utils if needed (e.g., keccak256)
    import jsonStableStringify from 'fast-json-stable-stringify'; // For deterministic JSON stringify

    const props = defineProps({
        voteId: { type: String, required: true },
        endDate: { type: String, required: true }
    });

    const loading = ref(false);
    const loadingMessage = ref('Processing...');
    const error = ref(null);
    const hasSubmittedShare = ref(false);
    const isWalletConnected = ref(false);
    const currentAccount = ref(null);

    // TEMP: Still using cookie for initial check, should be replaced by contract check
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

    onMounted(async () => {
        // Check initial submission status from cookie (TEMP)
        if (Cookies.get(shareSubmittedCookie) === 'true') {
            hasSubmittedShare.value = true;
        }
        // Check wallet connection status
        try {
            // Attempt init gently, might already be connected
            if (ethersService.getAccount()) {
                 isWalletConnected.value = true;
                 currentAccount.value = ethersService.getAccount();
            } else {
                 // Optional: Automatically prompt connection? Or rely on user action.
            }
            // TODO: Replace cookie check with call to contract getHolderStatus via backend/api
        } catch (e) {
            console.warn("Wallet not connected on mount or init failed:", e);
            isWalletConnected.value = false;
        }
    });

    // Renamed function
    const prepareAndSubmitShare = async () => {
        error.value = null;
        if (loading.value || !isWalletConnected.value || !currentAccount.value) return;

        loading.value = true;
        loadingMessage.value = 'Fetching vote data...';

        try {
            // 1. Fetch necessary vote data (may contain g1r needed for share generation)
            //    NOTE: This relies on the cryptography service. If shares are pre-computed
            //    and stored elsewhere, this step changes.
            const voteInformation = await fetchVoteInformation();
            if (!voteInformation || voteInformation.length === 0) {
                throw new Error("Could not retrieve necessary vote information.");
            }

            // TEMP: Assuming private key is needed for generateShares
            // THIS IS THE CORE PROBLEM - PRIVATE KEY SHOULD NOT BE HERE
            // This part needs rethinking based on how shares are generated/retrieved
            // securely without exposing the private key to the frontend.
            // If shares were generated during registration and stored securely (e.g., localStorage
            // encrypted with a user password, or derived non-persistently), retrieve them here.
            // For now, we comment out the insecure parts and assume shares are available somehow.

            // const privateKeyCookie = `vote_${props.voteId}_privateKey`;
            // const privateKeyHex = Cookies.get(privateKeyCookie);
            // if (!privateKeyHex) {
            //     throw new Error('Private key not found for this vote.');
            // }

            // Generate shares (using placeholder - replace with secure retrieval/generation)
            loadingMessage.value = 'Generating shares...';
            const sharesToSubmit = [];
            for (const vote of voteInformation) {
                 if (vote.g1r) {
                    // TODO: Replace placeholder/insecure generation
                    // const generatedShare = generateShares(vote.g1r, privateKeyHex);
                    const placeholderShare = "0x" + vote.vote_id.toString().padStart(64, '0'); // Example placeholder
                    sharesToSubmit.push({ vote_id: vote.vote_id, share: placeholderShare });
                 } else {
                     console.error("g1r is not set for vote ID:", vote.vote_id);
                 }
            }

            if (sharesToSubmit.length === 0) {
                throw new Error("No shares could be generated or retrieved.");
            }

            // 2. Prepare data for signing and backend verification
            loadingMessage.value = 'Preparing data...';
            const holderAddress = currentAccount.value;
            const sortedShares = sharesToSubmit.sort((a, b) => a.vote_id - b.vote_id);
            const voteIndices = sortedShares.map(item => item.vote_id);
            const shareStrings = sortedShares.map(item => item.share);

            // Construct the message payload (must match backend)
            const messagePayload = `SubmitShares:${props.voteId}:${jsonStableStringify(voteIndices)}:${jsonStableStringify(shareStrings)}:${holderAddress}`;

            // 3. Sign the message using ethersService
            loadingMessage.value = 'Waiting for signature...';
            const signature = await ethersService.signMessage(messagePayload);

            // 4. Send data + signature to backend for verification
            loadingMessage.value = 'Verifying with server...';
            const verificationPayload = {
                shares: sortedShares,
                public_key: holderAddress,
                signature: signature
            };
            await shareApi.submitShare(props.voteId, verificationPayload); // submitShare now only verifies

            // 5. If backend verification is successful, send the actual transaction
            loadingMessage.value = 'Submitting transaction...';

            // Prepare arguments for the smart contract function
            // NOTE: Ensure shareIndices are correctly defined/retrieved if needed by contract
            // Assuming share index corresponds to vote index for simplicity here
            const shareIndices = sortedShares.map((item, index) => index + 1); // Placeholder for share index

            const contractArgs = [
                parseInt(props.voteId), // Ensure electionId is number
                voteIndices,           // uint256[] memory voteIndices
                shareIndices,          // uint256[] memory shareIndices
                shareStrings           // string[] memory shareDataList
            ];

            const txOptions = {}; // Add { value: ... } if needed

            const txResponse = await ethersService.sendTransaction(
                config.contract.address, // Get address from config
                config.contract.abi,     // Get ABI from config
                'submitShares',          // Contract method name
                contractArgs,            // Arguments
                txOptions                // Transaction options (e.g., value)
            );

            loadingMessage.value = 'Waiting for confirmation...';
            // Optional: Wait for confirmation
            // const receipt = await txResponse.wait();
            // console.log('Transaction confirmed:', receipt);

            hasSubmittedShare.value = true;
            Cookies.set(shareSubmittedCookie, 'true', { expires: 365 }); // TEMP: Set cookie on tx *sent*
            error.value = null;
            loadingMessage.value = 'Success!'; // Keep loading true briefly to show success
            setTimeout(() => loading.value = false, 1500);

        } catch (err) {
            console.error("Failed during share submission process:", err);
            error.value = err.message || 'An unexpected error occurred.';
            loading.value = false;
        }
    };

    // fetchVoteInformation (remains the same)
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

    // submitSecretShares function removed (logic integrated into prepareAndSubmitShare)

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
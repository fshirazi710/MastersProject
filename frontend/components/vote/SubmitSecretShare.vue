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
                <!-- Password Input for Decryption -->
                <div v-if="isWalletConnected" class="form-group">
                    <label for="decrypt-password">Enter Vote Session Key Password:</label>
                    <input 
                        type="password" 
                        id="decrypt-password" 
                        v-model="decryptionPassword"
                        placeholder="Password used during registration"
                        required
                        class="form-input"
                    />
                    <small>Needed to decrypt your key and generate shares.</small>
                </div>

                <button @click="prepareAndSubmitShare" type="submit" class="btn primary" :disabled="loading || !isWalletConnected || !decryptionPassword">
                    <span v-if="!isWalletConnected">Connect Wallet First</span>
                    <span v-else-if="loading">{{ loadingMessage }}</span>
                    <span v-else-if="!decryptionPassword">Enter Password Above</span>
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
    // import { useRoute } from 'vue-router'; // useRoute is not used in this component's script setup

    // API Services
    import { encryptedVoteApi, shareApi } from '@/services/api'; 

    // Blockchain Interaction Services
    import { blockchainProviderService } from '@/services/blockchainProvider.js';
    import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
    import { voteSessionVotingService } from '@/services/contracts/voteSessionVotingService.js';
    import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js';

    // Utility Services (using @ alias for consistency, assuming it's configured)
    // If '~' is indeed your project's alias for this path, you can revert this part.
    import { 
        // generateShares, // This specific function name might not exist; will be replaced by blsCryptoUtils.calculateDecryptionShareForSubmission
        // deriveKeyFromPassword, // Moved to aesUtils
        // AESDecrypt, // Moved to aesUtils
        // hexToBytes // Moved to conversionUtils
    } from '@/services/utils/cryptographyUtils.js'; // This import might become empty or be removed if all are moved
    import { calculateDecryptionShareForSubmission } from '@/services/utils/blsCryptoUtils.js'; // NEW - Importing named function

    // NEW IMPORTS for AES and conversion utilities
    import { AESDecrypt, deriveKeyFromPassword } from '@/services/utils/aesUtils.js';
    import { hexToBytes } from '@/services/utils/conversionUtils.js';

    const props = defineProps({
        voteId: { type: [String, Number], required: true }, // Allow string or number
        endDate: { type: String, required: true },
        voteSessionAddress: { type: String, required: true } // Added prop
        // sharesEndDate: { type: String, required: false }
    });

    const loading = ref(false);
    const loadingMessage = ref('Processing...');
    const error = ref(null);
    const hasSubmittedShare = ref(false); // State managed by contract check
    const isWalletConnected = ref(false);
    const currentAccount = ref(null);
    const isCheckingStatus = ref(true); 
    const decryptionPassword = ref('');

    // --- Deadline Calculation ---
    // TODO: Use props.sharesEndDate if provided, otherwise fallback to endDate + buffer?
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
        isCheckingStatus.value = true;
        try {
            // Check wallet connection
            if (blockchainProviderService.getAccount()) {
                 isWalletConnected.value = true;
                 currentAccount.value = blockchainProviderService.getAccount();
                 // Check submission status via contract
                 await checkSubmissionStatus(); 
            } else {
                 isWalletConnected.value = false;
                 currentAccount.value = null;
            }
        } catch (e) {
            console.warn("Wallet check/init or status check failed on mount:", e);
            isWalletConnected.value = false;
            error.value = "Failed to initialize: " + e.message;
        } finally {
            isCheckingStatus.value = false;
        }
    });

    // --- Updated function to check submission status from registry contract ---
    async function checkSubmissionStatus() {
        if (!currentAccount.value || props.voteId === undefined) return;
        isCheckingStatus.value = true;
        const sessionId = Number(props.voteId);
        if (isNaN(sessionId)) {
            error.value = "Invalid vote session ID.";
            isCheckingStatus.value = false;
            return;
        }
        console.log(`Checking share submission status for ${currentAccount.value} in session ${sessionId}...`);
        try {
            // Use registryParticipantService to get participant details
            const participantDetails = await registryParticipantService.getParticipantInfo(sessionId, currentAccount.value);
            
            if (participantDetails) {
                hasSubmittedShare.value = participantDetails.hasSubmittedShares; 
            } else {
                // If not registered, they cannot have submitted shares
                hasSubmittedShare.value = false; 
            }
            console.log("On-chain share submission status:", hasSubmittedShare.value);

        } catch (err) {
            console.error("Error checking share submission status:", err);
            error.value = "Could not verify share submission status."; // Inform user
            hasSubmittedShare.value = false; // Assume not submitted on error
        } finally {
            isCheckingStatus.value = false;
        }
    }

    // --- Refactored function to submit share directly to contract ---
    const prepareAndSubmitShare = async () => {
        error.value = null;
        currentAccount.value = blockchainProviderService.getAccount(); // Make sure currentAccount is updated if not already

        if (loading.value || !isWalletConnected.value || !currentAccount.value || !decryptionPassword.value) {
            error.value = "Please connect wallet and enter password.";
            return;
        }
        
        const sessionId = Number(props.voteId);
        if (isNaN(sessionId)) {
             error.value = "Invalid vote session ID.";
             return;
        }

        loading.value = true;
        loadingMessage.value = 'Retrieving encrypted key...';
        let decryptedPrivateKeyHex = null;

        try {
            // --- Key Retrieval and Decryption --- (logic mostly unchanged)
            const lowerCaseAccount = currentAccount.value.toLowerCase(); 
            const encryptedKeyStorageKey = `vote_session_${sessionId}_user_${lowerCaseAccount}_blsEncryptedPrivateKey`;
            const saltStorageKey = `vote_session_${sessionId}_user_${lowerCaseAccount}_blsSalt`;
            const encryptedKeyHex = localStorage.getItem(encryptedKeyStorageKey);
            const saltHex = localStorage.getItem(saltStorageKey);
            if (!encryptedKeyHex || !saltHex) {
                throw new Error("Could not retrieve stored key details. Did you register in this browser?");
            }
            loadingMessage.value = 'Decrypting key...';
            const saltBytes = hexToBytes(saltHex);
            const derivedKey = await deriveKeyFromPassword(decryptionPassword.value, saltBytes);
            decryptedPrivateKeyHex = await AESDecrypt(encryptedKeyHex, derivedKey);
            console.log("BLS key decrypted successfully.");
            // -------------------------------------

            // --- Fetch all encrypted votes and calculate shares ---
            loadingMessage.value = 'Fetching encrypted votes...';
            if (!props.voteSessionAddress) {
                throw new Error("Vote session address is not available.");
            }

            const numberOfVotes = await voteSessionViewService.getNumberOfVotes(props.voteSessionAddress);
            if (numberOfVotes === 0) {
                throw new Error("No votes found in this session to submit shares for.");
            }
            console.log(`Found ${numberOfVotes} encrypted votes.`);

            const calculatedShares = [];
            const privateKeyBigInt = BigInt(decryptedPrivateKeyHex); // Convert hex private key to BigInt
            decryptedPrivateKeyHex = null; // Clear hex key from memory immediately after conversion
            console.log("Decrypted private key converted to BigInt and original hex cleared.");

            for (let i = 0; i < numberOfVotes; i++) {
                loadingMessage.value = `Processing vote ${i + 1} of ${numberOfVotes}...`;
                // Option 1: Use API service (if it provides g1r for each vote easily)
                // const voteInfo = await encryptedVoteApi.getEncryptedVoteInfo(sessionId, i);
                // const g1rValue = voteInfo.g1r; // Adjust based on actual API response structure
                
                // Option 2: Use direct contract call via view service
                const voteData = await voteSessionViewService.getEncryptedVote(props.voteSessionAddress, i);
                if (!voteData || !voteData.g1r) {
                    throw new Error(`Could not fetch g1r for vote index ${i}.`);
                }
                const g1rHex = voteData.g1r; // Assuming g1r is a hex string
                console.log(`Fetched g1r for vote ${i}: ${g1rHex.substring(0,20)}...`);

                const shareHex = await calculateDecryptionShareForSubmission(privateKeyBigInt, g1rHex.startsWith('0x') ? g1rHex.substring(2) : g1rHex);
                calculatedShares.push({ voteIndex: i, share: shareHex }); // shareHex is raw hex from blsCryptoUtils
                console.log(`Calculated share for vote ${i}: ${shareHex.substring(0,20)}...`);
            }
            // Clear BigInt key from memory after all shares are calculated
            // privateKeyBigInt = null; // Not strictly necessary as it's function-scoped, but good practice if it were wider

            if (calculatedShares.length === 0) {
                throw new Error("No shares were calculated.");
            }
            console.log("All shares calculated:", calculatedShares.map(s => ({...s, share: s.share.substring(0,10) + '...'})));
            // -----------------------------------------------------

            // --- Submit Shares (Two-Step Process as per plan) ---
            loadingMessage.value = 'Preparing shares for submission...';

            // Step 1: (Optional but Recommended) Backend API submission for verification
            // This requires constructing a payload, potentially signing it, and calling shareApi.submitShare
            // For now, we will log and proceed to direct contract submission.
            // TODO: Implement backend share verification call if required by project design
            const sharesToSubmitToApi = calculatedShares.map(cs => ({
                vote_index: cs.voteIndex,
                share_value: cs.share.startsWith('0x') ? cs.share : `0x${cs.share}` // Ensure 0x prefix for API/Contract
            }));
            console.log("Shares prepared for API/Contract submission:", sharesToSubmitToApi.map(s => ({...s, share_value: s.share_value.substring(0,10) + '...'})));
            
            // Example: If you had a shareApi.submitShare for pre-validation
            // try {
            //     loadingMessage.value = 'Verifying shares with backend...';
            //     const apiVerificationResponse = await shareApi.submitShare(sessionId, { shares: sharesToSubmitToApi });
            //     if (!apiVerificationResponse || !apiVerificationResponse.data || !apiVerificationResponse.data.success) {
            //         throw new Error(apiVerificationResponse?.data?.message || "Backend share verification failed.");
            //     }
            //     console.log("Backend share verification successful.");
            // } catch (apiErr) {
            //     throw new Error(`Backend share verification failed: ${apiErr.message}`);
            // }

            // Step 2: Contract Interaction
            loadingMessage.value = 'Fetching your share index...';
            const holderShareIndex = await registryParticipantService.getParticipantIndex(sessionId, currentAccount.value);
            if (!holderShareIndex || holderShareIndex === 0) { // getParticipantIndex returns 0 if not found/not a holder
                throw new Error("Could not retrieve your participant index. Are you registered as a holder for this session?");
            }
            console.log(`Retrieved holder share index: ${holderShareIndex}`);

            loadingMessage.value = 'Submitting shares to contract...';
            for (const { voteIndex, share } of calculatedShares) {
                loadingMessage.value = `Submitting share for vote ${voteIndex + 1} of ${numberOfVotes}...`;
                const shareDataForContract = share.startsWith('0x') ? share : `0x${share}`; // Ensure 0x prefix
                
                console.log(`Submitting to voteSessionVotingService.submitDecryptionShare: sessionAddr=${props.voteSessionAddress}, voteIdx=${voteIndex}, share=${shareDataForContract.substring(0,10)}..., holderIdx=${holderShareIndex}`);
                const txReceipt = await voteSessionVotingService.submitDecryptionShare(
                    props.voteSessionAddress, 
                    voteIndex, 
                    shareDataForContract, 
                    holderShareIndex
                );
                // Await confirmation for each share submission or submit in a batch if contract allows?
                // For now, assume sequential submission and waiting.
                // await txReceipt.wait(); // Assuming service returns tx object with wait()
                console.log(`Share for vote ${voteIndex} submitted. Tx: ${txReceipt.transactionHash}`);
            }
            console.log("All shares submitted to contract successfully.");
            // ------------------------------- // Old submission logic below is now replaced

            // Update UI on success
            hasSubmittedShare.value = true;
            error.value = null;
            loadingMessage.value = 'Success!';
            setTimeout(() => { loading.value = false; }, 1500); // Keep success message briefly

        } catch (err) {
            console.error("Failed during share submission process:", err);
            error.value = err.message || 'An unexpected error occurred during share submission.';
            // Check for specific errors like 'already submitted'
            if (err.message && err.message.toLowerCase().includes('share already submitted')) {
                 hasSubmittedShare.value = true; // Update UI if contract confirms already submitted
                 error.value = "You have already submitted your share for this session.";
            }
            loading.value = false;
        } finally {
            // Ensure sensitive variables are cleared
            decryptedPrivateKeyHex = null;
            decryptionPassword.value = ''; 
        }
    };

    // Removed fetchVoteInformation - no longer needed as g1r is fetched directly
    // Removed backend signing/verification logic

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

/* Add form-group styles if not already present globally */
.form-group {
  margin-bottom: 15px;
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
  }
  .form-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background-color: var(--background-light);
    color: var(--text-primary);
    box-sizing: border-box; // Ensure padding doesn't add to width
    &:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
    }
  }
  small {
    display: block;
    margin-top: 5px;
    font-size: 0.85em;
    color: var(--text-secondary);
  }
}
</style>
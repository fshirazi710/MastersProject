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
    import { useRoute } from 'vue-router';
    // Removed API imports
    // import { encryptedVoteApi, shareApi } from '@/services/api';
    // Import required services
    import { ethersBaseService, registryService, voteSessionService } from '~/services/contracts/ethersService.js'; 
    import { 
        generateShares, 
        deriveKeyFromPassword, 
        AESDecrypt, 
        hexToBytes 
    } from '~/services/utils/cryptographyUtils.js'; 
    // Removed config import
    // import { config } from '@/config'; 
    // import Cookies from "js-cookie"; // Removed cookie usage
    import { ethers } from 'ethers'; // Keep ethers for utils if needed
    // Removed stable stringify
    // import jsonStableStringify from 'fast-json-stable-stringify';

    const props = defineProps({
        voteId: { type: [String, Number], required: true }, // Allow string or number
        endDate: { type: String, required: true }
        // sharesEndDate might be more relevant than endDate + buffer?
        // Add sharesEndDate prop if available from parent
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
            if (ethersBaseService.getAccount()) {
                 isWalletConnected.value = true;
                 currentAccount.value = ethersBaseService.getAccount();
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
            // Use registryService to get participant details
            const participantDetails = await registryService.getParticipantDetails(sessionId, currentAccount.value);
            
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

            // --- Fetch g1r from VoteSession contract --- 
            loadingMessage.value = 'Fetching round parameters...';
            console.log(`Fetching vote round parameters for session ${sessionId}...`);
            const roundParams = await voteSessionService.getVoteRoundParameters(sessionId);
            if (!roundParams || !roundParams.g1r) {
                throw new Error("Could not fetch necessary round parameters (g1r) from the contract.");
            }
            const g1rValue = roundParams.g1r;
            console.log(`Fetched g1r: ${g1rValue}`);
            // -------------------------------------------

            // --- Generate Share --- 
            loadingMessage.value = 'Generating share...';
            if (!decryptedPrivateKeyHex) {
                throw new Error("Decrypted key is not available for share generation.");
            }
            const generatedShareHex = generateShares(g1rValue, decryptedPrivateKeyHex);
            // Clear the decrypted key from memory ASAP
            decryptedPrivateKeyHex = null;
            console.log("Share generated:", generatedShareHex); 
            console.log("Decrypted key cleared from memory.");
            // ----------------------

            // --- Submit Share to Contract --- 
            loadingMessage.value = 'Submitting transaction...';
            console.log(`Calling voteSessionService.submitShares for session ${sessionId}...`);
            
            // Assuming submitShares expects sessionId and the share data (bytes or hex string)
            // Check the exact expected type in voteSessionService.js / VoteSession.sol
            const txReceipt = await voteSessionService.submitShares(
                sessionId,
                generatedShareHex.startsWith('0x') ? generatedShareHex : `0x${generatedShareHex}` // Ensure 0x prefix for service
            );
            console.log("Share submission transaction successful:", txReceipt);
            // -------------------------------

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
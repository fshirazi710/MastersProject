<template>
  <div v-if="currentAccount" class="holder-status-section">
    <h3>Your Status & Claim</h3>
    <div v-if="isCheckingHolderStatus">Loading your status...</div>
    <ul v-else-if="isHolder">
      <li>
        <span class="status-label">Registered:</span>
        <span class="status-value">
          Yes <span class="status-icon">✅</span>
        </span>
      </li>
      <li>
        <span class="status-label">Deposit:</span>
        <span class="status-value">{{ holderDeposit }}</span>
      </li>
      <li>
        <span class="status-label">Submitted Decryption Share:</span>
        <span class="status-value">
          {{ didHolderSubmitShare ? 'Yes ✅' : 'No ❌' }}
        </span>
      </li>
      <!-- TODO: Add display for claimable reward amount -->
      <li>
        <span class="status-label">Reward Status:</span>
        <span class="status-value">{{ rewardDistributionStatus }}</span>
      </li>
      <!-- TODO: Add claim eligibility logic based on session status and participation -->
      <li>
        <button 
          @click="claimDepositHandler" 
          :disabled="isClaimingDeposit || holderDeposit === '0 ETH'" 
          class="btn btn-primary btn-sm"
        >
          {{ isClaimingDeposit ? 'Claiming...' : 'Claim Deposit/Reward' }}
        </button>
      </li>
      <li v-if="claimError" class="error-message-li">
        <small>{{ claimError }}</small>
      </li>
    </ul>
    <div v-else>
      <p>You are not registered as a participant/holder in this session.</p>
    </div>
  </div>
  <div v-else class="holder-status-section">
     <h3>Your Status & Claim</h3>
     <p>Please connect your wallet to view your status and claim options.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { ethersBaseService, registryService } from '~/services/contracts/ethersService.js';

const props = defineProps({
  voteId: {
    type: [String, Number],
    required: true
  },
  sessionStatus: { // Pass overall session status from parent if needed for eligibility checks
      type: String, 
      default: 'unknown' 
  }
});

const isHolder = ref(false);
const holderDeposit = ref('0 ETH'); // Store as string formatted ETH
const didHolderSubmitShare = ref(false);
const rewardDistributionStatus = ref('Unknown'); // e.g., Pending, Distributed, Failed
const isCheckingHolderStatus = ref(false);
const currentAccount = ref(null);
const isClaimingDeposit = ref(false);
const claimError = ref(null); // Specific error ref for claiming

onMounted(() => {
  // Initial check when component mounts
  checkHolderStatus();
  // Watch for account changes provided by ethersBaseService
  ethersBaseService.onAccountChanged(checkHolderStatus); 
});

// Re-check if the voteId changes (though unlikely in this component's lifecycle)
watch(() => props.voteId, () => {
    checkHolderStatus();
});

// TODO: Watch sessionStatus prop if claim eligibility depends on it


const checkHolderStatus = async () => {
  currentAccount.value = ethersBaseService.getAccount();
  if (!currentAccount.value) {
    console.log("HolderStatus: Wallet not connected, cannot check holder status.");
    isHolder.value = false;
    holderDeposit.value = '0 ETH';
    didHolderSubmitShare.value = false;
    rewardDistributionStatus.value = 'Unknown';
    return;
  }

  const sessionId = Number(props.voteId);
  if (isNaN(sessionId)) {
      console.error("HolderStatus: Invalid Vote ID for holder status check.");
      claimError.value = "Invalid Session ID.";
      return;
  }

  isCheckingHolderStatus.value = true;
  claimError.value = null; // Clear previous errors
  try {
    console.log(`HolderStatus: Checking status for ${currentAccount.value} in session ${sessionId}...`);
    const details = await registryService.getParticipantDetails(sessionId, currentAccount.value);

    if (details) {
        isHolder.value = details.isRegistered;
        didHolderSubmitShare.value = details.hasSubmittedShares;
        holderDeposit.value = details.depositAmount; // Already formatted ETH string
        console.log(`HolderStatus: Active=${isHolder.value}, SubmittedShare=${didHolderSubmitShare.value}, Deposit=${holderDeposit.value}`);
    } else {
         isHolder.value = false;
         didHolderSubmitShare.value = false;
         holderDeposit.value = '0 ETH';
         console.log(`HolderStatus: Not registered.`);
    }
    
    // Fetch reward status separately
    rewardDistributionStatus.value = await fetchRewardStatus(sessionId);

  } catch (err) {
    console.error("HolderStatus: Error checking holder status:", err);
    claimError.value = `Error fetching status: ${err.message || 'Unknown error'}`;
    isHolder.value = false;
    didHolderSubmitShare.value = false;
    holderDeposit.value = '0 ETH';
  } finally {
    isCheckingHolderStatus.value = false;
  }
};

const fetchRewardStatus = async (sessionId) => {
  // TODO: Implement fetching actual reward/claim status from the registry contract
  // This might involve checking if rewards have been calculated/distributed
  // and if the specific user has already claimed.
  console.warn(`HolderStatus: fetchRewardStatus needs implementation for session ${sessionId}.`);
  // Placeholder: Check if deposit is zero, maybe implies claimed? Needs better logic.
  if (isHolder.value && holderDeposit.value === '0 ETH') {
      return 'Claimed / Zero Deposit';
  }
  // Placeholder: Check session status from props if needed
  if (props.sessionStatus === 'complete') { 
      // This is a simplification, the contract holds the real state.
      return 'Distribution Pending/Complete (Check Contract)'; 
  }
  return 'Unknown/Pending'; 
};

const claimDepositHandler = async () => {
  if (!currentAccount.value || !isHolder.value) {
    claimError.value = "Cannot claim: Wallet not connected or not registered.";
    return;
  }
  // TODO: Add more sophisticated eligibility checks based on sessionStatus and contract state
  // For example, can only claim after shares phase or completion.

  const sessionId = Number(props.voteId);
  if (isNaN(sessionId)) {
      claimError.value = "Invalid Vote ID for claim.";
      return;
  }

  isClaimingDeposit.value = true;
  claimError.value = null;
  try {
    console.log(`HolderStatus: Attempting to claim deposit/reward for session ${sessionId} by ${currentAccount.value}`);
    
    // Call the service function
    const txReceipt = await registryService.claimDepositOrReward(sessionId);

    console.log("HolderStatus: Claim transaction successful:", txReceipt);
    alert("Claim transaction sent successfully! Waiting for confirmation...");

    // Re-check status after successful transaction submission
    await checkHolderStatus(); 

  } catch (err) {
    console.error("HolderStatus: Failed to claim deposit/reward:", err);
    // Provide more specific feedback if possible
    if (err.message && (err.message.toLowerCase().includes('claim already processed') || err.message.toLowerCase().includes('already claimed'))) {
        claimError.value = "You have already claimed for this session.";
        // Refresh status to reflect the 'already claimed' state accurately
        await checkHolderStatus(); 
    } else if (err.message && err.message.toLowerCase().includes('claim not allowed yet')) {
         claimError.value = "Claiming is not yet allowed for this session phase.";
    } else {
       claimError.value = `Failed to claim: ${err.message || 'Please try again.'}`;
    }
  } finally {
    isClaimingDeposit.value = false;
  }
};

</script>

<style lang="scss" scoped>
/* Styles specific to holder status section - Copied from _vote-results.scss */
.holder-status-section {
  margin-top: 30px;
  padding: 20px; /* Use $spacing-lg variable if defined globally */
  background-color: #e9ecef; /* Use var(--background-alt) if defined */
  border-radius: 4px; /* Use var(--border-radius) if defined */
  border: 1px solid #dee2e6; /* Use var(--border-color) if defined */

  h3 {
    margin-top: 0;
    margin-bottom: 15px; /* Use $spacing-md variable if defined globally */
    border-bottom: 1px solid #dee2e6; /* Use var(--border-color) if defined */
    padding-bottom: 10px; /* Use $spacing-sm variable if defined globally */
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: 10px; /* Use $spacing-sm variable if defined globally */
    display: flex;
    justify-content: space-between;
    align-items: center; /* Align items vertically */
  }

  .status-label {
    font-weight: 500;
  }

  .status-value {
    text-align: right;
  }

  .status-icon {
    margin-left: 5px; /* Use $spacing-xs variable if defined globally */
  }
}

/* Style for claim error message within the list */
.error-message-li {
  justify-content: flex-end; /* Align button and error */
  margin-top: 5px; /* Add some space above the error */
  small {
    color: #dc3545; /* Use var(--danger) if defined */
    text-align: right;
    width: 100%; /* Ensure it takes space if button isn't there */
  }
}

/* Smaller button variant - Copied from _vote-results.scss */
.btn-sm {
    padding: 4px 8px;
    font-size: 0.85em;
}

/* Add styles for primary button if not global */
.btn-primary {
    color: #fff;
    background-color: #007bff;
    border-color: #007bff;
    cursor: pointer;
}
.btn-primary:disabled {
    background-color: #6c757d;
    border-color: #6c757d;
    cursor: not-allowed;
}
</style> 
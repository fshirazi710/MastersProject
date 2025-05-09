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
import { ethers } from 'ethers';

// Add new service imports (assuming @ alias, adjust if needed)
import { blockchainProviderService } from '@/services/blockchainProvider.js';
import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
import { registryFundService } from '@/services/contracts/registryFundService.js';
import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js';

const props = defineProps({
  voteId: {
    type: [String, Number],
    required: true
  },
  sessionStatus: { // Pass overall session status from parent if needed for eligibility checks
      type: String, 
      default: 'unknown' 
  },
  voteSessionAddress: { // Added prop for checking claim period
    type: String,
    required: true
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
const hasClaimedDeposit = ref(false);
const hasClaimedReward = ref(false);
const claimableRewardAmount = ref('0 ETH');
const isDepositClaimActive = ref(false);

onMounted(() => {
  // Initial check when component mounts
  currentAccount.value = blockchainProviderService.getAccount();
  checkHolderStatus();
  // Watch for account changes - This might need a global state manager (e.g., Pinia)
  // For now, actions will re-check the account if needed.
  // blockchainProviderService.onAccountChanged(account => { 
  //   currentAccount.value = account;
  //   checkHolderStatus(); 
  // });
});

// Re-check if the voteId changes (though unlikely in this component's lifecycle)
watch(() => props.voteId, () => {
    currentAccount.value = blockchainProviderService.getAccount(); // Ensure account is fresh
    checkHolderStatus();
});

// TODO: Watch sessionStatus prop if claim eligibility depends on it


const checkHolderStatus = async () => {
  currentAccount.value = blockchainProviderService.getAccount(); // Ensure account is fresh before check
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
    const details = await registryParticipantService.getParticipantInfo(sessionId, currentAccount.value);

    if (details) {
        isHolder.value = details.isRegistered && details.isHolder; // Ensure they are specifically a holder
        didHolderSubmitShare.value = details.hasSubmittedShares;
        // Deposit amount from service is already in Ether string format
        holderDeposit.value = details.depositAmount ? details.depositAmount + ' ETH' : '0 ETH';
        console.log(`HolderStatus: ActiveHolder=${isHolder.value}, SubmittedShare=${didHolderSubmitShare.value}, Deposit=${holderDeposit.value}`);
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
  if (!currentAccount.value || !props.voteSessionAddress) {
    rewardDistributionStatus.value = 'Cannot check status (wallet/session address missing).';
    return;
  }
  try {
    isDepositClaimActive.value = await voteSessionViewService.isDepositClaimPeriodActive(props.voteSessionAddress);
    
    if (!isHolder.value) {
        rewardDistributionStatus.value = 'Not applicable (not a holder).';
        return;
    }

    hasClaimedDeposit.value = await registryParticipantService.hasClaimedDeposit(sessionId, currentAccount.value);
    hasClaimedReward.value = await registryFundService.hasClaimedReward(sessionId, currentAccount.value);

    if (hasClaimedDeposit.value && hasClaimedReward.value) {
        rewardDistributionStatus.value = 'All Claims Processed';
        holderDeposit.value = '0 ETH'; // Reflect claimed deposit
        claimableRewardAmount.value = '0 ETH';
    } else if (hasClaimedDeposit.value) {
        rewardDistributionStatus.value = 'Deposit Claimed';
        holderDeposit.value = '0 ETH';
    } else if (hasClaimedReward.value) {
        rewardDistributionStatus.value = 'Reward Claimed';
        claimableRewardAmount.value = '0 ETH';
    }

    if (!hasClaimedReward.value) {
        const owedWei = await registryFundService.getRewardsOwed(sessionId, currentAccount.value);
        claimableRewardAmount.value = owedWei ? ethers.formatEther(owedWei) + ' ETH' : '0 ETH';
    }

    if (isDepositClaimActive.value) {
        if (!hasClaimedDeposit.value && holderDeposit.value !== '0 ETH') {
            rewardDistributionStatus.value = 'Deposit/Reward Claim Open';
        } else if (!hasClaimedReward.value && claimableRewardAmount.value !== '0 ETH') {
            rewardDistributionStatus.value = 'Reward Claim Open';
        } else if (hasClaimedDeposit.value && hasClaimedReward.value) {
            rewardDistributionStatus.value = 'All Claims Processed';
        } else {
            rewardDistributionStatus.value = 'Claim Period Open (No further claims or already processed)';
        }
    } else {
        if (hasClaimedDeposit.value && hasClaimedReward.value) {
            rewardDistributionStatus.value = 'All Claims Processed';
        } else {
            rewardDistributionStatus.value = 'Claim Period Not Yet Active';
        }
    }

  } catch (err) {
    console.error("HolderStatus: Error fetching reward/claim status:", err);
    rewardDistributionStatus.value = 'Error fetching claim status.';
    claimableRewardAmount.value = '0 ETH';
  }
};

const claimDepositHandler = async () => {
  currentAccount.value = blockchainProviderService.getAccount(); // Ensure account is fresh
  if (!currentAccount.value) {
    claimError.value = "Wallet not connected.";
    return;
  }
  if (!isHolder.value) {
    claimError.value = "Not registered as a holder for this session.";
    return;
  }

  const sessionId = Number(props.voteId);
  if (isNaN(sessionId)) {
      claimError.value = "Invalid Vote ID for claim.";
      return;
  }

  // Refresh status before attempting claim for latest eligibility
  await checkHolderStatus(); // This will also call fetchRewardStatus

  if (!isDepositClaimActive.value) {
    claimError.value = "Claim period is not active.";
    return;
  }

  isClaimingDeposit.value = true;
  claimError.value = null;
  let depositClaimedSuccessfully = false;
  let rewardClaimedSuccessfully = false;

  try {
    console.log(`HolderStatus: Attempting to claim for session ${sessionId} by ${currentAccount.value}`);

    // Claim Deposit if eligible and not already claimed
    if (!hasClaimedDeposit.value && holderDeposit.value !== '0 ETH') { // Check original deposit amount too
      console.log("Attempting to claim deposit...");
      const depositTx = await registryParticipantService.claimDeposit(sessionId);
      // await depositTx.wait(); // Assuming service returns tx object with wait()
      console.log("Deposit claim transaction successful:", depositTx.transactionHash);
      depositClaimedSuccessfully = true;
    } else {
      console.log("Deposit already claimed or not applicable.");
      depositClaimedSuccessfully = true; // Consider it successful if already claimed or zero
    }

    // Claim Reward if eligible and not already claimed
    if (!hasClaimedReward.value && claimableRewardAmount.value !== '0 ETH') {
      console.log("Attempting to claim reward...");
      const rewardTx = await registryFundService.claimReward(sessionId);
      // await rewardTx.wait(); // Assuming service returns tx object with wait()
      console.log("Reward claim transaction successful:", rewardTx.transactionHash);
      rewardClaimedSuccessfully = true;
    } else {
      console.log("Reward already claimed or not applicable.");
      rewardClaimedSuccessfully = true; // Consider it successful if already claimed or zero
    }

    if (depositClaimedSuccessfully && rewardClaimedSuccessfully) {
        alert("Claim transaction(s) sent successfully! Waiting for confirmation.");
    } else if (depositClaimedSuccessfully) {
        alert("Deposit claim transaction sent successfully! Waiting for confirmation.");
    } else if (rewardClaimedSuccessfully) {
        alert("Reward claim transaction sent successfully! Waiting for confirmation.");
    } else {
        claimError.value = "No claims were applicable or initiated.";
    }

    // Re-check status after successful transaction submission to update UI
    await checkHolderStatus(); 

  } catch (err) {
    console.error("HolderStatus: Failed to claim deposit/reward:", err);
    claimError.value = `Failed to claim: ${err.message || 'Please try again.'}`;
    // Specific error messages can be refined here based on contract errors
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { voteSessionApi, participantApi } from '@/services/api';
import { blockchainProviderService } from '@/services/blockchainProvider.js';
import { factoryService } from '@/services/contracts/factoryService.js';
import { registryParticipantService } from '@/services/contracts/registryParticipantService.js';
import { registryFundService } from '@/services/contracts/registryFundService.js';
import { voteSessionViewService } from '@/services/contracts/voteSessionViewService.js';
import { normaliseTs } from '~/utils/date.js'; // Assuming Nuxt alias or correct relative path

export function useVoteSessionData() {
  const route = useRoute();

  const loading = ref(true);
  const error = ref(null);
  const vote = ref(null); // This will hold the main session data object
  const voteSessionAddress = ref(null);
  const participantRegistryAddress = ref(null);
  const actualIsRegistered = ref(false);
  const hasSubmittedDecryptionValue = ref(false);
  const hasClaimed = ref(false);
  const canClaim = ref(false);
  const isCheckingStatus = ref(true); // For user-specific status checks within fetchVoteData
  const claimableDeposit = ref('0');
  const claimableReward = ref('0');
  const isSessionOwner = ref(false);
  
  // Metadata specific refs that were in [id].vue
  const displayHint = ref(null);
  const sliderConfig = ref(null);

  const _updateIsSessionOwner = async () => {
    const currentAccount = blockchainProviderService.getAccount();
    if (voteSessionAddress.value && currentAccount) {
      try {
        const owner = await voteSessionViewService.getSessionOwner(voteSessionAddress.value);
        isSessionOwner.value = owner && owner.toLowerCase() === currentAccount.toLowerCase();
        console.log(`useVoteSessionData: Ownership re-checked. Current account: ${currentAccount}, Session owner: ${owner}, Is owner: ${isSessionOwner.value}`);
      } catch (ownerError) {
        console.error("useVoteSessionData: Error re-checking session owner:", ownerError);
        isSessionOwner.value = false;
      }
    } else {
      isSessionOwner.value = false;
      console.log(`useVoteSessionData: Ownership check skipped. Vote session address: ${voteSessionAddress.value}, Current account: ${currentAccount}`);
    }
  };

  const fetchVoteData = async (showLoadingSpinner = true) => {
    // Attempt to initialize wallet if no account is present
    if (!blockchainProviderService.getAccount() && typeof window.ethereum !== 'undefined') {
      try {
        console.log("useVoteSessionData: No account on load, attempting blockchainProviderService.init()");
        await blockchainProviderService.init();
        // If init() is successful, it will dispatch 'provider:accountsChanged'.
        // The event handler will then call fetchVoteData(false) with the new account.
        // This current execution of fetchVoteData might proceed with a null account if init doesn't immediately populate it
        // or if it's asynchronous in a way that this flow doesn't await completion of account update here.
        // The event-driven update is the more robust way to get the final state.
      } catch (initError) {
        console.warn("useVoteSessionData: Error during automatic init attempt on fetchVoteData:", initError.message);
        // Proceed with current (likely null) account, user might need to connect manually via a button.
      }
    }

    const voteSessionIdFromRouteString = route.params.id;
    if (!voteSessionIdFromRouteString || voteSessionIdFromRouteString === 'undefined' || voteSessionIdFromRouteString === ':id') {
      console.warn("useVoteSessionData: fetchVoteData called with invalid voteSessionId:", voteSessionIdFromRouteString);
      error.value = "Invalid or missing Vote Session ID.";
      loading.value = false;
      vote.value = null;
      // Reset other dependent refs
      voteSessionAddress.value = null;
      participantRegistryAddress.value = null;
      displayHint.value = null;
      sliderConfig.value = null;
      isSessionOwner.value = false;
      actualIsRegistered.value = false;
      // ... etc. for other user-specific states
      return;
    }

    const voteSessionIdFromRoute = parseInt(voteSessionIdFromRouteString, 10);
    if (isNaN(voteSessionIdFromRoute)) {
      console.error("useVoteSessionData: Invalid vote session ID format:", voteSessionIdFromRouteString);
      error.value = "Invalid Vote Session ID format.";
      loading.value = false;
      // Reset refs
      return;
    }

    if (showLoadingSpinner) loading.value = true;
    error.value = null;
    isCheckingStatus.value = true; // For the user-specific parts

    try {
      const addresses = await factoryService.getSessionAddresses(voteSessionIdFromRoute);
      if (!addresses || !addresses.sessionAddress || !addresses.registryAddress) {
        throw new Error(`Could not fetch contract addresses for session ${voteSessionIdFromRoute}.`);
      }
      voteSessionAddress.value = addresses.sessionAddress;
      participantRegistryAddress.value = addresses.registryAddress;

      const apiResponse = await voteSessionApi.getVoteSessionById(voteSessionIdFromRoute);
      if (!apiResponse || !apiResponse.data || !apiResponse.data.data) {
        throw new Error(`Failed to fetch valid session details structure from API for session ${voteSessionIdFromRoute}.`);
      }
      const sessionDataFromApi = apiResponse.data.data;
      console.log('useVoteSessionData: API response for session details:', JSON.parse(JSON.stringify(sessionDataFromApi))); // Log the raw API data for counts

      const currentAccountForOwnerCheck = blockchainProviderService.getAccount();
      if (voteSessionAddress.value && currentAccountForOwnerCheck) {
        try {
          const owner = await voteSessionViewService.getSessionOwner(voteSessionAddress.value);
          isSessionOwner.value = owner && owner.toLowerCase() === currentAccountForOwnerCheck.toLowerCase();
        } catch (ownerError) {
          console.error("useVoteSessionData: Error checking session owner (initial fetch):", ownerError);
          isSessionOwner.value = false;
        }
      } else {
        isSessionOwner.value = false;
      }

      const currentAccount = blockchainProviderService.getAccount();
      if (currentAccount && participantRegistryAddress.value) {
        try {
          const details = await registryParticipantService.getParticipantInfo(voteSessionIdFromRoute, currentAccount);
          actualIsRegistered.value = !!details;
          if (details) {
            hasSubmittedDecryptionValue.value = details.hasSubmittedDecryptionValue;
            hasClaimed.value = details.hasClaimedDeposit && details.hasClaimedReward;
            claimableDeposit.value = details.depositAmount;
            const rewardInWei = await registryFundService.getRewardsOwed(voteSessionIdFromRoute, currentAccount);
            claimableReward.value = blockchainProviderService.formatEther(rewardInWei || '0');
          } else {
            hasSubmittedDecryptionValue.value = false;
            hasClaimed.value = false;
            claimableDeposit.value = '0';
            claimableReward.value = '0';
          }
          const sessionStatusFromApi = sessionDataFromApi.status;
          const claimEligibleStatuses = ['VotingClosed', 'ShareCollectionOpen', 'Tallying', 'Complete', 'Failed'];
          const isSessionEffectivelyEnded = claimEligibleStatuses.includes(sessionStatusFromApi);
          canClaim.value = actualIsRegistered.value && !hasClaimed.value && isSessionEffectivelyEnded;
        } catch (statusError) {
          console.error("useVoteSessionData: Error checking participant status:", statusError);
          actualIsRegistered.value = false;
          hasSubmittedDecryptionValue.value = false;
          hasClaimed.value = false;
          canClaim.value = false;
          claimableDeposit.value = '0';
          claimableReward.value = '0';
        }
      } else {
        actualIsRegistered.value = false;
        hasSubmittedDecryptionValue.value = false;
        hasClaimed.value = false;
        canClaim.value = false;
        claimableDeposit.value = '0';
        claimableReward.value = '0';
      }
      isCheckingStatus.value = false;

      vote.value = {
        id: sessionDataFromApi.id || voteSessionIdFromRoute,
        title: sessionDataFromApi.title,
        description: sessionDataFromApi.description,
        status: sessionDataFromApi.status,
        startDate: normaliseTs(sessionDataFromApi.startDate),
        endDate: normaliseTs(sessionDataFromApi.endDate),
        sharesEndDate: normaliseTs(sessionDataFromApi.sharesEndDate),
        options: sessionDataFromApi.options || [],
        metadata: sessionDataFromApi.metadata_contract || sessionDataFromApi.metadata || '',
        participantCount: sessionDataFromApi.participant_count || 0,
        secretHolderCount: sessionDataFromApi.secret_holder_count || 0,
        requiredDeposit: sessionDataFromApi.required_deposit_eth || '0',
        minShareThreshold: sessionDataFromApi.min_share_threshold || 0,
        requiredKeys: sessionDataFromApi.actual_min_share_threshold || sessionDataFromApi.min_share_threshold || 0,
        releasedKeys: sessionDataFromApi.released_keys || 0,
        rewardPool: sessionDataFromApi.reward_pool || '0',
        vote_session_address: sessionDataFromApi.vote_session_address,
        participant_registry_address: sessionDataFromApi.participant_registry_address,
        actual_min_share_threshold: sessionDataFromApi.actual_min_share_threshold,
      };

      if (vote.value.metadata) {
        try {
          const parsedMeta = JSON.parse(vote.value.metadata);
          displayHint.value = parsedMeta.displayHint;
          if (parsedMeta.displayHint === 'slider' && parsedMeta.sliderConfig) {
            sliderConfig.value = {
              min: parsedMeta.sliderConfig.min,
              max: parsedMeta.sliderConfig.max,
              step: parsedMeta.sliderConfig.step,
            };
          } else {
            sliderConfig.value = null;
          }
        } catch (e) {
          console.warn("useVoteSessionData: Metadata is not valid JSON or doesn't contain expected structure:", e);
          displayHint.value = null;
          sliderConfig.value = null;
        }
      } else {
        displayHint.value = null;
        sliderConfig.value = null;
      }
    } catch (err) {
      console.error("useVoteSessionData: Failed to fetch vote session data:", err);
      error.value = `Error loading Vote Session: ${err.message || 'Unknown issue'}`;
      vote.value = null;
      // Reset all other relevant refs
    } finally {
      if (showLoadingSpinner) loading.value = false;
      // No need to call startTimerUpdates here; that's handled by the timer composable's watcher
    }
  };

  const handleAccountChangeFromProvider = async (event) => {
    console.log('useVoteSessionData: provider:accountsChanged event received', event.detail);
    // Re-check ownership and potentially other user-specific data
    await _updateIsSessionOwner();
    // Optionally, re-fetch other participant specific data if account changed, 
    // or let the main page trigger a full fetch if necessary.
    // For now, just updating owner status.
    // Consider if actualIsRegistered, etc. also need immediate refresh here.
    // A simpler approach might be to call fetchVoteData(false) if a new account is detected.
    if (event.detail.account) { // If a new account is set
        await fetchVoteData(false); // Re-fetch all data without spinner for the new account
    } else { // If account is disconnected
        isSessionOwner.value = false;
        actualIsRegistered.value = false;
        // Reset other user-specific states
    }
  };

  onMounted(() => {
    window.addEventListener('provider:accountsChanged', handleAccountChangeFromProvider);
    // Initial fetchVoteData is typically called by the component using this composable.
  });

  onBeforeUnmount(() => {
    window.removeEventListener('provider:accountsChanged', handleAccountChangeFromProvider);
  });

  // Watch for voteSessionAddress to be available before first owner check if not relying on initial fetchVoteData call
  // This can be an alternative if fetchVoteData isn't called immediately or if account is ready before session address.
  watch(voteSessionAddress, async (newVal, oldVal) => {
    if (newVal && newVal !== oldVal) {
      await _updateIsSessionOwner();
    }
  });

  return {
    loading,
    error,
    vote,
    voteSessionAddress,
    participantRegistryAddress,
    actualIsRegistered,
    hasSubmittedDecryptionValue,
    hasClaimed,
    canClaim,
    isCheckingStatus, // still used for the user-specific part of fetch
    claimableDeposit,
    claimableReward,
    isSessionOwner,
    displayHint, // expose metadata refs
    sliderConfig,  // expose metadata refs
    fetchVoteData,
  };
} 
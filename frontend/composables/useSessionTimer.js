import { ref, watch, onBeforeUnmount } from 'vue';

export function useSessionTimer(voteDetails) { // voteDetails can be a ref to the vote object
  const timeRemaining = ref('N/A');
  const timerLabel = ref('Timeline Status:');
  const timeUpdateInterval = ref(null);

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn(`formatDateTime: Invalid date string received: ${dateString}`);
        return dateString;
      }
      return date.toLocaleString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString;
    }
  };

  const formatTimeDifference = (diff) => {
    if (diff <= 0) return '00:00:00';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    let formattedTime = '';
    if (days > 0) formattedTime += `${days}d `;
    formattedTime += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return formattedTime;
  };

  const internalStopTimer = () => {
    if (timeUpdateInterval.value) {
      console.log("useSessionTimer: Stopping timer updates.");
      clearInterval(timeUpdateInterval.value);
      timeUpdateInterval.value = null;
    }
  };

  const updateTimerState = () => {
    const currentVote = voteDetails.value;
    if (!currentVote || !currentVote.status) {
      console.log("useSessionTimer.updateTimerState: currentVote or status missing.");
      timeRemaining.value = "N/A";
      timerLabel.value = "Timeline Status:";
      internalStopTimer();
      return;
    }

    let targetDateString = null;
    let currentLabel = "Time Remaining:";
    const now = new Date().getTime();

    if (currentVote.status === 'RegistrationOpen' || currentVote.status === 'VotingOpen') {
      targetDateString = currentVote.endDate;
      currentLabel = currentVote.status === 'RegistrationOpen' ? "Registration Closes In:" : "Voting Ends In:";
    } else if (currentVote.status === 'ShareCollectionOpen') {
      targetDateString = currentVote.sharesEndDate;
      currentLabel = "Share Submission Ends In:";
    } else {
      if (currentVote.endDate) {
        const voteEnd = new Date(currentVote.endDate).getTime();
        if (now < voteEnd && !isNaN(voteEnd)) {
          targetDateString = currentVote.endDate;
          currentLabel = "Session Active Until:"; // General label if past specific phases but not yet ended
        } else {
          timeRemaining.value = "Ended";
          timerLabel.value = "Timeline Status:";
          internalStopTimer();
          return;
        }
      } else {
        timeRemaining.value = "N/A";
        timerLabel.value = "Timeline Status:";
        internalStopTimer();
        return;
      }
    }

    timerLabel.value = currentLabel;

    if (!targetDateString) {
      timeRemaining.value = "N/A";
      internalStopTimer();
      return;
    }

    try {
      const targetTime = new Date(targetDateString).getTime();
      if (isNaN(targetTime)) {
        timeRemaining.value = "Invalid Date";
        internalStopTimer();
        return;
      }
      const difference = targetTime - now;
      if (difference > 0) {
        timeRemaining.value = formatTimeDifference(difference);
      } else {
        timeRemaining.value = "Ended";
        internalStopTimer();
      }
    } catch (e) {
      console.error("Error in updateTimerState calculating date difference:", e);
      timeRemaining.value = "Error";
      internalStopTimer();
    }
  };

  const internalStartTimerLogic = () => {
    internalStopTimer(); 
    if (voteDetails.value && voteDetails.value.status && voteDetails.value.startDate && voteDetails.value.endDate) { 
        // console.log("useSessionTimer: internalStartTimerLogic - Starting timer.", voteDetails.value); // Keep if needed for debugging timer starts
        updateTimerState(); 
        timeUpdateInterval.value = setInterval(updateTimerState, 1000);
    } else {
        // console.log("useSessionTimer: internalStartTimerLogic - Conditions not met, timer not starting.");
        timeRemaining.value = 'N/A';
        timerLabel.value = 'Timeline Status:';
    }
  };

  watch(voteDetails, (newVote, oldVote) => {
    // console.log(`useSessionTimer WATCHER (Shallow): voteDetails ref changed.`); // Can remove
    // console.log("useSessionTimer WATCHER (Shallow): New value object (raw):", newVote); // Can remove
    // console.log("useSessionTimer WATCHER (Shallow): New value (stringified):", JSON.parse(JSON.stringify(newVote || {}))); // Can remove
    
    if (newVote && newVote.status && newVote.startDate && newVote.endDate) { 
      // console.log("useSessionTimer WATCHER (Shallow): Condition MET. Starting timer logic. Status:", newVote.status); // Can remove or make more succinct
      internalStartTimerLogic();
    } else {
      // console.log("useSessionTimer WATCHER (Shallow): Condition NOT MET. Stopping timer."); // Can remove
      // console.log("useSessionTimer WATCHER (Shallow): Details: newVote.status=", newVote?.status, "newVote exists=", !!newVote, "startDate exists=", !!newVote?.startDate, "endDate exists=", !!newVote?.endDate); // Can remove
      internalStopTimer();
      timeRemaining.value = 'N/A';
      timerLabel.value = 'Timeline Status:';
    }
  }, { immediate: true }); 

  onBeforeUnmount(() => {
    internalStopTimer();
  });

  return {
    timeRemaining,
    timerLabel,
    formatDateTime, // Expose for direct use in template if needed for other dates
    // startTimerUpdates, // No longer explicitly called from parent
    // stopTimerUpdates   // No longer explicitly called from parent
  };
} 
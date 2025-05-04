<template>
  <div class="decryption-pending">
    <div class="lock-container">
      <span class="lock-icon">🔒</span>
    </div>
    <h3>Decryption Pending</h3>
    <p>The voting period has ended. The results are encrypted and will be revealed once enough decryption shares are submitted.</p>
    
    <div class="requirements-list">
       <li>
         <span class="requirement-label">Voting Status:</span>
         <div class="requirement-status-container">
            <span class="requirement-status">{{ votingStatusTextDisplay }}</span>
         </div>
       </li>
       <li>
        <span class="requirement-label">Share Submission Deadline:</span>
         <div class="requirement-status-container">
            <span class="requirement-status">{{ formattedDeadline }}</span>
         </div>
       </li>
       <li>
         <span class="requirement-label">Decryption Shares Submitted:</span>
         <div class="requirement-status-container">
           <span class="requirement-status" :class="{ 'completed': sharesSufficient }">
             {{ releasedKeys }} / {{ requiredKeys }}
           </span>
           <div class="shares-progress">
             <div class="shares-progress-bar" :style="{ width: sharesProgress + '%' }"></div>
           </div>
         </div>
       </li>
    </div>

    <p v-if="!sharesSufficient" class="check-back">
      Check back after the deadline or once enough shares ({{ requiredKeys }}) are submitted.
    </p>
     <p v-else class="check-back">
      Enough shares submitted. Decryption should start shortly...
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  releasedKeys: {
    type: Number,
    required: true,
    default: 0
  },
  requiredKeys: {
    type: Number,
    required: true,
    default: 1 // Avoid division by zero
  },
  votingStatusText: { // Status string from parent ('active', 'ended', 'shares', 'complete', 'failed')
      type: String,
      required: true,
      default: 'unknown'
  },
  submissionDeadline: { // Date object or null
      type: Date,
      default: null
  }
});

const sharesSufficient = computed(() => props.releasedKeys >= props.requiredKeys);

const sharesProgress = computed(() => {
  if (props.requiredKeys <= 0) return 0;
  return Math.min((props.releasedKeys / props.requiredKeys) * 100, 100); 
});

const formattedDeadline = computed(() => {
    if (!props.submissionDeadline) return 'Not Set';
    try {
        return props.submissionDeadline.toLocaleString();
    } catch (e) {
        return 'Invalid Date';
    }
});

const votingStatusTextDisplay = computed(() => {
    switch (props.votingStatusText) {
        case 'active': return 'Voting In Progress';
        case 'shares': return 'Ended, Share Submission Open';
        case 'ended': return 'Ended, Share Submission Closed';
        // Add other cases if needed based on parent logic
        default: return props.votingStatusText; // fallback
    }
});

</script>

<style lang="scss" scoped>
/* Styles copied and adapted from _vote-results.scss */
.decryption-pending {
  background-color: #f8f9fa; /* var(--light-bg); */
  border-radius: 4px; /* var(--border-radius); */
  padding: 30px 20px; /* 30px $spacing-lg; */
  text-align: center;
  max-width: 500px;
  margin: 20px auto; /* Added margin */
  border: 1px solid #dee2e6; /* var(--border-color); */
}

.lock-container {
  margin-bottom: 15px; /* $spacing-md; */
}

.lock-icon {
  font-size: 40px;
  display: inline-block;
  animation: pulse 2s infinite;
  color: #ffc107; /* var(--warning); - Indicate pending/waiting */
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.requirements-list {
  text-align: left;
  margin: 15px auto; /* $spacing-md auto; */
  padding-left: 0;
  list-style: none;
  max-width: 400px; /* Adjusted max-width */
}

.requirements-list li {
  margin-bottom: 15px; /* $spacing-md; */
  line-height: 1.4;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px; /* $spacing-sm; */
}

.requirement-label {
  font-weight: 500;
  flex-shrink: 0;
}

.requirement-status-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-grow: 1;
}

.requirement-status {
  color: #856404; /* var(--warning-dark); */
  text-align: right;
}

.requirement-status.completed {
  color: #155724; /* var(--success-dark); */
  font-weight: 500;
}

.shares-progress {
  height: 6px;
  background-color: #dee2e6; /* var(--border-color); */
  border-radius: 3px;
  overflow: hidden;
  margin-top: 5px; /* $spacing-xs; */
  width: 100px;
}

.shares-progress-bar {
  height: 100%;
  background-color: #007bff; /* var(--primary-color); */
  transition: width 0.5s ease;
}

.check-back {
  margin-top: 15px; /* $spacing-md; */
  font-style: italic;
  color: #6c757d; /* var(--text-muted); */
}
</style> 
<template>
  <div class="decryption-failed">
     <div class="lock-container">
      <span class="lock-icon">🔓</span> <!-- Unlocked but failed -->
    </div>
    <h3>Decryption Failed</h3>
    <p>The results could not be decrypted.</p>
    
    <div class="requirements-list">
       <li>
         <span class="requirement-label">Status:</span>
         <div class="requirement-status-container">
            <span class="requirement-status warning">Failed</span>
         </div>
       </li>
       <li>
         <span class="requirement-label">Decryption Shares Submitted:</span>
         <div class="requirement-status-container">
           <span class="requirement-status" :class="{ 'completed': sharesSufficient, 'warning': !sharesSufficient }">
             {{ releasedKeys }} / {{ requiredKeys }}
           </span>
           <div class="shares-progress">
             <div class="shares-progress-bar" :style="{ width: sharesProgress + '%' }"></div>
           </div>
         </div>
       </li>
    </div>

    <div v-if="error" class="error-message">
      <strong>Error:</strong> {{ error }} 
    </div>
     <p v-else class="error-message">
       An unknown error occurred during the decryption process or the deadline passed with insufficient shares.
     </p>

    <!-- Consider adding info about potential deposit refunds -->
    <p class="check-back">Check your holder status below for information about potential deposit refunds.</p>
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
  error: { // Error message from parent component
      type: String,
      default: null
  }
});

const sharesSufficient = computed(() => props.releasedKeys >= props.requiredKeys);

const sharesProgress = computed(() => {
  if (props.requiredKeys <= 0) return 0;
  return Math.min((props.releasedKeys / props.requiredKeys) * 100, 100);
});

</script>

<style lang="scss" scoped>
/* Styles adapted from _vote-results.scss */
.decryption-failed {
  background-color: #f8d7da; /* var(--danger-light); */
  border: 1px solid #f5c6cb; /* Slightly darker red for border */
  border-radius: 4px; /* var(--border-radius); */
  padding: 30px 20px; /* 30px $spacing-lg; */
  text-align: center;
  max-width: 500px;
  margin: 20px auto; /* Added margin */
  color: #721c24; /* var(--danger-dark); */
}

.lock-container {
  margin-bottom: 15px; /* $spacing-md; */
}

.lock-icon {
  font-size: 40px;
  display: inline-block;
  color: #721c24; /* var(--danger-dark); */
  /* No animation for failed state */
}

.requirements-list {
  text-align: left;
  margin: 15px auto; /* $spacing-md auto; */
  padding-left: 0;
  list-style: none;
  max-width: 400px; /* Adjusted max-width */
  color: #721c24; /* Ensure text inside inherits color */
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
  color: #721c24; /* var(--danger-dark); */
  text-align: right;
}

.requirement-status.warning {
    color: #721c24; /* Keep dark red */
    font-weight: bold;
}

.requirement-status.completed {
  color: #155724; /* var(--success-dark); */
  font-weight: 500;
}

.shares-progress {
  height: 6px;
  background-color: #f5c6cb; /* Light red background */
  border-radius: 3px;
  overflow: hidden;
  margin-top: 5px; /* $spacing-xs; */
  width: 100px;
  border: 1px solid #721c24; /* Darker border for contrast */
}

.shares-progress-bar {
  height: 100%;
  background-color: #dc3545; /* var(--danger); */
  transition: width 0.5s ease;
}

.error-message {
  margin-top: 15px; /* $spacing-md; */
  font-weight: bold;
  color: #721c24; /* var(--danger-dark); */
}

.check-back {
  margin-top: 15px; /* $spacing-md; */
  font-style: italic;
  color: #721c24; /* var(--danger-dark); */
}
</style> 
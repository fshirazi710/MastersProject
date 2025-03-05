<template>
    <div class="results-section">
      <h2>Results</h2>
      <!-- Show pending state if not enough keys released -->
      <div v-if="!isDecrypted" class="decryption-pending">
        <div class="pending-message">
          <i class="lock-icon">🔒</i>
          <h3>Results are still encrypted</h3>
          <p>Waiting for secret holders to release their keys...</p>
          <!-- Progress bar for key release status -->
          <div class="key-progress">
            <div class="progress-bar">
              <div 
                class="progress" 
                :style="{ width: `${(releasedKeys / requiredKeys) * 100}%` }"
              ></div>
            </div>
            <span class="progress-text">
              {{ releasedKeys }}/{{ requiredKeys }} keys released
            </span>
          </div>
        </div>
      </div>
      <!-- Show results if decrypted -->
      <div v-else class="results-grid">
        <div v-for="option in options" :key="option.id" class="result-item">
          <div class="result-header">
            <span class="option-text">{{ option.text }}</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress" 
              :style="{ width: `${(option.votes / totalVotes) * 100}%` }"
            ></div>
          </div>
          <div class="percentage">
            {{ ((option.votes / totalVotes) * 100).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue'
  
  const props = defineProps({
    options: {
      type: Array,
      required: true
    },
    releasedKeys: {
      type: Number,
      required: true
    },
    requiredKeys: {
      type: Number,
      required: true
    }
  })
  
  // Compute if enough keys have been released to decrypt results
  const isDecrypted = computed(() => {
    return props.releasedKeys >= props.requiredKeys
  })
  
  // Compute total votes for percentage calculations
  const totalVotes = computed(() => {
    return props.options.reduce((sum, option) => sum + option.votes, 0)
  })
  </script>
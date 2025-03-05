<template>
    <div class="secret-holders-section">
      <h2>Secret Holders</h2>
      <p class="holders-description">
        Secret holders maintain encrypted keys that will be used to reveal the vote results
        after the voting period ends. A minimum of {{ requiredKeys }} keys are needed
        to decrypt the results.
      </p>
      <!-- Grid of secret holder cards -->
      <div class="holders-grid">
        <div v-for="holder in secretHolders" :key="holder.id" class="holder-card">
          <div class="holder-status" :class="holder.status"></div>
          <div class="holder-address">{{ truncateAddress(holder.address) }}</div>
          <div class="holder-info">
            <span class="label">Status:</span>
            <span>{{ holder.status }}</span>
          </div>
          <div v-if="voteStatus === 'ended'" class="key-status">
            {{ holder.hasReleasedKey ? 'Key Released' : 'Awaiting Key' }}
          </div>
        </div>
      </div>
    </div>
</template>
  
<script setup>
    const props = defineProps({
        secretHolders: {
            type: Array,
            required: true
        },
        requiredKeys: {
            type: Number,
            required: true
        },
        voteStatus: {
            type: String,
            required: true
        }
    })

    // Utility function to truncate blockchain addresses
    const truncateAddress = (address) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }
</script>
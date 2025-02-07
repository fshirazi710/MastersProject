<template>
  <div class="vote-details">
    <div class="vote-header">
      <div class="vote-status" :class="vote.status">
        {{ vote.status }}
      </div>
      <h1>{{ vote.title }}</h1>
      <p class="description">{{ vote.description }}</p>
    </div>

    <div class="vote-info-grid">
      <div class="info-card">
        <h3>Timeline</h3>
        <div class="timeline">
          <div class="time-item">
            <span class="label">Start Date:</span>
            <span>{{ formatDate(vote.startDate) }}</span>
          </div>
          <div class="time-item">
            <span class="label">End Date:</span>
            <span>{{ formatDate(vote.endDate) }}</span>
          </div>
          <div class="time-remaining" v-if="vote.status === 'active'">
            Time Remaining: {{ timeRemaining }}
          </div>
        </div>
      </div>

      <div class="info-card">
        <h3>Encryption Status</h3>
        <div class="encryption-status">
          <div class="status-item">
            <span class="label">Total Secret Holders:</span>
            <span>{{ vote.secretHolderCount }}</span>
          </div>
          <div class="status-item">
            <span class="label">Keys Required:</span>
            <span>{{ vote.requiredKeys }}</span>
          </div>
          <div v-if="vote.status === 'ended'" class="status-item">
            <span class="label">Keys Released:</span>
            <span>{{ vote.releasedKeys }}/{{ vote.requiredKeys }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="voting-section" v-if="vote.status === 'active'">
      <h2>Cast Your Vote</h2>
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>Your vote will be encrypted and remain secret until the voting period ends and all required keys are released.</p>
      </div>
      <form @submit.prevent="handleVote" class="voting-form">
        <div class="options-list">
          <label v-for="option in vote.options" :key="option.id" class="option-item">
            <input
              type="radio"
              :id="option.id"
              v-model="selectedOption"
              :value="option.id"
              name="vote-option"
              required
            >
            <div class="option-content">
              {{ option.text }}
            </div>
          </label>
        </div>
        <button type="submit" class="btn primary" :disabled="!selectedOption">
          Submit Encrypted Vote
        </button>
      </form>
    </div>

    <div v-if="vote.status === 'ended'" class="results-section">
      <h2>Results</h2>
      <div v-if="!isDecrypted" class="decryption-pending">
        <div class="pending-message">
          <i class="lock-icon">🔒</i>
          <h3>Results are still encrypted</h3>
          <p>Waiting for secret holders to release their keys...</p>
          <div class="key-progress">
            <div class="progress-bar">
              <div 
                class="progress" 
                :style="{ width: `${(vote.releasedKeys / vote.requiredKeys) * 100}%` }"
              ></div>
            </div>
            <span class="progress-text">
              {{ vote.releasedKeys }}/{{ vote.requiredKeys }} keys released
            </span>
          </div>
        </div>
      </div>
      <div v-else class="results-grid">
        <div v-for="option in vote.options" :key="option.id" class="result-item">
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

    <div class="secret-holders-section">
      <h2>Secret Holders</h2>
      <p class="holders-description">
        Secret holders maintain encrypted keys that will be used to reveal the vote results
        after the voting period ends. A minimum of {{ vote.requiredKeys }} keys are needed
        to decrypt the results.
      </p>
      <div class="holders-grid">
        <div v-for="holder in vote.secretHolders" :key="holder.id" class="holder-card">
          <div class="holder-status" :class="holder.status"></div>
          <div class="holder-address">{{ truncateAddress(holder.address) }}</div>
          <div class="holder-info">
            <span class="label">Status:</span>
            <span>{{ holder.status }}</span>
          </div>
          <div v-if="vote.status === 'ended'" class="key-status">
            {{ holder.hasReleasedKey ? 'Key Released' : 'Awaiting Key' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const selectedOption = ref(null)

// TODO: Replace with actual API call
const vote = ref({
  id: route.params.id,
  title: 'Community Governance Proposal',
  description: 'Vote on the new community guidelines and governance structure.',
  status: 'active',
  startDate: '2024-03-20T10:00:00',
  endDate: '2024-03-27T10:00:00',
  secretHolderCount: 5,
  requiredKeys: 3,
  releasedKeys: 0,
  options: [
    { id: 1, text: 'Approve New Guidelines' },
    { id: 2, text: 'Reject and Revise' },
    { id: 3, text: 'Maintain Current System' }
  ],
  secretHolders: [
    { 
      id: 1, 
      address: '0x1234...5678', 
      status: 'active',
      hasReleasedKey: false 
    },
    { 
      id: 2, 
      address: '0x8765...4321', 
      status: 'active',
      hasReleasedKey: false 
    }
  ]
})

const totalVotes = computed(() => {
  return vote.value.options.reduce((sum, option) => sum + option.votes, 0)
})

const timeRemaining = computed(() => {
  const end = new Date(vote.value.endDate)
  const now = new Date()
  const diff = end - now

  if (diff <= 0) return 'Ended'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `${days}d ${hours}h ${minutes}m`
})

const isDecrypted = computed(() => {
  return vote.value.releasedKeys >= vote.value.requiredKeys
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const truncateAddress = (address) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const handleVote = () => {
  // TODO: Implement vote submission
  console.log('Voted for option:', selectedOption.value)
}
</script>

<style scoped>
.vote-details {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.vote-header {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  position: relative;
}

.vote-status {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.vote-status.active {
  background-color: #00dc82;
  color: #1a1a1a;
}

.vote-status.upcoming {
  background-color: #f5f5f5;
  color: #1a1a1a;
}

.vote-status.ended {
  background-color: #ff4444;
  color: white;
}

.description {
  color: #666;
  margin-top: 1rem;
}

.vote-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.info-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.time-item {
  display: flex;
  justify-content: space-between;
}

.time-remaining {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
  font-weight: 500;
  color: #00dc82;
}

.encryption-status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
}

.label {
  font-size: 0.875rem;
  color: #666;
}

.voting-section,
.results-section,
.secret-holders-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.encryption-notice {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.lock-icon {
  font-size: 1.5rem;
}

.decryption-pending {
  text-align: center;
  padding: 3rem 2rem;
}

.pending-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.key-progress {
  margin-top: 1.5rem;
  width: 100%;
  max-width: 400px;
}

.progress-text {
  display: block;
  text-align: center;
  margin-top: 0.5rem;
  color: #666;
}

.holders-description {
  color: #666;
  margin-bottom: 2rem;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.option-item:hover {
  border-color: #00dc82;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: transform 0.2s, opacity 0.2s;
  width: 100%;
}

.primary {
  background-color: #00dc82;
  color: #1a1a1a;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-bar {
  height: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background-color: #00dc82;
  transition: width 0.3s ease;
}

.percentage {
  font-size: 0.875rem;
  color: #666;
}

.holders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.holder-card {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  position: relative;
}

.holder-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.holder-status.active {
  background-color: #00dc82;
}

.holder-status.pending {
  background-color: #ffd700;
}

.holder-address {
  font-family: monospace;
  margin-bottom: 0.5rem;
}

.holder-info {
  font-size: 0.875rem;
  color: #666;
}

.key-status {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666;
  text-align: center;
  padding-top: 0.5rem;
  border-top: 1px solid #ddd;
}

@media (max-width: 768px) {
  .vote-info-grid {
    grid-template-columns: 1fr;
  }
  
  .encryption-status {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style> 
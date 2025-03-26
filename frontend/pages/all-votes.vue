<template>
  <div class="all-votes">
    <h1>All Votes</h1>
    
    <!-- Search and filter controls -->
    <div class="filters">
      <!-- Search input field -->
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search votes..." 
          class="search-input"
        >
      </div>
      <!-- Status filter dropdown -->
      <div class="filter-options">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All Votes</option>
          <option value="join">Join</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
        </select>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading Votes...</p>
    </div>

    <!-- Grid of vote cards -->
    <div v-else>
      <!-- Conditionally render sections based on statusFilter -->
      <div v-for="status in ['join', 'active', 'ended']">
        <div v-if="statusFilter === 'all' || statusFilter === status">
          <h2>{{ capitalizeWords(status) }} Votes</h2>
          <div v-if="filteredVotes.filter(vote => vote.status === status).length === 0">
            <p>No votes found in this category.</p>
          </div>
          <div class="votes-grid">
            <div v-for="vote in filteredVotes.filter(vote => vote.status === status)" :key="vote.id" class="vote-card">
            <!-- Status badge (join/active/ended) -->
            <div class="vote-status" :class="vote.status">
              {{ vote.status }}
            </div>
            
            <!-- Vote title and description -->
            <h2>{{ vote.title }}</h2>
            <p class="description">{{ vote.description }}</p>
            
            <!-- Vote timing information -->
            <div class="vote-meta">
              <div class="meta-item">
                <span class="label">Start:</span>
                {{ formatDate(vote.startDate) }}
              </div>
              <div class="meta-item">
                <span class="label">End:</span>
                {{ formatDate(vote.endDate) }}
              </div>
            </div>
            
            <!-- Vote statistics -->
            <div class="vote-stats">
              <div class="stat">
                <span class="stat-value">{{ vote.participantCount }}</span>
                <span class="stat-label">Participants</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ vote.options.length }}</span>
                <span class="stat-label">Options</span>
              </div>
            </div>
            
            <!-- View details link -->
            <NuxtLink :to="`/vote/${vote.id}`" class="btn primary">
              {{ vote.status === 'join' ? 'Signup To Vote' : vote.status === 'active' ? 'Cast Vote' : 'View Results' }}
            </NuxtLink>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { voteApi } from '@/services/api'

const router = useRouter()
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')

// Computed property for filtered votes
const filteredVotes = computed(() => {
  if (!votes.value) return []
  
  return votes.value.filter(vote => {
    // Match by title or description text
    const matchesSearch = vote.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         vote.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    // Match by status
    const matchesStatus = statusFilter.value === 'all' || vote.status === statusFilter.value;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.endDate) - new Date(a.endDate)) //sort by end time
})

// Reactive reference for votes
const votes = ref([])

// Fetch votes from the FastAPI backend
const getVotes = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await voteApi.getAllVotes()

    // Transform the response data to match the expected format
    votes.value = response.data.map(vote => ({
      id: vote.id,
      title: vote.title || `Vote ${vote.vote_id}`,
      description: vote.description || 'No description available',
      status: vote.status || 'active',
      startDate: new Date(vote.start_date || Date.now()).toISOString(),
      endDate: new Date(vote.end_date || Date.now() + 86400000).toISOString(),
      options: vote.options || [],
      participantCount: vote.participant_count || 0,
      rewardPool: vote.reward_pool || 0,
      requiredDeposit: vote.required_deposit || 0
    }))
  } catch (err) {
    console.error("Failed to fetch votes:", err)
    error.value = "Failed to load votes. Please try again later."
  } finally {
    loading.value = false
  }
}

// Hook to execute the getVotes function when the component is mounted
onMounted(() => {
  getVotes()
})

// Format date strings for display
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const capitalizeWords = (str) => {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
</script>

<style lang="scss" scoped>
// Local styles for active votes page
.all-votes {
  // Add spacing below filters
  .filters {
    margin-bottom: $spacing-lg;
  }
  
  // Ensure search input takes full width
  .search-input {
    width: 100%;
  }

  // Styles for loading indicator
  .loading {
    text-align: center;
    font-size: 1.2em;
    color: #666;
  }
}

.loading {
  text-align: center;
  font-size: 1.2em;
  color: #666;

  // Spinner styles
  .spinner {
    border: 8px solid #f3f3f3; /* Light grey */
    border-top: 8px solid #3498db; /* Blue */
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto; /* Center the spinner */
  }
}

// Spinner animation
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 
<template>
  <div class="active-votes">
    <h1>Active Votes</h1>
    
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
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
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
    <div class="votes-grid" v-else>
      <!-- Individual vote card -->
      <div v-for="vote in filteredVotes" :key="vote.id" class="vote-card">
        <!-- Status badge (active/upcoming/ended) -->
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
          View Details
        </NuxtLink>
      </div>
    </div>

    <!-- Placeholder when no votes are found -->
    <div v-if="filteredVotes.length === 0 && !loading" class="no-results">
      <p>No votes found matching your criteria</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

// Search and filter state
const searchQuery = ref('')
const statusFilter = ref('all')
const loading = ref(true)

// Computed property for filtered votes
const filteredVotes = computed(() => {
  return votes.value.filter(vote => {
    // Match by title or description text
    const matchesSearch = vote.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         vote.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    // Match by status (all or specific status)
    const matchesStatus = statusFilter.value === 'all' || vote.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

// Reactive reference for votes
const votes = ref([])

// This line sets the middleware for authentication
definePageMeta({
  middleware: 'auth'
})

// Fetch votes from the FastAPI backend
const getVotes = () => {
  loading.value = true
  axios.get("http://127.0.0.1:8000/all-votes")
    .then(response => {
      votes.value = response.data.data
    })
    .catch(error => {
      console.error("Failed to fetch votes:", error)
    })
    .finally(() => {
      loading.value = false
    })
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
</script>

<style lang="scss" scoped>
// Local styles for active votes page
.active-votes {
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
<template>
  <div class="active-votes">
    <h1>Active Votes</h1>
    
    <div class="filters">
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search votes..." 
          class="search-input"
        >
      </div>
      <div class="filter-options">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All Votes</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="ended">Ended</option>
        </select>
      </div>
    </div>

    <div class="votes-grid">
      <div v-for="vote in filteredVotes" :key="vote.id" class="vote-card">
        <div class="vote-status" :class="vote.status">
          {{ vote.status }}
        </div>
        <h2>{{ vote.title }}</h2>
        <p class="description">{{ vote.description }}</p>
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
        <div class="vote-stats">
          <div class="stat">
            <span class="stat-value">{{ vote.participantCount }}</span>
            <span class="stat-label">Participants</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ vote.optionCount }}</span>
            <span class="stat-label">Options</span>
          </div>
        </div>
        <NuxtLink :to="`/vote/${vote.id}`" class="btn primary">
          View Details
        </NuxtLink>
      </div>
    </div>

    <!-- Placeholder when no votes are found -->
    <div v-if="filteredVotes.length === 0" class="no-results">
      <p>No votes found matching your criteria</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// TODO: Replace with actual API call
const votes = ref([
  {
    id: 1,
    title: 'Community Governance Proposal',
    description: 'Vote on the new community guidelines and governance structure',
    startDate: '2024-03-20T10:00:00',
    endDate: '2024-03-27T10:00:00',
    status: 'active',
    participantCount: 156,
    optionCount: 3
  },
  {
    id: 2,
    title: 'Technical Committee Election',
    description: 'Select members for the technical advisory committee',
    startDate: '2024-03-25T00:00:00',
    endDate: '2024-04-01T00:00:00',
    status: 'upcoming',
    participantCount: 0,
    optionCount: 5
  },
  // Add more mock data as needed
])

const searchQuery = ref('')
const statusFilter = ref('all')

const filteredVotes = computed(() => {
  return votes.value.filter(vote => {
    const matchesSearch = vote.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         vote.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesStatus = statusFilter.value === 'all' || vote.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
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
</script>

<style scoped>
.active-votes {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.filter-select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 150px;
}

.votes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
}

.vote-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  display: flex;
  flex-direction: column;
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

.vote-card h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  padding-right: 5rem;
}

.description {
  color: #666;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.vote-meta {
  margin-bottom: 1rem;
}

.meta-item {
  margin-bottom: 0.5rem;
}

.label {
  font-weight: 500;
  margin-right: 0.5rem;
}

.vote-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  padding: 1rem 0;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #00dc82;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: transform 0.2s, opacity 0.2s;
  text-decoration: none;
  text-align: center;
}

.primary {
  background-color: #00dc82;
  color: #1a1a1a;
}

.btn:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}

.no-results {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  color: #666;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }
  
  .search-bar {
    width: 100%;
  }
  
  .filter-options {
    width: 100%;
  }
  
  .filter-select {
    width: 100%;
  }
}
</style> 
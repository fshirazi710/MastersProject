<template>
  <div class="all-votes-page">
    <h1>All Vote Sessions</h1>
    
    <!-- Search and filter controls -->
    <div class="controls">
      <!-- Search input field -->
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search vote sessions..." 
          class="search-input"
        >
      </div>
      <!-- Status filter dropdown -->
      <div class="filter-options">
        <select v-model="filterStatus" class="filter-select">
          <option value="all">All Vote Sessions</option>
          <option value="join">Joinable Sessions</option>
          <option value="active">Active Sessions</option>
          <option value="ended">Ended Sessions</option>
        </select>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading sessions...</p>
    </div>

    <!-- Error message -->
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Vote Sections (Updated to use 'session' and 'filteredSessions') -->
    <div v-if="!loading && !error">
      <section v-for="status in ['join', 'active', 'ended']" v-if="filterStatus === 'all' || filterStatus === status" :key="status">
        <h2>{{ capitalizeWords(status) }} Vote Sessions</h2>
        <div v-if="filteredSessions.filter(session => session.status === status).length === 0">
          <p>No vote sessions found in this category.</p>
        </div>
        <div class="votes-grid" v-else>
          <div v-for="session in filteredSessions.filter(s => s.status === status)" :key="session.id" class="vote-card">
            <div class="vote-status" :class="session.status">
              {{ session.status }}
            </div>
            <h2>{{ session.title }}</h2>
            <p class="description">{{ session.description }}</p>
            <div class="vote-meta">
              <div class="meta-item">
                <span class="label">Start:</span>
                {{ formatDate(session.startDate) }}
              </div>
              <div class="meta-item">
                <span class="label">End:</span>
                {{ formatDate(session.endDate) }}
              </div>
            </div>
            <div class="vote-stats">
              <div class="stat">
                <span class="stat-value">{{ session.participantCount }}</span>
                <span class="stat-label">Participants</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ session.secretHolderCount }}</span>
                <span class="stat-label">Secret Holders</span>
              </div>
            </div>
            <!-- Update link path segment to /session/ -->
            <NuxtLink :to="`/session/${session.id}`" class="btn primary">
              {{ session.status === 'join' ? 'Signup' : session.status === 'active' ? 'Cast Vote' : 'View Results' }}
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
// Import voteSessionApi and holderApi
import { voteSessionApi, holderApi } from '@/services/api'

const router = useRouter()
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const filterStatus = ref('all')

// Rename votes -> sessions
const sessions = ref([])

// Fetch sessions from the FastAPI backend
// Rename getVotes -> getSessions
const getSessions = async () => {
  loading.value = true
  error.value = null
  
  try {
    // Use voteSessionApi.getAllVoteSessions
    const response = await voteSessionApi.getAllVoteSessions()
    const sessionData = response.data.data // Assuming backend returns session data

    // Asynchronously fetch holder counts for each session
    // Rename vote -> session
    const sessionsWithCounts = await Promise.all(sessionData.map(async (session) => {
      let holderCount = 0;
      try {
        // Use session.id (assuming the ID field is named 'id')
        const holderResponse = await holderApi.getHolderCount(session.id);
        holderCount = holderResponse.data.data.count || 0;
      } catch (holderErr) {
        console.error(`Failed to fetch holder count for session ${session.id}:`, holderErr);
      }

      // Transform the response data, including the fetched holder count
      // Ensure field names match backend response (e.g., session.id, session.start_date)
      return {
        id: session.id, 
        title: session.title || `Vote Session ${session.id}`,
        description: session.description || 'No description available',
        status: session.status || 'active',
        startDate: new Date(session.start_date || Date.now()).toISOString(),
        endDate: new Date(session.end_date || Date.now() + 86400000).toISOString(),
        options: session.options || [],
        participantCount: session.participant_count || 0, 
        rewardPool: session.reward_pool || 0,
        requiredDeposit: session.required_deposit || 0,
        secretHolderCount: holderCount 
      }
    }));

    sessions.value = sessionsWithCounts;

  } catch (err) {
    console.error("Failed to fetch sessions:", err) // Update log message
    error.value = "Failed to load sessions. Please try again later."
  } finally {
    loading.value = false
  }
}

// Hook to execute the getSessions function when the component is mounted
onMounted(() => {
  getSessions()
})

// Update computed property to use 'sessions'
// Rename filteredVotes -> filteredSessions
const filteredSessions = computed(() => {
  if (!sessions.value) return []
  
  // Rename vote -> session
  return sessions.value.filter(session => {
    // Match by title or description text
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         session.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    // Match by status
    const matchesStatus = filterStatus.value === 'all' || session.status === filterStatus.value;

    return matchesSearch && matchesStatus;
  });
})

// Format date strings for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
  } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Invalid Date';
  }
}

// Capitalize words helper function
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
</script>

<style lang="scss" scoped>
// Local styles for active sessions page
.all-votes-page { // Keep class name or update if needed
  // Add spacing below filters
  .controls {
    margin-bottom: 20px; // Use SCSS variable if available: $spacing-lg;
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
    margin-top: 20px;
  }

  // Styles for error message
  .error-message {
    text-align: center;
    color: red;
    margin-top: 20px; // Use SCSS variable if available: $spacing-md;
  }
  
  section {
      margin-bottom: 30px; // Add space between status sections
  }
  
  h2 {
      margin-bottom: 15px; // Space below section titles
      border-bottom: 1px solid #ccc; // Optional: Add separator
      padding-bottom: 10px;
  }
  
  .votes-grid { // Keep class name or update if needed
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px; // Use SCSS variable if available: $spacing-md;
  }
  
  .vote-card { // Keep class name or update if needed
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 8px;
      background-color: #f9f9f9;
      display: flex;
      flex-direction: column;
      
      h2 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 1.2em;
          border-bottom: none; // Remove double border
          padding-bottom: 0;
      }
      
      .description {
          font-size: 0.9em;
          color: #555;
          flex-grow: 1; // Allow description to take space
          margin-bottom: 15px;
      }
      
      .vote-meta, .vote-stats {
          font-size: 0.85em;
          color: #777;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
      }
      
      .meta-item, .stat {
          display: flex;
          flex-direction: column; // Stack label and value
      }
      
      .label, .stat-label {
          font-weight: 500;
          margin-bottom: 2px;
      }
      
      .vote-status {
          align-self: flex-start;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: capitalize;
          
          &.join { background-color: #e0f2fe; color: #0ea5e9; }
          &.active { background-color: #dcfce7; color: #22c55e; }
          &.ended { background-color: #f1f5f9; color: #64748b; }
      }
      
      .btn {
          margin-top: auto; // Push button to bottom
          width: 100%;
          text-align: center;
      }
  }
}

// Spinner animation (assuming this is global or defined elsewhere)
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spinner {
    border: 8px solid #f3f3f3; /* Light grey */
    border-top: 8px solid #3498db; /* Blue */
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 20px auto; /* Center the spinner */
}
</style> 
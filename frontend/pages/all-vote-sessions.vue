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
          <option value="pending">Pending / Registration</option>
          <option value="votingopen">Voting Open</option>
          <option value="votingclosed">Voting Closed</option>
          <option value="tallying">Tallying Results</option>
          <option value="complete">Complete</option>
          <!-- Add other relevant statuses like Aborted if applicable -->
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

    <div v-if="!loading && !error">
      <!-- Display logic adjusted based on actual status values from API -->
      <section v-for="displayStatus in relevantStatuses" :key="displayStatus.value">
        <template v-if="filterStatus === 'all' || filterStatus === displayStatus.value">
          <h2>{{ displayStatus.label }} Vote Sessions</h2>
          <div v-if="sessionsByStatus[displayStatus.value] && sessionsByStatus[displayStatus.value].length === 0">
            <p>No vote sessions found in this category.</p>
          </div>
          <div class="votes-grid" v-else>
            <!-- Iterate over paginated and then filtered by status for the section -->
            <div v-for="session in getPaginatedSessionsForStatus(displayStatus.value)" :key="session.id" class="vote-card">
              <div class="vote-status" :class="session.status ? session.status.toLowerCase() : 'unknown'">
                {{ session.status || 'Unknown' }}
              </div>
              <h2>{{ session.title || `Vote Session ${session.id}` }}</h2>
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
              <NuxtLink :to="`/session/${session.id}`" class="btn primary">
                View Details
              </NuxtLink>
            </div>
          </div>
        </template>
      </section>
      <div v-if="filteredSessions.length === 0 && filterStatus !== 'all'">
         <p>No vote sessions found for the selected filter.</p>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="!loading && !error && totalPages > 1" class="pagination-controls">
      <button @click="prevPage" :disabled="currentPage === 1" class="pagination-button">
        Previous
      </button>
      <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage === totalPages" class="pagination-button">
        Next
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
// Import voteSessionApi and remove holderApi import
import { voteSessionApi } from '@/services/api'

const router = useRouter()
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const filterStatus = ref('all')
const sessions = ref([])
const currentPage = ref(1)
const itemsPerPage = ref(9) // Show 9 items per page, good for a 3-column grid

// Define relevant statuses for display and filtering
// Aligned with Backend API documentation examples: "Pending", "VotingOpen", "VotingClosed", "Tallying", "Complete"
const relevantStatuses = [
  { value: 'pending', label: 'Pending / Registration' },
  { value: 'votingopen', label: 'Voting Open' },
  { value: 'votingclosed', label: 'Voting Closed' },
  { value: 'tallying', label: 'Tallying Results' },
  { value: 'complete', label: 'Completed' },
  // Consider adding { value: 'aborted', label: 'Aborted' } if the API can return this status.
]

// Fetch sessions from the FastAPI backend
// Rename getVotes -> getSessions
const getSessions = async () => {
  loading.value = true
  error.value = null
  
  try {
    // Use voteSessionApi.getAllVoteSessions
    const response = await voteSessionApi.getAllVoteSessions()
    // Assuming response.data is the StandardResponse object: { success, message, data: SessionApiResponseItem[] }
    if (response.data && response.data.success) {
      sessions.value = response.data.data.map(session => ({
        id: session.id,
        title: session.title || `Vote Session ${session.id}`,
        // description: session.description, // Only include if present in SessionApiResponseItem
        status: session.status, // Raw status from API
        startDate: session.startDate, // Already ISO string as per backend doc
        endDate: session.endDate,     // Already ISO string as per backend doc
        voteSessionAddress: session.vote_session_address,
        participantRegistryAddress: session.participant_registry_address,
        // participantCount and secretHolderCount are not available in SessionApiResponseItem
      }))
    } else {
      throw new Error(response.data.message || 'Failed to fetch sessions due to backend error.')
    }

    // Removed asynchronous fetch for holder counts as it's not available in summary and holderApi is removed

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

// Group sessions by their status for easier rendering in sections
const sessionsByStatus = computed(() => {
  const grouped = {}
  relevantStatuses.forEach(statusInfo => {
    grouped[statusInfo.value] = filteredSessions.value.filter(s => s.status && s.status.toLowerCase() === statusInfo.value.toLowerCase())
  })
  // If filterStatus is 'all', this will contain all sessions grouped.
  // If a specific filter is selected, only that group will be effectively non-empty if we also filter sections in template.
  // The template logic v-if="filterStatus === 'all' || filterStatus === displayStatus.value" handles section visibility.
  return grouped
})

const totalPages = computed(() => {
  return Math.ceil(filteredSessions.value.length / itemsPerPage.value);
});

// This computed property will provide the sessions for the CURRENT page overall.
const paginatedFilteredSessions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredSessions.value.slice(start, end);
});

// Function to get sessions for the current page that match a specific status
// This is used by the template to render cards within each status section
const getPaginatedSessionsForStatus = (statusValue) => {
  return paginatedFilteredSessions.value.filter(s => s.status && s.status.toLowerCase() === statusValue.toLowerCase());
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

// Watch for changes in filters (searchQuery, filterStatus) to reset to page 1
// This provides a better UX than being on page 5 of a new, smaller filtered list.
watch([searchQuery, filterStatus], () => {
  currentPage.value = 1;
});

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
// Import built-in sass:color module to use color.adjust()
@use 'sass:color';
// Import variables at the top of the scoped style block
@use '@/assets/styles/_variables.scss' as *;
@use '@/assets/styles/_mixins.scss' as *; // Import mixins if needed

// Local styles for active sessions page
.all-votes-page { 
  .controls {
    margin-bottom: $spacing-lg; // Use variable
    display: flex;
    gap: $spacing-md; // Use variable
  }
  
  .search-bar {
    flex-grow: 1;
  }

  .search-input {
    width: 100%;
    padding: $spacing-sm $spacing-md; // Use variables
    border-radius: $border-radius; // Use variable
    border: 1px solid $border-color; // Use variable
  }

  .filter-select {
    padding: $spacing-sm $spacing-md; // Use variables
    border-radius: $border-radius; // Use variable
    border: 1px solid $border-color; // Use variable
    min-width: 200px;
  }

  .loading {
    text-align: center;
    font-size: 1.2em;
    color: $text-secondary; // Use variable
    margin-top: $spacing-lg; // Use variable
  }

  .error-message {
    text-align: center;
    color: red; // Keep specific error color or define a variable like $error-color
    margin-top: $spacing-lg; // Use variable
  }
  
  section {
      margin-bottom: $spacing-xl; // Use variable
  }
  
  h2 {
      margin-bottom: $spacing-md; // Use variable
      border-bottom: 1px solid $border-color; // Use variable
      padding-bottom: $spacing-md; // Use variable
      font-size: 1.5em; 
  }
  
  .votes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: $spacing-lg; // Use variable
      margin-bottom: $spacing-lg; // Use variable
  }
  
  .vote-card {
      border: 1px solid $border-color; // Use variable
      padding: $spacing-md; // Use variable
      border-radius: $border-radius; // Use variable
      background-color: #fff; // Changed from #f9f9f9 for a cleaner look, consider a variable $card-background-color
      display: flex;
      flex-direction: column;
      @include card-shadow; // Use mixin
      transition: transform $transition-speed ease-in-out; // Use variable

      &:hover {
        transform: translateY(-5px);
      }
      
      h2 {
          margin-top: 0;
          margin-bottom: $spacing-sm; // Adjusted spacing
          font-size: 1.2em;
          border-bottom: none; 
          padding-bottom: 0;
          color: $text-color; // Use variable
      }
      
      .description {
          font-size: 0.9em;
          color: $text-secondary; // Use variable
          flex-grow: 1; 
          margin-bottom: $spacing-md; // Use variable
      }
      
      .vote-meta { // Removed .vote-stats selector
          font-size: 0.85em;
          color: $text-secondary; // Use variable
          margin-bottom: $spacing-md; // Use variable
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: $spacing-md; // Use variable
      }
      
      .meta-item { // Removed .stat selector
          display: flex;
          flex-direction: column; 
      }
      
      .label { // Removed .stat-label selector
          font-weight: 500;
          margin-bottom: 2px;
          color: $text-color; // Use variable (made slightly darker)
      }
      
      .vote-status {
          align-self: flex-start;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75em;
          font-weight: bold;
          margin-bottom: $spacing-md; // Use variable
          text-transform: capitalize;
          border: 1px solid transparent;
          
          // Define status colors based on actual status strings from API
          // Consider moving these to _variables.scss if used elsewhere
          // Example status colors (adjust to your actual statuses and desired colors)
          &.pending { background-color: #e0f2fe; color: #0ea5e9; border-color: #bae6fd; }
          &.votingopen { background-color: #dcfce7; color: #22c55e; border-color: #bbf7d0; }
          &.votingclosed { background-color: #e2e8f0; color: #475569; border-color: #cbd5e1; }
          &.tallying { background-color: #ffedd5; color: #f97316; border-color: #fed7aa; } 
          &.complete { background-color: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
          &.aborted { background-color: #fee2e2; color: #ef4444; border-color: #fecaca; } 
          &.unknown { background-color: #f3f4f6; color: #6b7280; border-color: #e5e7eb;}
      }
      
      .btn {
          margin-top: auto; 
          width: 100%;
          text-align: center;
          padding: $spacing-sm $spacing-md; // Use variables
          background-color: $primary-color; // Use variable
          color: white; // Assuming white text on primary color
          border: none;
          border-radius: $border-radius; // Use variable
          text-decoration: none;
          transition: background-color $transition-speed ease; // Use variable

          &:hover {
            // Define a hover color, maybe darken($primary-color, 10%) or a dedicated variable
            // background-color: darken($primary-color, 10%); 
            // Use modern Sass color function instead of deprecated darken()
            background-color: color.adjust($primary-color, $lightness: -10%); 
          }
      }
  }
}

// Spinner animation (assuming this is global or defined elsewhere)
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spinner {
    border: 8px solid #f3f3f3; 
    border-top: 8px solid $primary-color; // Use variable for spinner color
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: $spacing-lg auto; // Use variable
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: $spacing-xl; // Use variable
  margin-bottom: $spacing-lg; // Use variable
  gap: $spacing-md; // Use variable
}

.pagination-button {
  padding: $spacing-sm $spacing-md; // Use variables
  border: 1px solid $primary-color; 
  background-color: white;
  color: $primary-color; 
  border-radius: $border-radius; // Use variable
  cursor: pointer;
  transition: background-color $transition-speed ease, color $transition-speed ease; // Use variable

  &:hover:not(:disabled) {
    background-color: $primary-color; 
    color: white;
  }

  &:disabled {
    border-color: $border-color; // Use variable
    color: $border-color; // Use variable
    cursor: not-allowed;
  }
}

.page-info {
  margin: 0 $spacing-md; // Use variable
  color: $text-secondary; // Use variable
  font-weight: 500;
}
</style> 
import axios from 'axios';
import { config } from '../config';

// Create axios instance with base URL from config
const apiClient = axios.create({
  baseURL: config.api.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token if available
apiClient.interceptors.request.use(
  (config) => {
    // Guard localStorage access for SSR
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API service for authentication
export const authApi = {
  // Register a new user
  register: (userData) => {
    return apiClient.post('/api/auth/register', userData);
  },

  // Login user
  login: (credentials) => {
    // Create URLSearchParams for proper form encoding
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    // Send as form data with appropriate content type
    return apiClient.post('/api/auth/login', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },
};

// --- Resolved Conflict Area 1 ---
// Kept the start of electionApi from user-testing branch
// API service for elections
export const electionApi = {
  // Create a new election (from user-testing)
  createElection: (electionData) => {
    return apiClient.post('/api/elections/create-election', electionData);
  },

  // Get all elections (common part)
  getAllElections: () => {
    return apiClient.get('/api/elections/all-elections');
  },

  // Check winners (common part)
  checkWinners: (election_id, data) => {
    return apiClient.post(`/api/elections/get-winners/${election_id}`, data);
  },

  // Submit email (common part)
  submitEmail: (election_id, data) => {
    return apiClient.post(`/api/elections/submit-email/${election_id}`, data);
  },

// --- Resolved Conflict Area 2 ---
  // Get election by ID (from user-testing)
  getElectionById: (electionId) => {
    return apiClient.get(`/api/elections/election/${electionId}`);
  },
  // Note: Discarded createVote from the main branch here, as it logically belongs in voteApi below.

  // --- Add function to get metadata --- (common part after conflict)
  getElectionMetadata: (electionId) => {
    return apiClient.get(`/api/elections/election/${electionId}/metadata`);
  }
  // -----------------------------------
}; // End of electionApi

// API service for votes (this contains functions previously defined in main/elsewhere)
export const voteApi = {
  // Submit a vote
  submitVote: (electionId, voteData) => {
    return apiClient.post(`/api/votes/submit-vote/${electionId}`, voteData);
  },

  // Retrieve vote information for a specific election
  getVoteInformation: (electionId) => {
    return apiClient.post(`/api/votes/get-vote-information/${electionId}`);
  },

  // Store Public Key
  storePublicKey: (electionId, data) => {
    return apiClient.post(`/api/votes/store-public-key/${electionId}`, data);
  },

  // Validate Public Key
  validatePublicKey: (data) => {
    return apiClient.post(`/api/votes/validate-public-key`, data);
  },

  // Note: If the 'getAllVotes' function from the main branch conflict (api/votes/all-elections)
  // is still required, it should be added here within voteApi.
  // For example:
  // getAllVotes: () => {
  //   return apiClient.get('/api/votes/all-elections');
  // },
}; // End of voteApi

// API service for holders
export const holderApi = {
  // Get all holders
  getAllHolders: (election_id) => {
    return apiClient.get(`/api/holders/${election_id}`);
  },

  // Get holder count
  getHolderCount: (election_id) => {
    return apiClient.get(`/api/holders/count/${election_id}`);
  },

  // Join as holder
  joinAsHolder: (election_id, data) => {
    return apiClient.post(`/api/holders/join/${election_id}`, data);
  },
};

// API service for shares
export const shareApi = {
  // Submit a share
  submitShare: (electionId, data) => {
    return apiClient.post(`/api/shares/submit-share/${electionId}`, data)
  },

  // Decryption status
  decryptionStatus: (electionId) => {
    return apiClient.get(`/api/shares/decryption-status/${electionId}`)
  },

  // Verify a share
  verifyShare: (voteId, holderAddress, share) => {
    return apiClient.post('/api/shares/verify', { vote_id: voteId, holder_address: holderAddress, share });
  },

  // Get submitted shares for a vote
  getShares: (voteId) => {
    return apiClient.get(`/api/shares/get-shares/${voteId}`);
  },
};

// Ensure all necessary APIs are exported
export default {
  auth: authApi,
  vote: voteApi,
  holder: holderApi,
  share: shareApi,
  election: electionApi, // Make sure electionApi is included
};
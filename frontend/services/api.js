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

// Rename: electionApi -> voteSessionApi
export const voteSessionApi = {
  // Rename: createElection -> createVoteSession, update endpoint
  createVoteSession: (voteSessionData) => {
    return apiClient.post('/api/vote-sessions/create', voteSessionData);
  },

  // Rename: getAllElections -> getAllVoteSessions, update endpoint
  getAllVoteSessions: () => {
    return apiClient.get('/api/vote-sessions/all');
  },

  // Rename: getElectionById -> getVoteSessionById, update endpoint and param
  getVoteSessionById: (voteSessionId) => {
    return apiClient.get(`/api/vote-sessions/session/${voteSessionId}`);
  },

  // Rename: getElectionMetadata -> getVoteSessionMetadata, update endpoint and param
  getVoteSessionMetadata: (voteSessionId) => {
    return apiClient.get(`/api/vote-sessions/session/${voteSessionId}/metadata`);
  }
};

// API service for votes (individual encrypted votes within a session)
// Rename voteApi -> encryptedVoteApi
export const encryptedVoteApi = {
  // Rename submitVote -> submitEncryptedVote, update endpoint
  submitEncryptedVote: (voteSessionId, voteData) => {
    return apiClient.post(`/api/encrypted-votes/submit/${voteSessionId}`, voteData);
  },

  // Rename getVoteInformation -> getEncryptedVoteInfo, update endpoint
  getEncryptedVoteInfo: (voteSessionId) => {
    return apiClient.post(`/api/encrypted-votes/info/${voteSessionId}`);
  },

  // Keep validatePublicKey as is
  validatePublicKey: (data) => {
    return apiClient.post(`/api/votes/validate-public-key`, data);
  },
};

// API service for holders (participants acting as secret holders for a session)
export const holderApi = {
  // Rename param: election_id -> voteSessionId, update endpoint
  getAllHolders: (voteSessionId) => {
    return apiClient.get(`/api/holders/all/${voteSessionId}`);
  },

  // Rename param: election_id -> voteSessionId, update endpoint
  getHolderCount: (voteSessionId) => {
    return apiClient.get(`/api/holders/count/${voteSessionId}`);
  },

  // Rename param: election_id -> voteSessionId, update endpoint
  joinAsHolder: (voteSessionId, data) => {
    return apiClient.post(`/api/holders/join/${voteSessionId}`, data);
  },
};

// API service for shares (secret shares related to a session)
export const shareApi = {
  // Rename param: electionId -> voteSessionId, update endpoint
  submitShare: (voteSessionId, data) => {
    return apiClient.post(`/api/shares/submit-share/${voteSessionId}`, data)
  },

  // Rename param: electionId -> voteSessionId, update endpoint
  decryptionStatus: (voteSessionId) => {
    return apiClient.get(`/api/shares/decryption-status/${voteSessionId}`)
  },

  // Keep verifyShare as is (refers to individual vote_id)
  verifyShare: (voteId, holderAddress, share) => {
    return apiClient.post('/api/shares/verify', { vote_id: voteId, holder_address: holderAddress, share });
  },

  // Rename param: voteId -> voteSessionId, update endpoint
  getShares: (voteSessionId) => {
    return apiClient.get(`/api/shares/get-shares/${voteSessionId}`);
  },
};

// Ensure all necessary APIs are exported
export default {
  auth: authApi,
  // Rename vote -> encryptedVote
  encryptedVote: encryptedVoteApi,
  holder: holderApi,
  share: shareApi,
  voteSession: voteSessionApi, 
};
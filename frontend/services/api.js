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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// API service for votes
export const voteApi = {
  // Get all votes
  getAllVotes: () => {
    return apiClient.get('/api/votes/all-elections');
  },
  
  // Get vote summary
  getVoteSummary: () => {
    return apiClient.get('/api/votes/summary');
  },
  
  // Get vote by ID
  getVoteById: (voteId) => {
    return apiClient.get(`/api/votes/election/${voteId}`);
  },
  
  // Submit a vote
  submitVote: (voteData) => {
    return apiClient.post('/api/votes', voteData);
  },
  
  // Create a new vote
  createVote: (voteData) => {
    return apiClient.post('/api/votes/create-election', voteData);
  },
  
  // Generate a voting token
  generateToken: (voteId) => {
    return apiClient.post(`/api/votes/tokens/${voteId}`);
  },
  
  // Validate a voting token
  validateToken: (token) => {
    return apiClient.get('/api/votes/tokens/validate', { params: { token } });
  },
  
  // Get share status for a vote
  getShareStatus: (voteId) => {
    return apiClient.get(`/api/votes/${voteId}/shares`);
  },

  // Get share status for a vote
  getSecretShares: (voteId, public_key) => {
    return apiClient.post(`/api/votes/get-secret-shares/${voteId}`, {public_key: public_key});
  },

  // PENDING
  getVoteInformation: (electionId) => {
    return apiClient.post(`/api/votes/get-vote-information/${electionId}`);
  },
  
  // Decrypt a vote
  decryptVote: (voteId, threshold = null) => {
    const payload = threshold ? { threshold } : {};
    return apiClient.post(`/api/votes/${voteId}/decrypt`, payload);
  },

  // Store Public Key
  storePublicKey: (voteId, data) => {
    return apiClient.post(`/api/votes/store-public-key/${voteId}`, data);
  },

  // Validate Public Key
  validatePublicKey: (data) => {
    return apiClient.post(`/api/votes/validate-public-key`, data);
  },
};

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
  
  // Check holder status
  checkHolderStatus: (address) => {
    return apiClient.get(`/api/holders/status/${address}`);
  },
  
  // Get required deposit
  getRequiredDeposit: () => {
    return apiClient.get('/api/holders/deposit');
  },
  
  // Join as holder
  joinAsHolder: (election_id, publicKey) => {
    return apiClient.post(`/api/holders/join/${election_id}`, { public_key: publicKey });
  },

  // Join as holder
  submitSecretKey: (election_id, privateKey) => {
    return apiClient.post(`/api/holders/submit-secret-key/${election_id}`, { secret_key: privateKey });
  },
};

// API service for shares
export const shareApi = {
  // Submit a share
  submitShare: (voteId, shareIndex, shareValue) => {
    return apiClient.post('/api/shares', { vote_id: voteId, share_index: shareIndex, share_value: shareValue });
  },
  
  // Verify a share
  verifyShare: (voteId, holderAddress, share) => {
    return apiClient.post('/api/shares/verify', { vote_id: voteId, holder_address: holderAddress, share });
  },
  
  // Get submitted shares for a vote
  getSubmittedShares: (voteId) => {
    return apiClient.get(`/api/shares/by-vote/${voteId}`);
  },
};

export default {
  auth: authApi,
  vote: voteApi,
  holder: holderApi,
  share: shareApi,
}; 
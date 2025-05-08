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
  // Register a new user (Assuming this is a separate auth system as it's not in Backend API Doc for core voting)
  register: (userData) => {
    return apiClient.post('/api/auth/register', userData);
  },

  // Login user (Assuming this is a separate auth system)
  login: (credentials) => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.email); // Assuming 'email' maps to 'username'
    formData.append('password', credentials.password);
    return apiClient.post('/api/auth/login', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },
};

export const voteSessionApi = {
  // NOTE: createVoteSession via API is not in Backend API Doc. Session creation is via factory contract.
  // createVoteSession: (voteSessionData) => {
  //   return apiClient.post('/api/vote-sessions/create', voteSessionData);
  // },

  getAllVoteSessions: () => {
    // Matches Backend API: GET /api/vote-sessions/all
    return apiClient.get('/api/vote-sessions/all');
  },

  getVoteSessionById: (voteSessionId) => {
    // Matches Backend API: GET /api/vote-sessions/session/{vote_session_id}
    return apiClient.get(`/api/vote-sessions/session/${voteSessionId}`);
  },

  getVoteSessionStatus: (voteSessionId) => {
    // Added: Matches Backend API: GET /api/vote-sessions/session/{vote_session_id}/status
    return apiClient.get(`/api/vote-sessions/session/${voteSessionId}/status`);
  },

  getVoteSessionMetadata: (voteSessionId) => {
    // Matches Backend API: GET /api/vote-sessions/session/{vote_session_id}/metadata
    return apiClient.get(`/api/vote-sessions/session/${voteSessionId}/metadata`);
  }
};

export const encryptedVoteApi = {
  // NOTE: submitEncryptedVote via API is not in Backend API Doc. Votes are cast via VoteSession contract.
  // submitEncryptedVote: (voteSessionId, voteData) => {
  //   return apiClient.post(`/api/encrypted-votes/submit/${voteSessionId}`, voteData);
  // },

  getEncryptedVoteInfo: (voteSessionId) => {
    // Matches Backend API: POST /api/encrypted-votes/info/{vote_session_id}
    // Backend API Doc specifies an empty request body for this POST request.
    return apiClient.post(`/api/encrypted-votes/info/${voteSessionId}`, {});
  },

  validatePublicKey: (publicKeyData) => {
    // Matches Backend API: POST /api/encrypted-votes/validate-public-key
    // Expects: { "public_key": "0x..." }
    return apiClient.post('/api/encrypted-votes/validate-public-key', publicKeyData);
  },

  checkVoteEligibility: (voteSessionId, voterAddressData) => {
    // Added: Matches Backend API: POST /api/encrypted-votes/eligibility/{vote_session_id}
    // Expects: { "voter_address": "0x..." }
    return apiClient.post(`/api/encrypted-votes/eligibility/${voteSessionId}`, voterAddressData);
  }
};

// Renamed from holderApi to participantApi to align with Backend API Doc
export const participantApi = {
  getAllParticipantsForSession: (voteSessionId) => {
    // Updated: Matches Backend API: GET /api/sessions/{vote_session_id}/participants/
    return apiClient.get(`/api/sessions/${voteSessionId}/participants/`);
  },

  getParticipantDetails: (voteSessionId, participantAddress) => {
    // Added: Matches Backend API: GET /api/sessions/{vote_session_id}/participants/{participant_address}
    return apiClient.get(`/api/sessions/${voteSessionId}/participants/${participantAddress}`);
  },

  // NOTE: getHolderCount is not a direct endpoint in Backend API Doc. Count is part of SessionDetailApiResponse.
  // getHolderCount: (voteSessionId) => {
  //   return apiClient.get(`/api/holders/count/${voteSessionId}`); // Old path
  // },

  // NOTE: joinAsHolder via API is not in Backend API Doc. Joining is via ParticipantRegistry contract.
  // joinAsHolder: (voteSessionId, data) => {
  //   return apiClient.post(`/api/holders/join/${voteSessionId}`, data); // Old path
  // },
};

export const shareApi = {
  submitShare: (voteSessionId, shareListData) => {
    // Matches Backend API: POST /api/shares/submit-share/{vote_session_id}
    // Expects ShareListSubmitRequest: { public_key, shares: [{vote_id, share}], signature }
    return apiClient.post(`/api/shares/submit-share/${voteSessionId}`, shareListData);
  },

  getShares: (voteSessionId) => {
    // Matches Backend API: GET /api/shares/get-shares/{vote_session_id}
    return apiClient.get(`/api/shares/get-shares/${voteSessionId}`);
  },

  // NOTE: decryptionStatus is not an endpoint in Backend API Doc.
  // decryptionStatus: (voteSessionId) => {
  //   return apiClient.get(`/api/shares/decryption-status/${voteSessionId}`);
  // },

  // NOTE: verifyShare for individual share is not a direct endpoint in Backend API Doc.
  // The POST /submit-share handles verification of a list.
  // verifyShare: (voteId, holderAddress, share) => {
  //   return apiClient.post('/api/shares/verify', { vote_id: voteId, holder_address: holderAddress, share });
  // },
};

// Admin API (Added based on Backend API Doc)
export const adminApi = {
  triggerCacheRefresh: () => {
    // Matches Backend API: POST /api/admin/cache/refresh
    // Requires admin auth (handled by interceptor if token is 'admin token')
    return apiClient.post('/api/admin/cache/refresh', {});
  }
};

export default {
  auth: authApi,
  voteSession: voteSessionApi,
  encryptedVote: encryptedVoteApi,
  participant: participantApi, // Renamed from holder
  share: shareApi,
  admin: adminApi, // Added
};
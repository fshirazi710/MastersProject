// Contract ABI type
// Represents a single item in the ABI array (function, event, error, etc.)
type ABIItem = {
    // Common properties
    type: string; // 'function', 'event', 'error', 'constructor'
    name?: string; // Optional for constructor/fallback
  
    // For functions, events, and errors
    inputs?: ABIParameter[]; // Optional for errors like ReentrancyGuardReentrantCall
  
    // For functions
    outputs?: ABIParameter[]; // Not present for events/errors
  
    // For functions
    stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'; // Optional as not present for events/errors
  
    // For events
    anonymous?: boolean; // Optional as only for events
  };
  
  // Represents a parameter within the inputs or outputs array
  type ABIParameter = {
        internalType: string;
    name: string;
    type: string;
    // For structs/tuples
    components?: ABIParameter[]; // Optional, for nested structures
    // For event parameters
    indexed?: boolean; // Optional, only relevant for event inputs
  };
  
  // The overall Contract ABI is an array of ABIItems
  type ContractABI = ABIItem[];
  

// API Configuration
const API_CONFIG = {
    development: {
        baseURL: 'http://127.0.0.1:8000',
    },
    production: {
        baseURL: process.env.NUXT_PUBLIC_API_URL || 'https://api.yourdomain.com', // This will be overridden in production
    }
} as const;

// Blockchain Network Configuration
const BLOCKCHAIN_CONFIG = {
    // Default provider URL (e.g., for Hardhat node)
    providerUrl: 'http://127.0.0.1:8545/', 
    
    // Deployed VoteSessionFactory Address (Update if redeployed)
    voteSessionFactoryAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', 
    
    // Optional: Add Chain ID if needed for network checks
    // chainId: 31337 // Hardhat default
} as const;

// Get current environment
const environment = (process.env.NODE_ENV || 'development') as keyof typeof API_CONFIG;

// Export the configuration for the current environment
export const config = {
    api: API_CONFIG[environment],
    blockchain: BLOCKCHAIN_CONFIG // Export new blockchain config
}; 
// Contract ABI type
type ContractABI = {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs?: {
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
}[];

// API Configuration
const API_CONFIG = {
    development: {
        baseURL: "http://localhost:8000",
    },
    production: {
        baseURL: "http://backend-red-mountain-4350.fly.dev", 
    }
} as const;

// Contract Configuration
const CONTRACT_CONFIG = {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Hardhat's default first deployment address
    abi: [
        {
            "inputs": [
                {
                    "internalType": "bytes",
                    "name": "ciphertext",
                    "type": "bytes"
                },
                {
                    "internalType": "bytes",
                    "name": "nonce",
                    "type": "bytes"
                },
                {
                    "internalType": "uint256",
                    "name": "decryptionTime",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256[2]",
                    "name": "g2r",
                    "type": "uint256[2]"
                },
                {
                    "internalType": "uint256",
                    "name": "threshold",
                    "type": "uint256"
                }
            ],
            "name": "submitVote",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "requiredDeposit",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ] as ContractABI
} as const;

// Get current environment
const environment = (process.env.NODE_ENV || 'development') as keyof typeof API_CONFIG;

// Export the configuration for the current environment
export const config = {
    api: API_CONFIG[environment],
    contract: CONTRACT_CONFIG
}; 
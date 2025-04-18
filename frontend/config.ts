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
        baseURL: 'http://127.0.0.1:8000',
    },
    production: {
        baseURL: process.env.NUXT_PUBLIC_API_URL || 'https://api.yourdomain.com', // This will be overridden in production
    }
} as const;

// Contract Configuration
const CONTRACT_CONFIG = {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Hardhat's default first deployment address
    abi: [
      {
        "inputs": [],
        "name": "ReentrancyGuardReentrantCall",
        "type": "error"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "voteIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "shareIndex",
            "type": "uint256"
          }
        ],
        "name": "DecryptionShareSubmitted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "DepositClaimed",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "address[]",
            "name": "holderAddresses",
            "type": "address[]"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "threshold",
            "type": "uint256"
          }
        ],
        "name": "EncryptedVoteSubmitted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "depositAmount",
            "type": "uint256"
          }
        ],
        "name": "HolderJoined",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "addr",
            "type": "address"
          }
        ],
        "name": "LogAddress",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "message",
            "type": "string"
          }
        ],
        "name": "LogMessage",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "label",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "LogUint",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "totalRewardAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "eligibleHolderCount",
            "type": "uint256"
          }
        ],
        "name": "RewardsDistributed",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "title",
            "type": "string"
          }
        ],
        "name": "VoteSessionCreated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "startDate",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "endDate",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string[]",
            "name": "options",
            "type": "string[]"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "rewardPool",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "requiredDeposit",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "name": "VoteSessionCreatedDetailed",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "MIN_HOLDERS",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "claimDeposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "startDate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endDate",
            "type": "uint256"
          },
          {
            "internalType": "string[]",
            "name": "options",
            "type": "string[]"
          },
          {
            "internalType": "uint256",
            "name": "requiredDeposit",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "_metadata",
            "type": "string"
          }
        ],
        "name": "createVoteSession",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "decryptionShares",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "voteIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "share",
            "type": "bytes"
          },
          {
            "internalType": "uint256",
            "name": "index",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "distributeRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "encryptedVotes",
        "outputs": [
          {
            "internalType": "bytes",
            "name": "ciphertext",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "g1r",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "g2r",
            "type": "bytes"
          },
          {
            "internalType": "address",
            "name": "voter",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "threshold",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "getDecryptionShares",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "voteIndex",
                "type": "uint256"
              },
              {
                "internalType": "address",
                "name": "holderAddress",
                "type": "address"
              },
              {
                "internalType": "bytes",
                "name": "share",
                "type": "bytes"
              },
              {
                "internalType": "uint256",
                "name": "index",
                "type": "uint256"
              }
            ],
            "internalType": "struct TimedReleaseVoting.DecryptionShare[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "getEncryptedVotes",
        "outputs": [
          {
            "components": [
              {
                "internalType": "address[]",
                "name": "holderAddresses",
                "type": "address[]"
              },
              {
                "internalType": "bytes",
                "name": "ciphertext",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "g1r",
                "type": "bytes"
              },
              {
                "internalType": "bytes",
                "name": "g2r",
                "type": "bytes"
              },
              {
                "internalType": "bytes[]",
                "name": "alpha",
                "type": "bytes[]"
              },
              {
                "internalType": "address",
                "name": "voter",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "threshold",
                "type": "uint256"
              }
            ],
            "internalType": "struct TimedReleaseVoting.EncryptedVote[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          }
        ],
        "name": "getHolderStatus",
        "outputs": [
          {
            "internalType": "bool",
            "name": "isActive",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "hasSubmitted",
            "type": "bool"
          },
          {
            "internalType": "uint256",
            "name": "deposit",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "getHoldersByVoteSession",
        "outputs": [
          {
            "internalType": "address[]",
            "name": "",
            "type": "address[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "getNumHoldersByVoteSession",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "getVoteSession",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
              },
              {
                "internalType": "string",
                "name": "title",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "description",
                "type": "string"
              },
              {
                "internalType": "uint256",
                "name": "startDate",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "endDate",
                "type": "uint256"
              },
              {
                "internalType": "string[]",
                "name": "options",
                "type": "string[]"
              },
              {
                "internalType": "uint256",
                "name": "rewardPool",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "requiredDeposit",
                "type": "uint256"
              },
              {
                "internalType": "string",
                "name": "metadata",
                "type": "string"
              }
            ],
            "internalType": "struct TimedReleaseVoting.VoteSession",
            "name": "",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "hasSubmittedSharesForVoteSession",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "hasVotedInSession",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "holderDeposits",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "isHolderActiveForVoteSession",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "holderAddress",
            "type": "address"
          }
        ],
        "name": "isHolderInVoteSession",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          }
        ],
        "name": "joinAsHolder",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "rewardsHaveBeenDistributed",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "internalType": "uint256[]",
            "name": "voteIndices",
            "type": "uint256[]"
          },
          {
            "internalType": "uint256[]",
            "name": "shareIndices",
            "type": "uint256[]"
          },
          {
            "internalType": "bytes[]",
            "name": "shareDataList",
            "type": "bytes[]"
          }
        ],
        "name": "submitDecryptionShares",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "voteSessionId",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "_holderAddresses",
            "type": "address[]"
          },
          {
            "internalType": "bytes",
            "name": "ciphertext",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "g1r",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "g2r",
            "type": "bytes"
          },
          {
            "internalType": "bytes[]",
            "name": "alpha",
            "type": "bytes[]"
          },
          {
            "internalType": "uint256",
            "name": "threshold",
            "type": "uint256"
          }
        ],
        "name": "submitEncryptedVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "totalDepositsHeld",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "totalRewardsHeld",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "voteSession",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "startDate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endDate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "rewardPool",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "requiredDeposit",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "metadata",
            "type": "string"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "voteSessionCount",
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
    ] as ContractABI // This type assertion is important
} as const;

// Get current environment
const environment = (process.env.NODE_ENV || 'development') as keyof typeof API_CONFIG;

// Export the configuration for the current environment
export const config = {
    api: API_CONFIG[environment],
    contract: CONTRACT_CONFIG
}; 
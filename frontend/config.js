export const config = {
  api: {
    baseURL: 'http://localhost:8000'
  },
  contract: {
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
    ]
  }
}; 
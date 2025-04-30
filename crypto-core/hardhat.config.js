// crypto-core/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20", // Keep the version
    settings: {
      optimizer: {
        enabled: true,
        runs: 200 // Standard setting, optimize for 200 contract calls
      },
      viaIR: true // Enable the Yul/IR pipeline
    }
  },
  paths: {
    sources: "./contracts", // Where your Solidity contracts are
    tests: "./test",       // Where your test files are
    cache: "./cache",     // Temporary cache files
    artifacts: "./artifacts" // Compiled contract artifacts
  },
  networks: {
    hardhat: {
      // Configuration for the default Hardhat Network (in-memory blockchain)
      // You can add specific settings here if needed, like chainId or forking
    },
    localhost: {
      url: "http://127.0.0.1:8545/", // Default URL for `npx hardhat node`
      // No accounts needed here; Hardhat node provides them
    },
    // You can add configurations for other networks like Sepolia, Goerli, mainnet, etc.
    // sepolia: {
    //   url: "YOUR_ALCHEMY_OR_INFURA_SEPOLIA_URL",
    //   accounts: ["YOUR_PRIVATE_KEY"]
    // }
  },
  mocha: {
    timeout: 40000 // Optional: Increase timeout for tests if needed
  }
}; 
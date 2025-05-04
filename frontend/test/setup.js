import { beforeAll, afterAll, vi } from 'vitest';
import { ethers } from 'ethers';
// Remove service imports from setup.js
// import { ethersBaseService } from '../services/ethersBase.js';
// import { factoryService } from '../services/contracts/factoryService.js';

// Remove internal logs
// console.log('[setup.js] __dirname:', __dirname);
// console.log('[setup.js] __filename:', __filename);

// --- Configuration --- 
const HARDHAT_RPC_URL = 'http://127.0.0.1:8545';
// Factory address is still needed, but will be used within tests
const DEPLOYED_FACTORY_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'; 
// ---------------------

let provider;
let deployerSigner; // The account that deployed the factory
let userSigner; // Another account for testing user actions

beforeAll(async () => {
  try {
    // Initialize ethers provider to connect to Hardhat node
    provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);

    // Get signers provided by Hardhat node
    deployerSigner = await provider.getSigner(0); 
    userSigner = await provider.getSigner(1); // Use account 1 as a test user

    // Remove console logs for setup
    // console.log(`Test Setup: Connected to Hardhat node at ${HARDHAT_RPC_URL}`);
    // console.log(`Test Setup: Deployer address: ${await deployerSigner.getAddress()}`);
    // console.log(`Test Setup: User address: ${await userSigner.getAddress()}`);

    // Configuration of ethersBaseService will happen in test files
    
    // Validate factory deployment
    if (!ethers.isAddress(DEPLOYED_FACTORY_ADDRESS)) {
        throw new Error("Invalid factory address configured in test/setup.js.");
    }
    const factoryCode = await provider.getCode(DEPLOYED_FACTORY_ADDRESS);
    if (factoryCode === '0x') {
        throw new Error("Factory contract not found at configured address.");
    }
    // console.log(`Test Setup: Factory contract code found. Setup complete.`); // Remove log

  } catch (error) {
    console.error("FATAL ERROR DURING TEST SETUP:", error);
    process.exit(1); 
  }
});

// Remove deploySessionFixture from setup
// async function deploySessionFixture(sessionParams) { ... }

// Export essentials
export { provider, deployerSigner, userSigner, DEPLOYED_FACTORY_ADDRESS };

afterAll(() => {
  // console.log("Test Teardown: Completed."); // Remove log
}); 
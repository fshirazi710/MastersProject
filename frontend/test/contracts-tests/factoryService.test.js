import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';

// Remove internal logs
// console.log('[factoryService.test.js] __dirname:', __dirname);
// console.log('[factoryService.test.js] __filename:', __filename);
// try { ... } catch (e) { ... }

// Import services and setup items here
import { factoryService } from '../../services/contracts/factoryService.js';
import { ethersBaseService } from '../../services/contracts/ethersBase.js';
import { provider, deployerSigner, DEPLOYED_FACTORY_ADDRESS } from '../setup.js';

describe('FactoryService', () => {
    
    beforeAll(async () => {
        ethersBaseService.provider = provider;
        ethersBaseService.signer = deployerSigner;
        ethersBaseService.factoryAddress = DEPLOYED_FACTORY_ADDRESS;
        ethersBaseService.isConnected = true; 
        ethersBaseService.account = await deployerSigner.getAddress();
        // Logs removed
    });

    it('should create a new vote session and return addresses', async () => {
        // Define params as an object
        const params = {
            title: "Factory Test Session",
            description: "Testing factoryService.createVoteSession", // Updated description slightly
            options: ["Yes", "No"],
            startDate: Math.floor(Date.now() / 1000) - 60,
            endDate: Math.floor(Date.now() / 1000) + 3600,
            sharesEndDate: Math.floor(Date.now() / 1000) + 7200,
            requiredDeposit: ethers.parseEther("0.01"), // Pass value to be parsed inside service
            minShareThreshold: 2,
            metadata: "test-metadata" // Add metadata if service expects it
        };

        // Removed the log
        // console.log('[FactoryService Test] factoryService object before call:', factoryService);

        // Call correct method with single params object
        const deployedInfo = await factoryService.createVoteSession(params);

        // Assertions based on the deployedInfo object returned by the service
        expect(deployedInfo).toBeDefined();
        expect(deployedInfo.sessionId).toBeGreaterThanOrEqual(0);
        expect(ethers.isAddress(deployedInfo.voteSessionContract)).toBe(true);
        expect(ethers.isAddress(deployedInfo.participantRegistryContract)).toBe(true);

        console.log(`FactoryService Test: Created session ID ${deployedInfo.sessionId}`);

        // Additionally, test getSessionAddresses using the returned ID
        const addresses = await factoryService.getSessionAddresses(deployedInfo.sessionId);
        expect(addresses).toBeDefined();
        expect(addresses.sessionAddress).toBe(deployedInfo.voteSessionContract);
        expect(addresses.registryAddress).toBe(deployedInfo.participantRegistryContract);
    }, 60000);

    it('should throw an error for a non-existent session ID', async () => {
        const nonExistentSessionId = 999999;
        await expect(factoryService.getSessionAddresses(nonExistentSessionId))
            .rejects
            .toThrow(/^Failed to get addresses/i);
    });

    // Add more tests: edge cases, invalid inputs (if validation is done off-chain), etc.
}); 
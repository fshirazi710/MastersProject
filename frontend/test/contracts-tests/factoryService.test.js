import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';

// Remove internal logs
// console.log('[factoryService.test.js] __dirname:', __dirname);
// console.log('[factoryService.test.js] __filename:', __filename);
// try { ... } catch (e) { ... }

// Import services and setup items here
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { provider, deployerSigner, userSigner, DEPLOYED_FACTORY_ADDRESS } from '../setup.js';

describe('FactoryService', () => {
    
    beforeAll(async () => {
        // The blockchainProviderService constructor has already run (on import)
        // and set up a default provider using config.ts, which points to the Hardhat node (http://127.0.0.1:8545/).
        // Now, we set the signer for the tests. The setSigner method in blockchainProviderService
        // will also correctly update the provider instance within the service to use the
        // provider associated with the Hardhat signer from our test/setup.js.
        await blockchainProviderService.setSigner(deployerSigner);
        // No need to call a non-existent .initialize() method.
    });

    it('should create a new vote session and return addresses', async () => {
        const latestBlock = await provider.getBlock('latest');
        const now = latestBlock.timestamp;
        const ONE_HOUR = 3600;
        const ONE_DAY = 24 * ONE_HOUR;

        const params = {
            title: "Factory Test Session",
            description: "Testing factoryService.createVoteSession",
            options: ["Yes", "No"],
            startDate: now + ONE_HOUR, 
            endDate: now + ONE_HOUR + ONE_DAY, 
            sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR,
            requiredDeposit: ethers.parseEther("0.01"),
            minShareThreshold: 2,
            metadata: "test-metadata-factory-service"
        };

        const deployedInfo = await factoryService.createVoteSession(params);

        expect(deployedInfo).toBeDefined();
        expect(deployedInfo.sessionId).toBeGreaterThanOrEqual(0);
        expect(ethers.isAddress(deployedInfo.voteSessionContract)).toBe(true);
        expect(ethers.isAddress(deployedInfo.participantRegistryContract)).toBe(true);

        console.log(`FactoryService Test: Created session ID ${deployedInfo.sessionId} with VoteSession at ${deployedInfo.voteSessionContract} and Registry at ${deployedInfo.participantRegistryContract}`);

        const addresses = await factoryService.getSessionAddresses(deployedInfo.sessionId);
        expect(addresses).toBeDefined();
        expect(addresses.sessionAddress).toBe(deployedInfo.voteSessionContract);
        expect(addresses.registryAddress).toBe(deployedInfo.participantRegistryContract);
    }, 60000); // Increased timeout for blockchain interaction

    it('should retrieve the deployed session count and increment after new deployment', async () => {
        const initialCount = await factoryService.getDeployedSessionCount();
        expect(initialCount).toBeGreaterThanOrEqual(0);

        // Deploy a new session to check count increment
        const latestBlock = await provider.getBlock('latest');
        const now = latestBlock.timestamp;
        const tempParams = {
            title: "Count Test Session",
            description: "Session for count test",
            options: ["A", "B"],
            startDate: now + 100,
            endDate: now + 200,
            sharesEndDate: now + 300,
            requiredDeposit: ethers.parseEther("0.001"),
            minShareThreshold: 2,
            metadata: "count-test"
        };
        await factoryService.createVoteSession(tempParams);

        const newCount = await factoryService.getDeployedSessionCount();
        expect(BigInt(newCount)).toBe(BigInt(initialCount) + BigInt(1)); // Ensure newCount is also BigInt for comparison
        console.log(`FactoryService Test: Deployed session count changed from ${initialCount} to ${newCount}`);
    }, 60000); // Increased timeout

    it('should retrieve vote session address by index for a newly deployed session', async () => {
        const latestBlock = await provider.getBlock('latest');
        const now = latestBlock.timestamp;
        const tempParams = {
            title: "Index Test Session",
            description: "Session for index test",
            options: ["X", "Y"],
            startDate: now + 100,
            endDate: now + 200,
            sharesEndDate: now + 300,
            requiredDeposit: ethers.parseEther("0.001"),
            minShareThreshold: 2,
            metadata: "index-test"
        };
        
        // Set signer to deployer for this action if not already
        await blockchainProviderService.setSigner(deployerSigner);
        const deployedInfo = await factoryService.createVoteSession(tempParams);
        
        const count = await factoryService.getDeployedSessionCount();
        const newSessionIndex = BigInt(count) - BigInt(1); // Assuming new session is last

        if (newSessionIndex >= 0) {
            const address = await factoryService.getVoteSessionAddressByIndex(newSessionIndex);
            expect(ethers.isAddress(address)).toBe(true);
            expect(address).toBe(deployedInfo.voteSessionContract); // Check against the deployed address
            console.log(`FactoryService Test: Vote session address at index ${newSessionIndex}: ${address}`);
        } else {
            // This case should not be hit if deployment was successful
            throw new Error("Session deployment for index test failed or count is incorrect.");
        }
    }, 60000); // Increased timeout

    it('should get the factory owner', async () => {
        const owner = await factoryService.getFactoryOwner();
        expect(ethers.isAddress(owner)).toBe(true);
        const deployerAddress = await deployerSigner.getAddress();
        expect(owner).toBe(deployerAddress); // Assuming deployerSigner is the factory owner
        console.log(`FactoryService Test: Factory owner: ${owner}`);
    });

    it('should throw an error when trying to get addresses for a non-existent session ID', async () => {
        const nonExistentSessionId = 999999; // An ID unlikely to exist
        await expect(factoryService.getSessionAddresses(nonExistentSessionId))
            .rejects
            .toThrow(/FactoryService: Failed to get addresses.*Session ID not found/i);
    });

    it('should allow owner to transfer factory ownership and transfer back', async () => {
       const newOwnerSigner = userSigner; // Use userSigner as the new owner
       const newOwnerAddress = await newOwnerSigner.getAddress();
       const originalOwnerAddress = await deployerSigner.getAddress();

       // 1. Check initial owner
       await blockchainProviderService.setSigner(deployerSigner); // Ensure context is original owner
       const initialOwner = await factoryService.getFactoryOwner();
       expect(initialOwner).toBe(originalOwnerAddress);

       // 2. Transfer ownership to newOwnerAddress
       console.log(`Transferring factory ownership from ${initialOwner} to ${newOwnerAddress}`);
       await factoryService.transferFactoryOwnership(newOwnerAddress);

       // 3. Verify new owner
       // The owner in the contract should be updated. factoryService.getFactoryOwner() reads this.
       const updatedOwner = await factoryService.getFactoryOwner(); 
       expect(updatedOwner).toBe(newOwnerAddress);
       console.log(`Factory ownership successfully transferred to ${updatedOwner}`);

       // 4. Transfer ownership back to originalOwnerAddress (signed by newOwnerSigner)
       await blockchainProviderService.setSigner(newOwnerSigner); // New owner must sign the transfer back
       console.log(`Transferring factory ownership back from ${newOwnerAddress} to ${originalOwnerAddress}`);
       await factoryService.transferFactoryOwnership(originalOwnerAddress);

       // 5. Verify owner is back to original
       // factoryService.getFactoryOwner() should now reflect the original owner
       const finalOwner = await factoryService.getFactoryOwner();
       expect(finalOwner).toBe(originalOwnerAddress);
       console.log(`Factory ownership successfully transferred back to ${finalOwner}`);
       
       // Reset signer to deployer for subsequent tests if any
       await blockchainProviderService.setSigner(deployerSigner);
    }, 60000);

}); 
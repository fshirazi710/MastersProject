import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { registryService } from '../../services/contracts/registryService.js';
import { ethersBaseService } from '../../services/contracts/ethersBase.js';
// Import setup essentials and factory service for deployment
import { provider, userSigner, deployerSigner, DEPLOYED_FACTORY_ADDRESS } from '../setup.js';
// Use NAMED import for factoryService
import { factoryService } from '../../services/contracts/factoryService.js';
import { generateBLSKeyPair } from '../../services/utils/cryptographyUtils.js';

// Helper function to deploy a session for a test
async function deployRegistryTestSession(params = {}) {
    const defaultParams = {
        title: "Registry Test Session",
        description: "Session for testing registry",
        options: ["Reg A", "Reg B"],
        endDate: Math.floor(Date.now() / 1000) + 3600,
        sharesEndDate: Math.floor(Date.now() / 1000) + 7200,
        requiredDeposit: ethers.parseEther("0.02"),
        minShareThreshold: 2, 
        startDate: Math.floor(Date.now() / 1000) + 60,
        metadata: "registry-test-meta"
    };
    const sessionParams = { ...defaultParams, ...params };

    // Ensure base service is configured with deployer for deployment
    ethersBaseService.provider = provider;
    ethersBaseService.signer = deployerSigner;
    ethersBaseService.factoryAddress = DEPLOYED_FACTORY_ADDRESS;
    ethersBaseService.isConnected = true;
    ethersBaseService.account = await deployerSigner.getAddress();

    // Pass deployerSigner explicitly to factoryService
    const deployedInfo = await factoryService.createVoteSession(sessionParams, deployerSigner);
    return { 
        sessionId: deployedInfo.sessionId, 
        registryAddress: deployedInfo.participantRegistryContract,
        sessionAddress: deployedInfo.voteSessionContract,
        initialDepositRequired: sessionParams.requiredDeposit 
    };
}

describe('RegistryService', () => {

    // beforeEach/afterEach for general setup/teardown if needed, but not for session deployment
    beforeEach(() => {
        // Configure base service for deployer initially if needed, though deploy helper does it
        ethersBaseService.provider = provider;
        ethersBaseService.signer = deployerSigner; 
        ethersBaseService.factoryAddress = DEPLOYED_FACTORY_ADDRESS;
        ethersBaseService.isConnected = true;
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Ensure mocks are always restored
        // Reset signer to deployer just in case a test forgot
        ethersBaseService.setSigner(deployerSigner); 
    });

    it('should allow a user to register with the correct deposit', async () => {
        const { sessionId, registryAddress, initialDepositRequired } = await deployRegistryTestSession();
        
        // Generate key pair and get hex string
        const { pk } = generateBLSKeyPair();
        const blsKeyHex = pk.toHex(); 
        
        ethersBaseService.setSigner(userSigner);
        const userAddress = await userSigner.getAddress();

        // Call the registration function with the hex string
        const txReceipt = await registryService.registerParticipant(sessionId, blsKeyHex);

        // Assertions...
        const registeredEvent = txReceipt.logs.find(log => log.eventName === 'HolderRegistered');
        expect(registeredEvent).toBeDefined();
        expect(registeredEvent.args.holder).toBe(userAddress);
        expect(registeredEvent.args.depositAmount).toBe(initialDepositRequired);
        // Compare the hex string from the event
        expect(registeredEvent.args.blsPublicKeyHex).toBe(blsKeyHex); 
        // ... other assertions ...
    }, 60000);

    it('should prevent registering twice', async () => {
        const { sessionId } = await deployRegistryTestSession();
        const { pk } = generateBLSKeyPair();
        const blsKeyHex = pk.toHex();
        ethersBaseService.setSigner(userSigner);
        
        await registryService.registerParticipant(sessionId, blsKeyHex); // First registration
        
        // Second registration with same key should fail
        await expect(registryService.registerParticipant(sessionId, blsKeyHex))
            .rejects
            .toThrow(/Already registered/i);
    }, 60000);

    it('should prevent registering with insufficient deposit', async () => {
        const { sessionId, initialDepositRequired } = await deployRegistryTestSession();
        const { pk } = generateBLSKeyPair();
        const blsKeyHex = pk.toHex();
        ethersBaseService.setSigner(userSigner);

        const originalSendTx = ethersBaseService.sendTransaction;
        ethersBaseService.sendTransaction = vi.fn(async (contractAddress, abi, functionName, args, overrides) => {
            const insufficientValue = initialDepositRequired / 2n; 
            const newOverrides = { ...overrides, value: insufficientValue };
            return originalSendTx.call(ethersBaseService, contractAddress, abi, functionName, args, newOverrides);
        });

        // Expect the correct revert reason from ParticipantRegistry contract
        await expect(registryService.registerParticipant(sessionId, blsKeyHex))
            .rejects
            .toThrow(/Incorrect deposit amount/i); // Match the contract string

    }, 60000);

    it('should retrieve correct participant details', async () => {
        const { sessionId, initialDepositRequired } = await deployRegistryTestSession(); // Get deposit from helper
        const { pk } = generateBLSKeyPair();
        const blsKeyHex = pk.toHex();
        ethersBaseService.setSigner(userSigner);
        const userAddress = await userSigner.getAddress();

        await registryService.registerParticipant(sessionId, blsKeyHex);
        const details = await registryService.getParticipantDetails(sessionId, userAddress);
        expect(details).not.toBeNull();
        expect(details.isRegistered).toBe(true);
        // Check X and Y separately now
        expect(details.blsPubKeyX).toBe(pk.x.toString());
        expect(details.blsPubKeyY).toBe(pk.y.toString());
        expect(details.depositAmount).toContain(ethers.formatEther(initialDepositRequired)); // Use initialDepositRequired
        expect(details.hasVoted).toBe(false);
        expect(details.hasSubmittedShares).toBe(false);
        expect(details.hasSubmittedDecryptionValue).toBe(false);
        expect(details.hasClaimed).toBe(false);

        const nonRegisteredAddress = ethers.Wallet.createRandom().address;
        const nonRegisteredDetails = await registryService.getParticipantDetails(sessionId, nonRegisteredAddress);
        expect(nonRegisteredDetails).toBeNull();
    }, 60000);

    it('should get the correct number of active participants', async () => {
        const { sessionId } = await deployRegistryTestSession();
        const { pk: pk1 } = generateBLSKeyPair();
        const blsKeyHex1 = pk1.toHex();
        const { pk: pk2 } = generateBLSKeyPair();
        const blsKeyHex2 = pk2.toHex();
        
        ethersBaseService.setSigner(userSigner);
        await registryService.registerParticipant(sessionId, blsKeyHex1);
        let count = await registryService.getNumberOfActiveParticipants(sessionId);
        expect(count).toBe(1);

        ethersBaseService.setSigner(deployerSigner); 
        await registryService.registerParticipant(sessionId, blsKeyHex2);
        count = await registryService.getNumberOfActiveParticipants(sessionId);
        expect(count).toBe(2);
    }, 60000);
    
    it('should retrieve all participant BLS keys', async () => {
        const { sessionId } = await deployRegistryTestSession();
        const { pk: pk1 } = generateBLSKeyPair();
        const blsKeyHex1 = pk1.toHex();
        const { pk: pk2 } = generateBLSKeyPair();
        const blsKeyHex2 = pk2.toHex();

        ethersBaseService.setSigner(userSigner);
        await registryService.registerParticipant(sessionId, blsKeyHex1);
        
        ethersBaseService.setSigner(deployerSigner);
        await registryService.registerParticipant(sessionId, blsKeyHex2);

        const keys = await registryService.getAllParticipantKeys(sessionId);
        expect(keys).toBeInstanceOf(Array);
        expect(keys.length).toBe(2);
        // Check if the returned keys match the ones registered
        expect(keys).toContain(blsKeyHex1);
        expect(keys).toContain(blsKeyHex2);
        expect(keys[0]).toMatch(/^0x/);
        expect(keys[1]).toMatch(/^0x/);
    }, 60000);

    // TODO: Add tests for claimDepositOrReward (will require advancing time in Hardhat)
    // TODO: Add tests for hasClaimed, hasSubmittedDecryptionValue (will require other actions first)
}); 
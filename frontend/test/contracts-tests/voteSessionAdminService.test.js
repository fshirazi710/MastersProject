import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionAdminService } from '../../services/contracts/voteSessionAdminService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
// import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js'; // For status checks

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

async function deploySessionForVoteAdminTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const defaultSessionParams = {
        title: "Vote Admin Test Session",
        description: "Session for testing VoteSessionAdminService",
        options: ["VAdmin A", "VAdmin B"],
        startDate: Math.floor(Date.now() / 1000) - 3600, 
        endDate: Math.floor(Date.now() / 1000) + 3600, 
        sharesEndDate: Math.floor(Date.now() / 1000) + 7200, 
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 1,
        metadata: "vote-session-admin-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for vote admin test - ID: ${deployedInfo.sessionId}, SessionAddr: ${deployedInfo.voteSessionContract}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract, // Crucial for this service
        sessionParams
    };
}

describe('VoteSessionAdminService', () => {
    let testVoteAdminContext; 

    beforeEach(async () => {
        blockchainProviderService.initialize(provider);
        blockchainProviderService.setSigner(deployerSigner); 
        testVoteAdminContext = await deploySessionForVoteAdminTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('transferSessionOwnership', () => {
        it('should allow the current owner to transfer session ownership', async () => {
            const { voteSessionAddress } = testVoteAdminContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();
            const originalOwnerAddress = await deployerSigner.getAddress(); // Deployer is initial owner

            blockchainProviderService.setSigner(deployerSigner); 
            const txReceipt = await voteSessionAdminService.transferSessionOwnership(voteSessionAddress, newOwnerAddress);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify OwnershipTransferred event from VoteSession contract
            const eventInterface = new ethers.Interface((await factoryService.getContractABI('VoteSession')).abi);
            const ownershipTransferredEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'OwnershipTransferred');
            
            expect(ownershipTransferredEvent).toBeDefined();
            expect(ownershipTransferredEvent.args.previousOwner).toBe(originalOwnerAddress);
            expect(ownershipTransferredEvent.args.newOwner).toBe(newOwnerAddress);

            // To verify, we'd ideally call a getOwner method from voteSessionViewService
            // For now, assume transfer worked if event is correct. 
            // A getSessionOwner() method would be on voteSessionViewService.
            // const currentOwner = await voteSessionViewService.getSessionOwner(voteSessionAddress);
            // expect(currentOwner).toBe(newOwnerAddress);

            // Transfer back
            blockchainProviderService.setSigner(anotherUserSigner);
            await voteSessionAdminService.transferSessionOwnership(voteSessionAddress, originalOwnerAddress);
        }, 60000);

        it('should prevent a non-owner from transferring session ownership', async () => {
            const { voteSessionAddress } = testVoteAdminContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();

            blockchainProviderService.setSigner(userSigner); // Non-owner
            await expect(voteSessionAdminService.transferSessionOwnership(voteSessionAddress, newOwnerAddress))
                .rejects
                .toThrow(/Ownable: caller is not the owner/i);
        }, 60000);
    });

    describe('setDecryptionParameters', () => {
        it('placeholder for setDecryptionParameters', () => {
            // Requires setting up alphas (BLS public key shares) and threshold.
            // This is a critical step typically done by an admin after holders are known.
            // Test would involve: 
            // 1. Registering holders (using registryParticipantService).
            // 2. Generating mock alpha shares based on their public keys.
            // 3. Calling setDecryptionParameters.
            // 4. Verifying an event (e.g., DecryptionParametersSet) and potentially stored parameters via a view function.
            expect(true).toBe(true);
        });
    });

    describe('updateSessionStatus', () => {
        it('placeholder for updateSessionStatus', async () => {
            // This function typically transitions the session through states (Pending, Active, SharesCollection, Completed).
            // Testing requires: 
            // 1. Advancing time (evm_increaseTime) to cross startDate, endDate, sharesEndDate boundaries.
            // 2. Calling updateSessionStatus after each time advancement.
            // 3. Verifying the new status using a getter from voteSessionViewService (e.g., getStatus or getSessionInfo).
            // const { voteSessionAddress, sessionParams } = testVoteAdminContext;
            // await provider.send('evm_increaseTime', [sessionParams.endDate - sessionParams.startDate + 100]);
            // await provider.send('evm_mine', []);
            // await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            // const status = await voteSessionViewService.getStatus(voteSessionAddress)
            // expect(status).toBe(CORRECT_STATE_AFTER_ENDDATE);
            expect(true).toBe(true);
        });
    });

    describe('triggerRewardCalculation (VoteSession context)', () => {
        it('placeholder for triggerRewardCalculation on VoteSession', () => {
            // This function in VoteSession.sol might be different from ParticipantRegistry.calculateRewards.
            // It could, for example, finalize vote aggregation or prepare data for the registry.
            // Test would involve:
            // 1. Setting up a session with votes cast, shares submitted (using voteSessionVotingService).
            // 2. Advancing time past sharesEndDate.
            // 3. Calling triggerRewardCalculation.
            // 4. Verifying relevant events or state changes specific to VoteSession.
            expect(true).toBe(true);
        });
    });
}); 
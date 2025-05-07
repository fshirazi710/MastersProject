import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { registryAdminService } from '../../services/contracts/registryAdminService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js';
import { registryFundService } from '../../services/contracts/registryFundService.js';
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js'; // For checking periods
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js'; // For submitting shares

// Utilities
import { generateBLSKeyPair } from '../../services/utils/blsCryptoUtils.js';

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

// Import ABI directly
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';
const ParticipantRegistryABI = ParticipantRegistryABI_File.abi;

async function deploySessionForAdminTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const latestBlock = await provider.getBlock('latest');
    const now = latestBlock.timestamp;
    const ONE_HOUR = 3600;
    const ONE_DAY = 24 * ONE_HOUR;

    const defaultSessionParams = {
        title: "Registry Admin Test Session",
        description: "Session for testing RegistryAdminService",
        options: ["AdminOpt A", "AdminOpt B"],
        startDate: now + ONE_HOUR, 
        endDate: now + ONE_HOUR + ONE_DAY, 
        sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR, 
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 1,
        metadata: "registry-admin-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for admin test - ID: ${deployedInfo.sessionId}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        initialDepositRequired: sessionParams.requiredDeposit,
        sessionParams // also return sessionParams for date checks
    };
}

describe('RegistryAdminService', () => {
    let testAdminContext; // To hold deployed session info

    beforeEach(async () => {
        // blockchainProviderService.initialize(provider); // Removed
        blockchainProviderService.setSigner(deployerSigner); // Default to deployer (owner)
        testAdminContext = await deploySessionForAdminTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getRegistryOwner', () => {
        it('should return the correct owner of the registry', async () => {
            const { sessionId } = testAdminContext;
            blockchainProviderService.setSigner(deployerSigner); // Not strictly necessary if beforeEach default is deployer
            const owner = await registryAdminService.getRegistryOwner(sessionId);
            const expectedOwner = await deployerSigner.getAddress(); // Factory deployer is initial owner of registry
            expect(owner).toBe(expectedOwner);
        });
    });

    describe('transferRegistryOwnership', () => {
        it('should allow the current owner to transfer ownership', async () => {
            const { sessionId } = testAdminContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();
            const originalOwnerAddress = await deployerSigner.getAddress();

            blockchainProviderService.setSigner(deployerSigner); // Current owner initiates
            const txReceipt = await registryAdminService.transferRegistryOwnership(sessionId, newOwnerAddress);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify OwnershipTransferred event
            const eventInterface = new ethers.Interface(ParticipantRegistryABI); // Use direct ABI
            const ownershipTransferredEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'OwnershipTransferred');

            expect(ownershipTransferredEvent).toBeDefined();
            expect(ownershipTransferredEvent.args.previousOwner).toBe(originalOwnerAddress);
            expect(ownershipTransferredEvent.args.newOwner).toBe(newOwnerAddress);

            // Check new owner with getRegistryOwner
            // Note: service calls contract view function, should reflect new owner immediately
            const currentOwnerAfterTransfer = await registryAdminService.getRegistryOwner(sessionId);
            expect(currentOwnerAfterTransfer).toBe(newOwnerAddress);

            // Transfer back to original owner to not affect other tests (new owner initiates)
            blockchainProviderService.setSigner(anotherUserSigner);
            await registryAdminService.transferRegistryOwnership(sessionId, originalOwnerAddress);
            const finalOwner = await registryAdminService.getRegistryOwner(sessionId);
            expect(finalOwner).toBe(originalOwnerAddress);
        }, 60000);

        it('should prevent a non-owner from transferring ownership', async () => {
            const { sessionId } = testAdminContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();

            blockchainProviderService.setSigner(userSigner); // Non-owner attempts
            await expect(registryAdminService.transferRegistryOwnership(sessionId, newOwnerAddress))
                .rejects
                .toThrow(/Ownable: caller is not the owner/i);
        }, 60000);
    });

    describe('setVoteSessionContract', () => {
        it('should allow admin to set a new VoteSession contract address for the registry', async () => {
            const { sessionId, registryAddress, voteSessionAddress: originalVoteSessionAddress } = testAdminContext;
            
            // 1. Deploy a new, different VoteSession contract to link to.
            // We can use factoryService to easily deploy another session pair and just grab its voteSessionContract address.
            const latestBlock = await provider.getBlock('latest');
            const now = latestBlock.timestamp;
            const ONE_HOUR = 3600;
            const newSessionParams = {
                title: "New Decoy VoteSession for Linking Test",
                description: "Decoy session",
                options: ["X"],
                startDate: now + ONE_HOUR, 
                endDate: now + (2 * ONE_HOUR),
                sharesEndDate: now + (3 * ONE_HOUR),
                requiredDeposit: ethers.parseEther("0.001"),
                minShareThreshold: 1,
                metadata: "decoy-session-for-setVoteSessionContract"
            };
            const decoyDeployedInfo = await factoryService.createVoteSession(newSessionParams);
            const newVoteSessionAddress = decoyDeployedInfo.voteSessionContract;

            expect(newVoteSessionAddress).not.toBe(originalVoteSessionAddress);

            // 2. Admin calls setVoteSessionContract
            blockchainProviderService.setSigner(deployerSigner);
            const txReceipt = await registryAdminService.setVoteSessionContract(sessionId, newVoteSessionAddress);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // 3. Verify VoteSessionContractUpdated event from ParticipantRegistry
            const eventInterface = new ethers.Interface(ParticipantRegistryABI);
            const eventUpdated = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'VoteSessionContractUpdated');

            expect(eventUpdated).toBeDefined();
            expect(eventUpdated.args.sessionId).toBe(BigInt(sessionId));
            expect(eventUpdated.args.oldVoteSession).toBe(originalVoteSessionAddress);
            expect(eventUpdated.args.newVoteSession).toBe(newVoteSessionAddress);

            // TODO: Ideally, verify by reading the voteSessionContract variable from the registry contract.
            // This might require a new view function in registryAdminService or registryViewService if not present.
            // For now, the event emission is a good indicator.

        }, 60000);

        it('should prevent non-admin from calling setVoteSessionContract', async () => {
            const { sessionId } = testAdminContext;
            const decoyVoteSessionAddress = ethers.Wallet.createRandom().address; // Just need a valid address

            blockchainProviderService.setSigner(userSigner); // Non-admin
            await expect(registryAdminService.setVoteSessionContract(sessionId, decoyVoteSessionAddress))
                .rejects
                .toThrow(/Ownable: caller is not the owner/i); // Or specific admin role error
        });
    });

    describe('calculateRewards', () => {
        it('should allow admin to trigger reward calculation and correctly allocate rewards to eligible participant', async () => {
            const { sessionId, voteSessionAddress, sessionParams } = testAdminContext;
            const rewardAmount = ethers.parseEther("5");
            const participantSigner = userSigner; // Participant for this test
            const participantAddress = await participantSigner.getAddress();

            // 1. Fund rewards (as admin)
            blockchainProviderService.setSigner(deployerSigner);
            await registryFundService.addRewardFunding(sessionId, rewardAmount);

            // 2. Register participant as a holder
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(participantSigner);
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            // 3. Simulate Share Submission by the participant
            // Advance time to Shares Collection Period (after endDate defined in sessionParams)
            let timeToAdvanceToSharesPeriod = sessionParams.endDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60; // 60s buffer
            if (timeToAdvanceToSharesPeriod > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToSharesPeriod]);
                await provider.send('evm_mine', []);
            }
            const mockVoteIndex = 0;
            const mockShareData = ethers.toUtf8Bytes("mock_share_data_for_calc_rewards_test");
            const mockShareIndex = 0; // Assuming this participant is index 0 for this share
            // Ensure participantSigner is set for submitting shares
            blockchainProviderService.setSigner(participantSigner);
            try {
                await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, mockVoteIndex, mockShareData, mockShareIndex);
                const pInfo = await registryParticipantService.getParticipantInfo(sessionId, participantAddress);
                if (!pInfo || !pInfo.hasSubmittedShares) throw new Error("Share submission failed to set hasSubmittedShares flag.");
            } catch (e) {
                console.error("Share submission step failed in calculateRewards test setup:", e);
                throw e; // Fail fast if share submission is broken
            }

            // 4. Advance time to after sharesEndDate for reward calculation period
            let timeToAdvanceToRewardCalc = sessionParams.sharesEndDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60; // 60s buffer
            if (timeToAdvanceToRewardCalc > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToRewardCalc]);
                await provider.send('evm_mine', []);
            }

            // 5. Verify reward calculation period is active
            const isCalcActive = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
            if (!isCalcActive) {
                // Attempt to update session status if the contract requires manual trigger
                // This depends on VoteSession.sol logic. For now, assume it might need it or throw if not active.
                // console.log("Reward calculation period not active, attempting to update VoteSession status...");
                // await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // Requires voteSessionAdminService
                // const isCalcActiveAfterUpdate = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
                // if (!isCalcActiveAfterUpdate) throw new Error("Reward calculation period is not active even after attempting status update.");
                throw new Error("Reward calculation period is not active. Test setup or contract logic issue.");
            }
            
            // 6. Admin triggers calculateRewards
            blockchainProviderService.setSigner(deployerSigner);
            const txReceipt = await registryAdminService.calculateRewards(sessionId);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify RewardsCalculated event
            const eventInterface = new ethers.Interface(ParticipantRegistryABI);
            const rewardsCalculatedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'RewardsCalculated');
            expect(rewardsCalculatedEvent).toBeDefined();
            expect(rewardsCalculatedEvent.args.sessionId).toBe(BigInt(sessionId));
            // expect(rewardsCalculatedEvent.args.totalRewardsDistributed).toBeGreaterThan(0); // This can be checked too

            // 7. Check rewardsOwed for the eligible participant
            const rewardsOwed = await registryFundService.getRewardsOwed(sessionId, participantAddress);
            expect(BigInt(rewardsOwed)).toBeGreaterThan(0n); 
            console.log(`Rewards owed to participant ${participantAddress} after calculation: ${ethers.formatEther(rewardsOwed)} ETH`);

        }, 90000); 

        it('should throw error if reward calculation period is not active', async () => {
            const { sessionId, voteSessionAddress, sessionParams } = testAdminContext;
            // Ensure we are NOT in the reward calculation period.
            // e.g., advance time only to before sharesEndDate, or check current state is not ready.
            // For this test, we will assume the default state after session deployment is NOT reward calculation period.
            // Or, advance time just past endDate but before sharesEndDate.
            let timeToAdvance = sessionParams.endDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60;
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            
            const isActive = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
            expect(isActive).toBe(false); // Assert period is NOT active

            blockchainProviderService.setSigner(deployerSigner);
            // This relies on registryAdminService.calculateRewards having an internal check.
            // If it doesn't, the contract ParticipantRegistry.calculateRewards would revert, 
            // and the error message might be different (e.g., directly from VoteSession.isRewardCalculationPeriodActive check).
            await expect(registryAdminService.calculateRewards(sessionId))
                .rejects
                .toThrow(/Reward calculation period not active/i); // Assuming service throws this specific error.
        }, 70000);

        it('should prevent non-admin from triggering reward calculation', async () => {
            const { sessionId } = testAdminContext;
            blockchainProviderService.setSigner(userSigner); // Non-admin
            await expect(registryAdminService.calculateRewards(sessionId))
                .rejects
                .toThrow(/Ownable: caller is not the owner/i); // Or specific admin role error
        }, 60000);
    });
}); 
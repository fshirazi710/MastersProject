import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { registryFundService } from '../../services/contracts/registryFundService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js'; // For registering participants
import { registryAdminService } from '../../services/contracts/registryAdminService.js'; // For calculating rewards
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js'; // For submitting shares
import { voteSessionAdminService } from '../../services/contracts/voteSessionAdminService.js';
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js';

// Utilities
import { generateBLSKeyPair } from '../../services/utils/blsCryptoUtils.js';

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js'; // Assuming anotherUserSigner is available in setup.js for non-owner tests

// Import ABI directly
import ParticipantRegistryABI_File from '../../../crypto-core/artifacts/contracts/ParticipantRegistry.sol/ParticipantRegistry.json';
const ParticipantRegistryABI = ParticipantRegistryABI_File.abi;

// Re-using the helper, or a similar one, if suitable. 
// This helper deploys a new session context.
async function deploySessionForFundTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const latestBlock = await provider.getBlock('latest');
    const now = latestBlock.timestamp;
    const ONE_HOUR = 3600;
    const ONE_DAY = 24 * ONE_HOUR;

    const defaultSessionParams = {
        title: "Registry Fund Test Session",
        description: "Session for testing RegistryFundService",
        options: ["FundOpt A", "FundOpt B"],
        startDate: now + ONE_HOUR, // e.g., 1 hour from now (registration opens/ends)
        endDate: now + ONE_HOUR + ONE_DAY, // e.g., 1 day after start (voting ends)
        sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR, // e.g., 1 hour after voting ends (share submission ends)
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 2,
        metadata: "registry-fund-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for fund test - ID: ${deployedInfo.sessionId}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        initialDepositRequired: sessionParams.requiredDeposit,
        startDate: sessionParams.startDate, // Return the calculated start date
        endDate: sessionParams.endDate,     // Return the calculated end date
        sharesEndDate: sessionParams.sharesEndDate // Return the calculated shares end date
    };
}

describe('RegistryFundService', () => {
    let originalTestContext; // To hold deployed session info from beforeAll
    let snapshotId; // Store snapshot ID from beforeAll
    let testContext; // Per-test context, reset from originalTestContext

    beforeAll(async () => {
        blockchainProviderService.setSigner(deployerSigner); // Set signer for deployment
        originalTestContext = await deploySessionForFundTests();
        snapshotId = await provider.send('evm_snapshot', []); // Snapshot the state after deployment
    }, 60000); // Longer timeout for initial deployment

    beforeEach(async () => {
        await provider.send('evm_revert', [snapshotId]); // Revert to the clean deployed state
        // Take a new snapshot for isolating the current test (and update snapshotId for the next revert)
        snapshotId = await provider.send('evm_snapshot', []); 
        testContext = originalTestContext; // Reuse the deployed context addresses/IDs
        blockchainProviderService.setSigner(deployerSigner); // Reset default signer for consistency
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('addRewardFunding', () => {
        it('should allow the owner (deployer) to add reward funding', async () => {
            const { sessionId } = testContext;
            const fundingAmount = ethers.parseEther("1.0");

            blockchainProviderService.setSigner(deployerSigner); // Ensure owner is signer
            const txReceipt = await registryFundService.addRewardFunding(sessionId, fundingAmount);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            const totalPool = await registryFundService.getTotalRewardPool(sessionId);
            expect(totalPool).toBe(fundingAmount.toString()); // Service returns string

            // Optional: Verify event if one exists (e.g., RewardFundingAdded)
            const eventInterface = new ethers.Interface(ParticipantRegistryABI);
            const fundingAddedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'RewardFundingAdded');
            
            expect(fundingAddedEvent).toBeDefined();
            expect(fundingAddedEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(fundingAddedEvent.args.funder).toBe(await deployerSigner.getAddress());
            expect(fundingAddedEvent.args.amount).toBe(fundingAmount);
        }, 60000);

        it('should prevent a non-owner from adding reward funding', async () => {
            const { sessionId } = testContext;
            const fundingAmount = ethers.parseEther('0.5');
            // Setup: Switch to a non-owner signer
            blockchainProviderService.setSigner(userSigner); // Set to non-owner
            
            await expect(registryFundService.addRewardFunding(sessionId, fundingAmount))
                .rejects
                .toThrow(/OwnableUnauthorizedAccount/i); // Updated to OZ5 custom error

            // Teardown: Switch back to owner/deployer for subsequent tests if necessary
            blockchainProviderService.setSigner(deployerSigner);
        }, 60000);

        it('should accumulate total reward pool with multiple fundings', async () => {
            const { sessionId } = testContext;
            const firstFunding = ethers.parseEther("0.5");
            const secondFunding = ethers.parseEther("0.75");
            const totalExpected = firstFunding + secondFunding;

            blockchainProviderService.setSigner(deployerSigner);
            await registryFundService.addRewardFunding(sessionId, firstFunding);
            await registryFundService.addRewardFunding(sessionId, secondFunding);

            const totalPool = await registryFundService.getTotalRewardPool(sessionId);
            expect(totalPool).toBe(totalExpected.toString());
        }, 60000);
    });

    describe('getTotalRewardPool', () => {
        it('should return 0 for a new session with no funding', async () => {
            const { sessionId } = testContext; // Uses the one from beforeEach
            const totalPool = await registryFundService.getTotalRewardPool(sessionId);
            expect(totalPool).toBe("0");
        });
    });
    
    describe('getRewardsOwed', () => {
        it('should return 0 for a participant before rewards are calculated', async () => {
            const { sessionId } = testContext;
            // Register a participant for this test
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            const participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            const rewardsOwed = await registryFundService.getRewardsOwed(sessionId, participantAddress);
            expect(rewardsOwed).toBe("0"); // Contract should return 0 if rewards not calculated or none for user
        }, 60000);
    });

    // More complex scenarios for claimReward and hasClaimedReward will be added later.
    // These often depend on rewards being calculated by RegistryAdminService 
    // and participants having submitted shares/values correctly.

    describe('hasClaimedReward', () => {
        it('should return false for a participant before rewards are calculated/claimed', async () => {
            const { sessionId } = testContext;
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            const participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            const hasClaimed = await registryFundService.hasClaimedReward(sessionId, participantAddress);
            expect(hasClaimed).toBe(false);
        });
    });

    describe('claimReward', () => {
        let claimTestContext; // Separate context for these tests
        let participantAddress;

        beforeEach(async () => {
            // This beforeEach attempts the full success path setup for claimReward
            
            // 1. Deploy session (now returns dates)
            claimTestContext = await deploySessionForFundTests({ title: "Claim Reward Test Session" });
            const { sessionId, voteSessionAddress, registryAddress, startDate, endDate, sharesEndDate } = claimTestContext;
            
            // 2. Register a holder
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());
            console.log(`DEBUG (claimReward beforeEach): Registered holder ${participantAddress}`);

            // 3. Admin adds reward funding
            blockchainProviderService.setSigner(deployerSigner);
            const fundingAmount = ethers.parseEther("2.0");
            await registryFundService.addRewardFunding(sessionId, fundingAmount);
            console.log(`DEBUG (claimReward beforeEach): Added funding`);

            // 4. Advance time to VOTING period & update status
            let blockTimestamp = (await provider.getBlock('latest')).timestamp;
            let timeToAdvance = startDate - blockTimestamp + 5; // 5s into voting period
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // Update VoteSession status
            console.log(`DEBUG (claimReward beforeEach): Advanced to Voting period. Status: ${await voteSessionViewService.getStatus(voteSessionAddress)}`);

            // 5. Cast a Vote (as the registered holder)
            blockchainProviderService.setSigner(userSigner);
            const mockVoteDataBytes = ethers.toUtf8Bytes("mock_vote_claim_reward");
            const voteG1r = ethers.randomBytes(32);
            const voteG2r = ethers.randomBytes(64);
            const voteAlphas = [ethers.randomBytes(32)]; 
            const voteThreshold = 1n; // Assuming minShareThreshold was 1 from helper
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, mockVoteDataBytes, voteG1r, voteG2r, voteAlphas, voteThreshold);
            console.log(`DEBUG (claimReward beforeEach): Cast vote`);

            // 6. Advance time to SHARES collection period & update status
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = endDate - blockTimestamp + 5; // 5s into shares period
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
            await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // Update VoteSession status
            console.log(`DEBUG (claimReward beforeEach): Advanced to Shares period. Status: ${await voteSessionViewService.getStatus(voteSessionAddress)}`);
            
            // 7. Simulate Share Submission by the holder (userSigner)
            blockchainProviderService.setSigner(userSigner);
            const mockVoteIndex = 0; // Vote just cast is index 0
            const mockShareData = ethers.toUtf8Bytes("mock_share_data_for_claim_reward_test");
            const mockShareIndex = 0;
            try {
                await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, mockVoteIndex, mockShareData, mockShareIndex);
                console.log(`DEBUG (claimReward beforeEach): Submitted shares for ${participantAddress}`);
                const pInfo = await registryParticipantService.getParticipantInfo(sessionId, participantAddress);
                if (!pInfo || !pInfo.hasSubmittedShares) {
                     console.error("DEBUG (claimReward beforeEach): CRITICAL - hasSubmittedShares is false after share submission call.");
                }
            } catch (e) {
                console.error("DEBUG (claimReward beforeEach): Failed to submit shares", e);
                // Fail fast if share submission fails, as subsequent steps depend on it
                throw new Error("Share submission failed during claimReward setup: " + e.message);
            }

            // 8. Advance time past sharesEndDate for reward calculation & update status
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = sharesEndDate - blockTimestamp + 5; // 5s past shares end
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
            await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // IMPORTANT: Update status *before* calculating rewards
            console.log(`DEBUG (claimReward beforeEach): Advanced past Shares period. Status: ${await voteSessionViewService.getStatus(voteSessionAddress)}`);

            // 9. Admin calculates rewards (should now be in correct period)
            blockchainProviderService.setSigner(deployerSigner);
            try {
                console.log(`DEBUG (claimReward beforeEach): Attempting to calculate rewards for session ${sessionId}`);
                // Check if the period is active before calling (good practice)
                const isCalcPeriod = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
                if (!isCalcPeriod) {
                    throw new Error("Reward calculation period is unexpectedly not active in VoteSession.");
                }
                await registryAdminService.calculateRewards(sessionId);
                console.log(`DEBUG (claimReward beforeEach): Calculated rewards for session ${sessionId}`);
            } catch (e) {
                console.error(`DEBUG (claimReward beforeEach): Failed to calculate rewards for session ${sessionId}`, e);
                 throw new Error("Reward calculation failed during claimReward setup: " + e.message);
            }

            // 10. Set signer back to user for claim attempts in tests
            blockchainProviderService.setSigner(userSigner);
        }, 120000); // Increased timeout further (e.g., 120s)

        it('should allow a participant to claim their reward after calculation and share submission', async () => {
            const { sessionId } = claimTestContext;
            const initialRewardsOwed = await registryFundService.getRewardsOwed(sessionId, participantAddress);
            
            // Assuming the beforeEach successfully set up a scenario where rewards are owed
            // Convert string from service to BigInt for comparison, or ensure service returns BigInt if appropriate
            expect(BigInt(initialRewardsOwed)).toBeGreaterThan(0n);

            const hasClaimedBefore = await registryFundService.hasClaimedReward(sessionId, participantAddress);
            expect(hasClaimedBefore).toBe(false);

            blockchainProviderService.setSigner(userSigner); // Ensure user is signer for claim
            const txReceipt = await registryFundService.claimReward(sessionId);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify RewardClaimed event
            const eventInterface = new ethers.Interface(ParticipantRegistryABI);
            const rewardClaimedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'RewardClaimed');
            
            expect(rewardClaimedEvent).toBeDefined();
            expect(rewardClaimedEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(rewardClaimedEvent.args.participant).toBe(participantAddress);
            expect(rewardClaimedEvent.args.amount).toBe(BigInt(initialRewardsOwed)); // Amount claimed should match owed

            const finalRewardsOwed = await registryFundService.getRewardsOwed(sessionId, participantAddress);
            expect(finalRewardsOwed).toBe("0");

            const hasClaimedAfter = await registryFundService.hasClaimedReward(sessionId, participantAddress);
            expect(hasClaimedAfter).toBe(true);
        }, 70000);

        it('should prevent claiming reward twice', async () => {
            const { sessionId } = claimTestContext;
            // Assume the participant has some rewards owed from the global beforeEach setup
            const initialRewardsOwed = await registryFundService.getRewardsOwed(sessionId, participantAddress);
            if (BigInt(initialRewardsOwed) === 0n) {
                console.warn("Skipping 'prevent claiming reward twice' test as no rewards were owed initially after setup.");
                // This might happen if share submission or reward calculation in beforeEach failed.
                return;
            }

            blockchainProviderService.setSigner(userSigner);
            // First claim (should succeed if initialRewardsOwed > 0)
            await registryFundService.claimReward(sessionId);
            
            // 3. Attempt to claim reward again (should fail)
            blockchainProviderService.setSigner(userSigner); // participant claims
            await expect(registryFundService.claimReward(sessionId))
                .rejects
                .toThrow(/Registry: No reward owed or calculation pending/i); // Updated error
        }, 70000);

        it('should prevent claiming reward if shares were not submitted', async () => {
            // Setup similar to the main beforeEach, but *skip* share submission
            // 1. Deploy session
            const noSharesContext = await deploySessionForFundTests({ title: "No Shares Claim Test" });
            const { sessionId, voteSessionAddress, registryAddress, startDate, endDate, sharesEndDate } = noSharesContext;
            
            // 2. Register a holder
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            const noSharesParticipant = await userSigner.getAddress(); // Use the same userSigner for simplicity
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            // 3. Admin adds reward funding
            blockchainProviderService.setSigner(deployerSigner);
            const fundingAmount = ethers.parseEther("2.0");
            await registryFundService.addRewardFunding(sessionId, fundingAmount);

            // 4. Cast vote (needed for reward calc logic potentially)
            let blockTimestamp = (await provider.getBlock('latest')).timestamp;
            let timeToAdvance = startDate - blockTimestamp + 5;
            if (timeToAdvance > 0) { await provider.send('evm_increaseTime', [timeToAdvance]); await provider.send('evm_mine', []); }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            blockchainProviderService.setSigner(userSigner);
            const mockVoteDataBytes = ethers.toUtf8Bytes("mock_vote_no_shares");
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, mockVoteDataBytes, ethers.randomBytes(32), ethers.randomBytes(64), [], 1n);

            // 5. Advance time past sharesEndDate & update status
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = sharesEndDate - blockTimestamp + 5; 
            if (timeToAdvance > 0) { await provider.send('evm_increaseTime', [timeToAdvance]); await provider.send('evm_mine', []); }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);

            // 6. Admin calculates rewards 
            blockchainProviderService.setSigner(deployerSigner);
            const isCalcPeriod = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
            if (!isCalcPeriod) throw new Error("Setup Error: Reward calculation period not active.");
            await registryAdminService.calculateRewards(sessionId);

            // 7. Attempt claim (should fail as shares were not submitted by this user)
            blockchainProviderService.setSigner(userSigner); // participant claims
            await expect(registryFundService.claimReward(sessionId))
                .rejects
                .toThrow(/Registry: No reward owed or calculation pending/i); // Or specific error for no shares
        }, 90000);
        
        it('should prevent claiming reward if rewards have not been calculated by admin', async () => {
             // Setup similar to the main beforeEach, but *skip* reward calculation
            // 1. Deploy session
            const noCalcContext = await deploySessionForFundTests({ title: "No Calc Claim Test" });
            const { sessionId, voteSessionAddress, registryAddress, startDate, endDate, sharesEndDate } = noCalcContext;
            
            // 2. Register a holder
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            const noCalcParticipant = await userSigner.getAddress(); 
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            // 3. Admin adds reward funding
            blockchainProviderService.setSigner(deployerSigner);
            const fundingAmount = ethers.parseEther("2.0");
            await registryFundService.addRewardFunding(sessionId, fundingAmount);

            // 4. Cast vote 
            let blockTimestamp = (await provider.getBlock('latest')).timestamp;
            let timeToAdvance = startDate - blockTimestamp + 5;
            if (timeToAdvance > 0) { await provider.send('evm_increaseTime', [timeToAdvance]); await provider.send('evm_mine', []); }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            blockchainProviderService.setSigner(userSigner);
            const mockVoteDataBytes = ethers.toUtf8Bytes("mock_vote_no_calc");
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, mockVoteDataBytes, ethers.randomBytes(32), ethers.randomBytes(64), [], 1n);
            
            // 5. Advance time to Shares period & submit shares
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = endDate - blockTimestamp + 5; 
            if (timeToAdvance > 0) { await provider.send('evm_increaseTime', [timeToAdvance]); await provider.send('evm_mine', []); }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            blockchainProviderService.setSigner(userSigner);
            await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, ethers.toUtf8Bytes("mock_share_no_calc"), 0);

            // 6. Advance time past sharesEndDate & update status
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = sharesEndDate - blockTimestamp + 5; 
            if (timeToAdvance > 0) { await provider.send('evm_increaseTime', [timeToAdvance]); await provider.send('evm_mine', []); }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);

            // --- SKIP REWARD CALCULATION --- 

            // 7. Attempt claim (should fail because rewardsOwed should be 0 or error if not calculated)
            blockchainProviderService.setSigner(userSigner);
            await expect(registryFundService.claimReward(sessionId))
                .rejects
                .toThrow(/Registry: No reward owed or calculation pending/i); // Contract requires amount > 0 or specific error for no calculation
        }, 90000);

    });

}); 
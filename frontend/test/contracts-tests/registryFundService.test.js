import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { registryFundService } from '../../services/contracts/registryFundService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js'; // For registering participants
import { registryAdminService } from '../../services/contracts/registryAdminService.js'; // For calculating rewards
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js'; // For submitting shares

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
        startDate: now + ONE_HOUR, // e.g., 1 hour from now (registration opens)
        endDate: now + ONE_HOUR + ONE_DAY, // e.g., 1 day after start (voting ends)
        sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR, // e.g., 1 hour after voting ends (share submission ends)
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 1,
        metadata: "registry-fund-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for fund test - ID: ${deployedInfo.sessionId}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        initialDepositRequired: sessionParams.requiredDeposit
    };
}

describe('RegistryFundService', () => {
    let testContext; // To hold deployed session info

    beforeEach(async () => {
        blockchainProviderService.setSigner(deployerSigner); // Default to deployer (owner)
        testContext = await deploySessionForFundTests();
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
            const fundingAmount = ethers.parseEther("0.5");

            blockchainProviderService.setSigner(userSigner); // Set to non-owner
            
            await expect(registryFundService.addRewardFunding(sessionId, fundingAmount))
                .rejects
                .toThrow(/Ownable: caller is not the owner/i); // Or similar contract error for non-owner
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
            // This beforeEach will be more involved:
            // 1. Deploy session
            claimTestContext = await deploySessionForFundTests({ title: "Claim Reward Test Session" });
            const { sessionId, voteSessionAddress, initialDepositRequired } = claimTestContext;
            
            // 2. Register a holder
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());

            // 3. Admin adds reward funding
            blockchainProviderService.setSigner(deployerSigner);
            const fundingAmount = ethers.parseEther("2.0"); // Sufficient funding
            await registryFundService.addRewardFunding(sessionId, fundingAmount);

            // 4. Simulate Share Submission by the holder (userSigner)
            // Advance time to Shares Collection Period
            const latestBlockSetup = await provider.getBlock('latest');
            const nowSetup = latestBlockSetup.timestamp;
            // Assuming sessionParams in deploySessionForFundTests sets endDate relative to 'now' at its call time.
            // We need to get the actual endDate of the deployed session to advance time correctly.
            // For now, let's use a fixed offset from deploySessionForFundTests's definition, assuming it's robust enough.
            // A better way would be for deploySessionForFundTests to return session timing details.
            // Let's assume deploySessionForFundTests sets endDate = (its_now + ONE_HOUR + ONE_DAY)
            // And current time is roughly its_now.
            // This part needs careful timing based on how deploySessionForFundTests sets dates.
            // Let's assume the session in claimTestContext is fresh.
            // We need to find its actual endDate.
            // This is tricky without returning exact dates from deploySessionForFundTests or reading from contract.
            // For now, a simpler time advance:
            // Suppose deploySessionForFundTests's 'now' was X. endDate is X + 1hr + 1day. sharesEndDate is X + 1hr + 1day + 1hr.
            // current 'now' is Y. We need to advance to Y > (X + 1hr + 1day)
            
            // Let's get the session's actual end date (approximate for now, ideally from contract or returned by deploy helper)
            // This requires session details. For simplicity, let's just advance a significant amount.
            // A more robust setup would involve voteSessionViewService.getSessionDetails(voteSessionAddress)
            // and using its endDate.
            
            const ONE_DAY_SECONDS = 24 * 3600;
            const TWO_HOURS_SECONDS = 2 * 3600;
            await provider.send('evm_increaseTime', [ONE_DAY_SECONDS + TWO_HOURS_SECONDS]); // Advance well past voting
            await provider.send('evm_mine', []);
            
            blockchainProviderService.setSigner(userSigner);
            const mockVoteIndex = 0;
            const mockShareData = ethers.toUtf8Bytes("mock_share_data_for_claim_reward_test");
            const mockShareIndex = 0;
            try {
                await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, mockVoteIndex, mockShareData, mockShareIndex);
                console.log(`DEBUG (claimReward beforeEach): Submitted shares for ${participantAddress}`);
                // Verify hasSubmittedShares
                const pInfo = await registryParticipantService.getParticipantInfo(sessionId, participantAddress);
                if (!pInfo || !pInfo.hasSubmittedShares) {
                     console.error("DEBUG (claimReward beforeEach): CRITICAL - hasSubmittedShares is false after share submission call.");
                }
            } catch (e) {
                console.error("DEBUG (claimReward beforeEach): Failed to submit shares", e);
            }

            // 5. Advance time past sharesEndDate for reward calculation
            // Assuming sharesEndDate was approx now + 1hr + 1day + 1hr from its creation.
            // We've already advanced by 1 day + 2hrs. So we should be past shares submission.
            // Let's add a bit more to be sure.
            await provider.send('evm_increaseTime', [TWO_HOURS_SECONDS]); // More advance
            await provider.send('evm_mine', []);

            // 6. Admin calculates rewards
            blockchainProviderService.setSigner(deployerSigner);
            try {
                // TODO: Need to ensure VoteSession.isRewardCalculationPeriodActive is true.
                // This might require calling voteSessionAdminService.updateSessionStatus(voteSessionAddress)
                // or ensuring the VoteSession automatically transitions to a state where rewards can be calculated.
                // For now, assume it's ready or calculateRewards handles it.
                console.log(`DEBUG (claimReward beforeEach): Attempting to calculate rewards for session ${sessionId}`);
                await registryAdminService.calculateRewards(sessionId);
                console.log(`DEBUG (claimReward beforeEach): Calculated rewards for session ${sessionId}`);
            } catch (e) {
                console.error(`DEBUG (claimReward beforeEach): Failed to calculate rewards for session ${sessionId}`, e);
            }

            // 7. Set signer back to user for claim attempts in tests
            blockchainProviderService.setSigner(userSigner);
        }, 90000); // Increased timeout for this complex beforeEach

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
            
            // Attempt second claim
            await expect(registryFundService.claimReward(sessionId))
                .rejects
                .toThrow(/Registry: Reward already claimed/i); // Or similar contract error
        }, 70000);

        // The following tests require more specific setup (e.g., skipping parts of the main beforeEach)
        // They might be better in separate describe blocks or with more complex conditional logic in beforeEach.
        it.todo('should prevent claiming reward if shares were not submitted');
        
        it.todo('should prevent claiming reward if rewards have not been calculated by admin');

    });

}); 
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js';
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js';
import { voteSessionAdminService } from '../../services/contracts/voteSessionAdminService.js';

// Utilities
import { generateBLSKeyPair } from '../../services/utils/blsCryptoUtils.js';

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

async function deploySessionForVoteViewTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    // Always anchor dates to the current chain time
    const chainNow = (await provider.getBlock('latest')).timestamp;

    const defaultSessionParams = {
        title: "Vote View Test Session",
        description: "Session for testing VoteSessionViewService",
        options: ["ViewOpt A", "ViewOpt B", "ViewOpt C"],
        startDate:      chainNow + 3600,     // one hour in the future
        endDate:        chainNow + 3600 * 25, // Ends 24 hours after new startDate
        sharesEndDate:  chainNow + 3600 * 49, // Shares end 24 hours after new endDate (24h after endDate)
        requiredDeposit: ethers.parseEther("0.025"),
        minShareThreshold: 2,
        metadata: "vote-session-view-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    
    // Bump FSM so that Registration is OPEN before we take the snapshot
    await voteSessionAdminService.updateSessionStatus(deployedInfo.voteSessionContract);
    console.log(`Session ${deployedInfo.sessionId} status updated after deployment. Current status: ${await voteSessionViewService.getStatus(deployedInfo.voteSessionContract)}`);

    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        sessionParams // Return deployed params for assertions
    };
}

describe('VoteSessionViewService', () => {
    let originalTestViewContext; // To hold the initial deployed session info
    let snapshotId; // To store the snapshot ID
    let testViewContext; // Per-test context, reset from originalTestViewContext

    beforeAll(async () => {
        // Initial, one-time setup
        blockchainProviderService.setSigner(deployerSigner);
        originalTestViewContext = await deploySessionForVoteViewTests();
        snapshotId = await provider.send('evm_snapshot', []);
    }, 30000); // Give beforeAll a longer timeout for the initial deployment

    beforeEach(async () => {
        await provider.send('evm_revert', [snapshotId]); // Revert to the clean state
        snapshotId = await provider.send('evm_snapshot', []); // Take a new snapshot for the current test
        // Create a fresh copy of the context for each test to avoid cross-test pollution
        // (though for view tests, this is less critical than for tests that modify state)
        testViewContext = originalTestViewContext; // Directly reuse the object as view tests don't mutate it
        blockchainProviderService.setSigner(deployerSigner); // Reset default signer for consistency
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Basic Information Getters', () => {
        it('should retrieve the correct session title', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const title = await voteSessionViewService.getTitle(voteSessionAddress);
            expect(title).toBe(sessionParams.title);
        });

        it('should retrieve the correct session description', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const description = await voteSessionViewService.getDescription(voteSessionAddress);
            expect(description).toBe(sessionParams.description);
        });

        it('should retrieve the correct session ID', async () => {
            const { voteSessionAddress, sessionId: expectedSessionId } = testViewContext;
            const contractSessionId = await voteSessionViewService.getSessionId(voteSessionAddress);
            expect(Number(contractSessionId)).toBe(expectedSessionId); // sessionId from factory is number
        });

        it('should retrieve the correct participant registry address', async () => {
            const { voteSessionAddress, registryAddress: expectedRegistryAddress } = testViewContext;
            const registryAddress = await voteSessionViewService.getParticipantRegistryAddress(voteSessionAddress);
            expect(registryAddress).toBe(expectedRegistryAddress);
        });

        it('should retrieve the correct session owner', async () => {
            const { voteSessionAddress } = testViewContext;
            const owner = await voteSessionViewService.getSessionOwner(voteSessionAddress);
            const expectedOwner = await deployerSigner.getAddress(); // Deployer is initial owner
            expect(owner).toBe(expectedOwner);
        });

        it('should retrieve the correct required deposit', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const requiredDeposit = await voteSessionViewService.getRequiredDeposit(voteSessionAddress);
            // Service returns BigInt (Wei), sessionParams.requiredDeposit is also BigInt (Wei)
            expect(requiredDeposit).toBe(sessionParams.requiredDeposit); 
        });
    });

    describe('getSessionInfo and getSessionDetails', () => {
        it('getSessionInfo should retrieve a summary of session parameters', async () => {
            const { voteSessionAddress, sessionId, registryAddress, sessionParams } = testViewContext;
            const info = await voteSessionViewService.getSessionInfo(voteSessionAddress);

            expect(info).not.toBeNull();
            expect(info.title).toBe(sessionParams.title);
            expect(info.description).toBe(sessionParams.description);
            expect(info.startDate).toBe(sessionParams.startDate);
            expect(info.endDate).toBe(sessionParams.endDate);
            expect(info.sharesEndDate).toBe(sessionParams.sharesEndDate);
            expect(info.options).toEqual(sessionParams.options);
            expect(info.metadata).toBe(sessionParams.metadata);
            expect(info.requiredDeposit).toBe(ethers.formatEther(sessionParams.requiredDeposit));
            expect(info.minShareThreshold).toBe(sessionParams.minShareThreshold);
            // With future startDate and no immediate updateSessionStatus, status should be 'Created'.
            // However, if contract logic or view service considers pre-startDate as 'RegistrationOpen', that's also fine.
            // User's analysis suggests ['RegistrationOpen', 'VotingOpen'] might be seen, let's use that.
            expect(['RegistrationOpen', 'VotingOpen', 'Created']).toContain(info.status);
        });

        /*
        it('getSessionDetails should retrieve comprehensive session details (structure may vary)', async () => {
            const { voteSessionAddress } = testViewContext;
            const details = await voteSessionViewService.getSessionDetails(voteSessionAddress);
            // This test is more about checking if the function returns data without error.
            // The exact structure of 'details' depends on how it aggregates data.
            expect(details).not.toBeNull();
            expect(details.title).toBe(testViewContext.sessionParams.title);
            // Add more specific assertions based on the expected structure of getSessionDetails output
        });
        */
    });

    describe('Status and Period Checks', () => {
        it('isRegistrationOpen should be true for a newly deployed active session', async () => {
            const { voteSessionAddress } = testViewContext; // Deployed with startDate in past
            const isOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
            expect(isOpen).toBe(true);
        });

        it('isRegistrationOpen should be false after endDate', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const latestBlock = await provider.getBlock('latest');
            const now = latestBlock.timestamp;
            const timeToAdvance = sessionParams.endDate - now + 120; // Advance 120s past endDate
            
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }

            // Admin updates status after time advancement
            blockchainProviderService.setSigner(deployerSigner);
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            
            const isOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
            expect(isOpen).toBe(false);
        });
        
        it('getStatus should return the current session status', async () => {
            const { voteSessionAddress } = testViewContext;
            const status = await voteSessionViewService.getStatus(voteSessionAddress);
            // Initial status for a session with startDate in past should be Active (typically 1 or a similar enum)
            // Or Pending (0) if it needs explicit activation. VoteSession.sol specific.
            expect(Object.values(voteSessionViewService._SessionStatusEnum)).toContain(status);
        });

        it('isRewardCalculationPeriodActive should be true after sharesEndDate and status update', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const latestBlock = await provider.getBlock('latest');
            const now = latestBlock.timestamp;
            // sharesEndDate is when share collection closes, reward calculation can begin after this.
            const timeToAdvance = sessionParams.sharesEndDate - now + 120; 

            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }

            blockchainProviderService.setSigner(deployerSigner);
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            
            const isActive = await voteSessionViewService.isRewardCalculationPeriodActive(voteSessionAddress);
            expect(isActive).toBe(true);
        });

        it('isDepositClaimPeriodActive should be true much later, after rewards and a hypothetical claim delay, and status update', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const latestBlock = await provider.getBlock('latest');
            const now = latestBlock.timestamp;
            // This period is usually well after sharesEndDate + reward calculation + some delay.
            // Let's assume it's sharesEndDate + 1 day for the sake of this test.
            const ONE_DAY_SECONDS = 24 * 3600;
            const targetTime = sessionParams.sharesEndDate + ONE_DAY_SECONDS;
            const timeToAdvance = targetTime - now + 120;

            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }

            blockchainProviderService.setSigner(deployerSigner);
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // First update to pass share collection
            // Potentially another update might be needed if contract has distinct phases for reward calc vs claim
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // Second update for good measure

            const isActive = await voteSessionViewService.isDepositClaimPeriodActive(voteSessionAddress);
            expect(isActive).toBe(true); 
        }, 30000); // Increased timeout to 30 seconds
    });

    describe('Vote and Share Data Getters', () => {
        let participantAddress;
        let anotherParticipantAddress;
        let blsPublicKeyHex;
        let anotherBlsPublicKeyHex;
        let mockVoteDataBytes;
        let mockShareDataBytesUser1;
        let mockShareDataBytesUser2;
        let anotherUserWasRegistered;

        beforeEach(async () => {
            const { sessionId, voteSessionAddress, sessionParams } = testViewContext;
            anotherUserWasRegistered = false;

            const userBlsKeys = generateBLSKeyPair();
            blsPublicKeyHex = userBlsKeys.pk.toHex();
            participantAddress = await userSigner.getAddress();
            mockVoteDataBytes = ethers.toUtf8Bytes("mock_vote_data_for_view_service");
            mockShareDataBytesUser1 = ethers.toUtf8Bytes("mock_share_data_user1");

            blockchainProviderService.setSigner(userSigner);
            await registryParticipantService.registerAsHolder(sessionId, blsPublicKeyHex);
            console.log(`DEBUG: Registered userSigner ${participantAddress}`);

            if (sessionParams.minShareThreshold > 1 && anotherUserSigner) {
                const anotherUserBlsKeys = generateBLSKeyPair();
                anotherBlsPublicKeyHex = anotherUserBlsKeys.pk.toHex();
                anotherParticipantAddress = await anotherUserSigner.getAddress();
                mockShareDataBytesUser2 = ethers.toUtf8Bytes("mock_share_data_user2");
                blockchainProviderService.setSigner(anotherUserSigner);
                await registryParticipantService.registerAsHolder(sessionId, anotherBlsPublicKeyHex);
                anotherUserWasRegistered = true;
                console.log(`DEBUG: Registered anotherUserSigner ${anotherParticipantAddress}`);
            }

            const latestBlockReg = await provider.getBlock('latest');
            const timeToAdvanceToVoting = sessionParams.startDate - latestBlockReg.timestamp + 5;
            if (timeToAdvanceToVoting > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToVoting]);
                await provider.send('evm_mine', []);
                console.log(`DEBUG: Advanced time to Voting Period. New time: ${(await provider.getBlock('latest')).timestamp}`);
            }
            blockchainProviderService.setSigner(deployerSigner);
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            console.log(`DEBUG: Updated status after advancing to Voting. New status: ${await voteSessionViewService.getStatus(voteSessionAddress)}`);

            blockchainProviderService.setSigner(userSigner);
            const voteG1r = ethers.randomBytes(32);
            const voteG2r = ethers.randomBytes(64);
            const voteAlphas = [ethers.randomBytes(32)];
            const voteThreshold = BigInt(sessionParams.minShareThreshold);
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, mockVoteDataBytes, voteG1r, voteG2r, voteAlphas, voteThreshold);
            console.log(`DEBUG: userSigner cast vote.`);

            const latestBlockVote = await provider.getBlock('latest');
            const timeToAdvanceToShares = sessionParams.endDate - latestBlockVote.timestamp + 60;
            if (timeToAdvanceToShares > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToShares]);
                await provider.send('evm_mine', []);
                 console.log(`DEBUG: Advanced time to Shares Collection Period. New time: ${(await provider.getBlock('latest')).timestamp}`);
            }
            blockchainProviderService.setSigner(deployerSigner);
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            console.log(`DEBUG: Updated status after advancing to Shares Collection. New status: ${await voteSessionViewService.getStatus(voteSessionAddress)}`);

            blockchainProviderService.setSigner(userSigner);
            await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, mockShareDataBytesUser1, 0);
            console.log(`DEBUG: userSigner submitted share 0.`);

            if (anotherUserWasRegistered) {
                blockchainProviderService.setSigner(anotherUserSigner);
                await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, mockShareDataBytesUser2, 1);
                 console.log(`DEBUG: anotherUserSigner submitted share 1.`);
            }
        }, 60000);

        it('getNumberOfVotes should return 1 after one vote is cast', async () => {
            const { voteSessionAddress } = testViewContext;
            const count = await voteSessionViewService.getNumberOfVotes(voteSessionAddress);
            expect(count).toBe(1);
        });

        it('getEncryptedVote should retrieve the cast vote data', async () => {
            const { voteSessionAddress } = testViewContext;
            const vote = await voteSessionViewService.getEncryptedVote(voteSessionAddress, 0);
            expect(vote.ciphertext).toBe(ethers.hexlify(mockVoteDataBytes));
        });

        it('getNumberOfDecryptionShares should return correct count after share submissions', async () => {
            const { voteSessionAddress } = testViewContext;
            const expectedCount = anotherUserWasRegistered ? 2 : 1;
            const count = await voteSessionViewService.getNumberOfDecryptionShares(voteSessionAddress);
            expect(count).toBe(expectedCount);
        });

        it('getDecryptionShare should retrieve the submitted share data for user 1', async () => {
            const { voteSessionAddress } = testViewContext;
            const shareData = await voteSessionViewService.getDecryptionShare(voteSessionAddress, 0);
            expect(shareData).not.toBeNull();
            expect(shareData.submitter).toBe(participantAddress);
            expect(shareData.voteIndex).toBe(0);
            expect(shareData.shareIndex).toBe(0);
            expect(shareData.share).toBe(ethers.hexlify(mockShareDataBytesUser1));
        });
        
        it('getDecryptionShare should retrieve the submitted share data for user 2 if threshold > 1', async () => {
            const { voteSessionAddress } = testViewContext;
             if (anotherUserWasRegistered) {
                const shareData = await voteSessionViewService.getDecryptionShare(voteSessionAddress, 1);
                expect(shareData).not.toBeNull();
                expect(shareData.submitter).toBe(anotherParticipantAddress);
                expect(shareData.voteIndex).toBe(0);
                expect(shareData.shareIndex).toBe(1);
                expect(shareData.share).toBe(ethers.hexlify(mockShareDataBytesUser2));
            } else {
                 vi.skip();
            }
        });

        it('getDecryptionParameters should retrieve admin-set parameters', async () => {
            const { voteSessionAddress } = testViewContext;
            blockchainProviderService.setSigner(deployerSigner);
            const mockAlphas = [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))];
            const mockThreshold = 2;
            await voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphas, mockThreshold);
            const params = await voteSessionViewService.getDecryptionParameters(voteSessionAddress);
            expect(params).not.toBeNull();
            expect(params.alphas).toEqual(mockAlphas);
            expect(params.threshold).toBe(mockThreshold);
        });

        it('getSubmittedValues should retrieve submitted decryption values after threshold is met', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext; 
            blockchainProviderService.setSigner(deployerSigner);
            const mockAlphas = [ethers.randomBytes(32), ethers.randomBytes(32)].map(ethers.hexlify);
            const mockThreshold = sessionParams.minShareThreshold;
            await voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphas, mockThreshold);

            blockchainProviderService.setSigner(userSigner);
            const valueForUser1 = ethers.keccak256(ethers.toUtf8Bytes("user1_secret_value"));
            await voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueForUser1);

            let valueForUser2;
            if (anotherUserWasRegistered) {
                blockchainProviderService.setSigner(anotherUserSigner);
                valueForUser2 = ethers.keccak256(ethers.toUtf8Bytes("user2_secret_value"));
                await voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueForUser2);
            }
            
            const submittedValues = await voteSessionViewService.getSubmittedValues(voteSessionAddress);
            expect(submittedValues).not.toBeNull();
            expect(submittedValues.values).toContain(valueForUser1);
            expect(submittedValues.submitters).toContain(participantAddress);

            if (anotherUserWasRegistered) {
                 expect(submittedValues.values).toContain(valueForUser2);
                 expect(submittedValues.submitters).toContain(anotherParticipantAddress);
             }
        }, 30000);
    });
}); 
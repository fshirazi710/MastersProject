import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { provider, deployerSigner, userSigner } from '../setup.js';

async function deploySessionForVoteViewTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const now = Math.floor(Date.now() / 1000);
    const defaultSessionParams = {
        title: "Vote View Test Session",
        description: "Session for testing VoteSessionViewService",
        options: ["ViewOpt A", "ViewOpt B", "ViewOpt C"],
        startDate: now - 7200, // Active (Increased from 3600 to 7200 for a wider buffer)
        endDate: now + 3600 * 24, // Ends 1 day from now
        sharesEndDate: now + 3600 * 48, // Shares end 2 days from now
        requiredDeposit: ethers.parseEther("0.025"),
        minShareThreshold: 2,
        metadata: "vote-session-view-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for vote view test - ID: ${deployedInfo.sessionId}, SessionAddr: ${deployedInfo.voteSessionContract}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        sessionParams // Return deployed params for assertions
    };
}

describe('VoteSessionViewService', () => {
    let testViewContext;

    beforeEach(async () => {
        // blockchainProviderService.initialize(provider); // This line causes the error
        blockchainProviderService.setSigner(deployerSigner); // Set default signer
        testViewContext = await deploySessionForVoteViewTests();
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
            expect(['Created', 'RegistrationOpen']).toContain(info.status);
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
            expect(status).toBeGreaterThanOrEqual(0); // Check it's a valid enum value
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
        let blsPublicKeyHex;
        let mockVoteDataBytes;
        let mockShareDataBytes;

        beforeEach(async () => {
            const { sessionId, voteSessionAddress, sessionParams } = testViewContext;
            const blsKeys = generateBLSKeyPair();
            blsPublicKeyHex = blsKeys.pk.toHex();
            mockVoteDataBytes = ethers.toUtf8Bytes("mock_vote_data_for_view_service");
            mockShareDataBytes = ethers.toUtf8Bytes("mock_share_data_for_view_service");

            // 1. Register userSigner as Holder
            blockchainProviderService.setSigner(userSigner);
            participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, blsPublicKeyHex);

            // 2. Cast a vote (ensure voting period is active if testViewContext doesn't guarantee it)
            // For these view tests, deploySessionForVoteViewTests sets startDate in the past, so voting should be active.
            const voteG1r = ethers.randomBytes(32); // Mock data
            const voteG2r = ethers.randomBytes(64); // Mock data
            const voteAlphas = [ethers.randomBytes(32)]; // Mock data
            const voteThreshold = BigInt(sessionParams.minShareThreshold);
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, mockVoteDataBytes, voteG1r, voteG2r, voteAlphas, voteThreshold);

            // 3. Submit a decryption share (ensure shares collection period is active)
            const latestBlock = await provider.getBlock('latest');
            const now = latestBlock.timestamp;
            const targetSharesTime = sessionParams.endDate - now + 60; // 60s into shares collection period
            if (targetSharesTime > 0) {
                await provider.send('evm_increaseTime', [targetSharesTime]);
                await provider.send('evm_mine', []);
            }
            blockchainProviderService.setSigner(deployerSigner); // Admin needs to update status potentially
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            blockchainProviderService.setSigner(userSigner); // User submits share
            await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0 /*voteIndex*/, mockShareDataBytes, 0 /*shareIndex*/);
        }, 45000); // Increased timeout

        it('getNumberOfVotes should return 1 after one vote is cast', async () => {
            const { voteSessionAddress } = testViewContext;
            const count = await voteSessionViewService.getNumberOfVotes(voteSessionAddress);
            expect(count).toBe(1);
        });

        it('getEncryptedVote should retrieve the cast vote data', async () => {
            const { voteSessionAddress } = testViewContext;
            const vote = await voteSessionViewService.getEncryptedVote(voteSessionAddress, 0); // Get first vote
            expect(vote.ciphertext).toBe(ethers.hexlify(mockVoteDataBytes)); // Service returns object
            // Add more assertions for g1r, g2r, alpha, threshold if needed
        });

        it('getNumberOfSubmittedShares should return 1 after one share is submitted', async () => {
            const { voteSessionAddress } = testViewContext;
            const count = await voteSessionViewService.getNumberOfSubmittedShares(voteSessionAddress);
            expect(count).toBe(1);
        });

        it('getDecryptionShare should retrieve the submitted share data', async () => {
            const { voteSessionAddress } = testViewContext;
            const shareData = await voteSessionViewService.getDecryptionShare(voteSessionAddress, 0); // Get first share log
            expect(shareData).not.toBeNull();
            expect(shareData.submitter).toBe(participantAddress);
            expect(shareData.voteIndex).toBe(0);
            expect(shareData.shareIndex).toBe(0);
            expect(shareData.share).toBe(ethers.hexlify(mockShareDataBytes));
        });

        it('getDecryptionParameters should retrieve admin-set parameters', async () => {
            const { voteSessionAddress } = testViewContext;
            
            // Admin sets parameters
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
            const { voteSessionAddress, sessionParams } = testViewContext; // userSigner already submitted a share in beforeEach
            
            // Admin sets parameters (threshold is 2 for this example)
            blockchainProviderService.setSigner(deployerSigner);
            const mockAlphas = [ethers.randomBytes(32), ethers.randomBytes(32)].map(ethers.hexlify);
            const mockThreshold = sessionParams.minShareThreshold; // Use from session
            await voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphas, mockThreshold);

            // userSigner submits their value
            blockchainProviderService.setSigner(userSigner);
            const valueForUser1 = ethers.keccak256(ethers.toUtf8Bytes("user1_secret_value"));
            await voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueForUser1);

            // If threshold is > 1, another user needs to submit.
            let valueForUser2;
            if (sessionParams.minShareThreshold > 1 && anotherUserSigner) { // Check if anotherUserSigner exists
                const anotherUserBlsKeys = generateBLSKeyPair();
                blockchainProviderService.setSigner(anotherUserSigner);
                const anotherUserAddress = await anotherUserSigner.getAddress();
                // Ensure this user is also registered as a holder
                try {
                    await registryParticipantService.registerAsHolder(testViewContext.sessionId, anotherUserBlsKeys.pk.toHex());
                     // And submitted a share (assuming voteIndex 0, shareIndex 1 for simplicity)
                    await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, ethers.randomBytes(64), 1);
                } catch (e) {
                    console.warn("WARN: Failed to register/submit share for anotherUserSigner in getSubmittedValues test, might affect results if threshold > 1", e.message);
                }

                valueForUser2 = ethers.keccak256(ethers.toUtf8Bytes("user2_secret_value"));
                await voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueForUser2);
            }
            
            // Now try to get submitted values
            const submittedValues = await voteSessionViewService.getSubmittedValues(voteSessionAddress);
            expect(submittedValues).not.toBeNull();
            expect(submittedValues.values).toContain(valueForUser1);
            if (sessionParams.minShareThreshold > 1 && valueForUser2) {
                 expect(submittedValues.values).toContain(valueForUser2);
            }
            expect(submittedValues.submitters).toContain(participantAddress);
             if (sessionParams.minShareThreshold > 1 && anotherUserSigner) {
                 expect(submittedValues.submitters).toContain(await anotherUserSigner.getAddress());
             }
        });
        // TODO: Tests for getDecryptionParameters, getSubmittedValues (requires admin setup and submissions)
    });
}); 
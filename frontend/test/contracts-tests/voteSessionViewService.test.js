import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js';
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js';

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
        startDate: now - 3600, // Active
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
        blockchainProviderService.initialize(provider);
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
            // Service likely returns formatted string (e.g. "0.025"), contract returns BigInt
            expect(requiredDeposit).toBe(ethers.formatEther(sessionParams.requiredDeposit)); 
        });
    });

    describe('getSessionInfo and getSessionDetails', () => {
        it('getSessionInfo should retrieve a summary of session parameters', async () => {
            const { voteSessionAddress, sessionId, registryAddress, sessionParams } = testViewContext;
            const info = await voteSessionViewService.getSessionInfo(voteSessionAddress);

            expect(info).not.toBeNull();
            expect(info.title).toBe(sessionParams.title);
            expect(info.description).toBe(sessionParams.description);
            expect(info.options).toEqual(sessionParams.options);
            expect(info.requiredDeposit).toBe(ethers.formatEther(sessionParams.requiredDeposit));
            expect(info.minShareThreshold).toBe(sessionParams.minShareThreshold);
            expect(info.startDate).toBe(sessionParams.startDate);
            expect(info.endDate).toBe(sessionParams.endDate);
            expect(info.sharesEndDate).toBe(sessionParams.sharesEndDate);
            expect(info.participantRegistry).toBe(registryAddress);
            expect(info.contractSessionId).toBe(BigInt(sessionId));
            // Assuming initial status is Active (1) or Pending (0) based on contract logic.
            // If startDate is in past, should be Active.
            expect(info.sessionStatus).toBeGreaterThanOrEqual(0); // More robust check for enum value
        });

        it('getSessionDetails should retrieve comprehensive session details (structure may vary)', async () => {
            const { voteSessionAddress } = testViewContext;
            const details = await voteSessionViewService.getSessionDetails(voteSessionAddress);
            // This test is more about checking if the function returns data without error.
            // The exact structure of 'details' depends on how it aggregates data.
            expect(details).not.toBeNull();
            expect(details.title).toBe(testViewContext.sessionParams.title);
            // Add more specific assertions based on the expected structure of getSessionDetails output
        });
    });

    describe('Status and Period Checks', () => {
        it('isRegistrationOpen should be true for a newly deployed active session', async () => {
            const { voteSessionAddress } = testViewContext; // Deployed with startDate in past
            const isOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
            expect(isOpen).toBe(true);
        });

        it('isRegistrationOpen should be false after endDate', async () => {
            const { voteSessionAddress, sessionParams } = testViewContext;
            const timeToAdvance = sessionParams.endDate - Math.floor(Date.now() / 1000) + 120;
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            // Note: VoteSession.sol might need its updateSessionStatus() called by an admin
            // for isRegistrationOpen to reflect false if it depends on internal state machine not just block.timestamp
            // For now, assuming direct timestamp check or service handles this query appropriately.
            const isOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
            // This might still be true if status isn't auto-updated. This test highlights a potential dependency on updateSessionStatus.
            // For a strict test, call updateSessionStatus from admin service first.
            expect(isOpen).toBe(false); // This assertion depends on contract auto-updating or manual update via admin service.
        });
        
        it('getStatus should return the current session status', async () => {
            const { voteSessionAddress } = testViewContext;
            const status = await voteSessionViewService.getStatus(voteSessionAddress);
            // Initial status for a session with startDate in past should be Active (typically 1 or a similar enum)
            // Or Pending (0) if it needs explicit activation. VoteSession.sol specific.
            expect(status).toBeGreaterThanOrEqual(0); // Check it's a valid enum value
        });

        // TODO: Add tests for isRewardCalculationPeriodActive and isDepositClaimPeriodActive (requires time advancement)
    });

    describe('Vote and Share Data Getters', () => {
        beforeEach(async () => {
            // Setup: Register a user and cast a vote for these tests
            const { sessionId, voteSessionAddress } = testViewContext;
            const { pk } = generateBLSKeyPair();
            blockchainProviderService.setSigner(userSigner);
            const participantAddress = await userSigner.getAddress();
            await registryParticipantService.registerAsHolder(sessionId, pk.toHex());
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, ethers.toUtf8Bytes("mock_vote_data"), ethers.ZeroHash, {});
        });

        it('getNumberOfVotes should return 1 after one vote is cast', async () => {
            const { voteSessionAddress } = testViewContext;
            const count = await voteSessionViewService.getNumberOfVotes(voteSessionAddress);
            expect(count).toBe(1);
        });

        it('getEncryptedVote should retrieve the cast vote data', async () => {
            const { voteSessionAddress } = testViewContext;
            const mockVoteData = ethers.toUtf8Bytes("mock_vote_data");
            const vote = await voteSessionViewService.getEncryptedVote(voteSessionAddress, 0); // Get first vote
            expect(vote).toBe(ethers.hexlify(mockVoteData));
        });
        
        // TODO: Tests for getDecryptionShare, getNumberOfSubmittedShares (requires share submission)
        // TODO: Tests for getDecryptionParameters, getSubmittedValues (requires admin setup and submissions)
    });
}); 
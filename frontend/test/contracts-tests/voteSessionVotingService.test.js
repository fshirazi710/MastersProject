import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js';
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js'; // For status/period checks
import { voteSessionAdminService } from '../../services/contracts/voteSessionAdminService.js';

// Utilities
import { generateBLSKeyPair } from '../../services/utils/blsCryptoUtils.js';

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

// Import ABI directly
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';
const VoteSessionABI = VoteSessionABI_File.abi;

async function deploySessionForVotingTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);

    const currentChainTime = (await provider.getBlock('latest')).timestamp;
    const ONE_HOUR = 3600;
    const ONE_DAY = 24 * ONE_HOUR;

    // Session will be deployed in the next block. 
    // Its startDate (registrationEndDate) will be 2 hours + 120s from *that* block's timestamp.
    const actualSessionStartDate = currentChainTime + 120 + (2 * ONE_HOUR); // Increased buffer to 120s

    console.log(`DEBUG deploySessionForVotingTests: Current chain time: ${currentChainTime}. Session will be configured with startDate (reg end): ${actualSessionStartDate}`);

    const defaultSessionParams = {
        title: "Vote Voting Test Session",
        description: "Session for testing VoteSessionVotingService",
        options: ["VoteOpt A", "VoteOpt B"],
        startDate: actualSessionStartDate, // This IS the registration end date
        endDate: actualSessionStartDate + ONE_DAY, 
        sharesEndDate: actualSessionStartDate + ONE_DAY + ONE_HOUR, 
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 2, 
        metadata: "vote-session-voting-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    
    // No explicit time setting here. Session creation will happen at currentChainTime + small_delta_for_this_tx.
    // The important part is that sessionParams.startDate is well in the future.
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for voting test - ID: ${deployedInfo.sessionId}, SessionAddr: ${deployedInfo.voteSessionContract}, Contractual StartDate (reg end): ${sessionParams.startDate}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        sessionParams // Return the actual params used, including the calculated startDate
    };
}

describe('VoteSessionVotingService', () => {
    let testVotingContext;
    let participantAddress;
    let blsKeys;
    let snapshotId; // Added for snapshot/revert

    beforeEach(async () => {
        snapshotId = await provider.send('evm_snapshot', []); // Create a snapshot

        blockchainProviderService.setSigner(deployerSigner);
        // Deploy a new session for each test context. deploySessionForVotingTests sets a future start time.
        testVotingContext = await deploySessionForVotingTests();
        const { sessionId, voteSessionAddress } = testVotingContext; // Keep sessionId and address

        // We no longer try to manipulate time back to the registration period start here.
        // Individual tests or inner describe blocks will advance time forward as needed.
        console.log(`DEBUG Main_BeforeEach: Deployed Session ${sessionId} for test. VoteSession Addr: ${voteSessionAddress}`);
        
        // Still register users needed for the tests in this fresh session context.
        // NOTE: This assumes the session STARTS in the registration period by default 
        // based on deploySessionForVotingTests setting a future startDate.
        // We might need to advance time slightly FORWARD if deploySessionForVotingTests sets time *exactly* at startDate.

        // --- Optional: Check if we need a slight advance to be *within* registration ---
        // This depends on deploySessionForVotingTests implementation detail.
        // If deploySessionForVotingTests sets time exactly TO the start of registration (startDate),
        // we might need to advance 1 second.
        // await provider.send('evm_increaseTime', [1]); 
        // await provider.send('evm_mine', []);
        // ----------------------------------------------------------------------------

        // Register userSigner
        blsKeys = generateBLSKeyPair();
        blockchainProviderService.setSigner(userSigner);
        participantAddress = await userSigner.getAddress();
        try {
            console.log(`DEBUG: Main beforeEach for session ${sessionId}: Attempting to register userSigner ${participantAddress}`);
            // We assume registration is open immediately after deployment based on deploySessionForVotingTests setup
            await registryParticipantService.registerAsHolder(sessionId, blsKeys.pk.toHex());
            console.log(`DEBUG: Main beforeEach for session ${sessionId}: Successfully registered userSigner ${participantAddress}`);
        } catch (e) {
            console.error(`ERROR in main beforeEach trying to register userSigner ${participantAddress} for session ${sessionId}:`, e);
            const regOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress); // Check status
            console.error(`Is registration actually open for session ${sessionId}? ${regOpen}. Deploy helper might need adjustment.`);
            throw e; // Fail fast if primary user registration fails
        }

        // Register anotherUserSigner
        if (anotherUserSigner) {
            const anotherBlsKeys = generateBLSKeyPair();
            blockchainProviderService.setSigner(anotherUserSigner);
            const anotherParticipantAddress = await anotherUserSigner.getAddress();
            try {
                console.log(`DEBUG: Main beforeEach for session ${sessionId}: Attempting to register anotherUserSigner ${anotherParticipantAddress}`);
                await registryParticipantService.registerAsHolder(sessionId, anotherBlsKeys.pk.toHex());
                console.log(`DEBUG: Main beforeEach for session ${sessionId}: Successfully registered anotherUserSigner ${anotherParticipantAddress}`);
            } catch (e) {
                console.error(`ERROR in main beforeEach trying to register anotherUserSigner ${anotherParticipantAddress} for session ${sessionId}:`, e);
                const regOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress); // Check status
                console.error(`Is registration actually open for session ${sessionId}? ${regOpen}.`);
                // Don't throw, let specific tests fail if they depended on this user.
            }
        }
        blockchainProviderService.setSigner(deployerSigner); // Reset signer

    }, 30000); // Keep timeout

    afterEach(async () => { // Make afterEach async
        await provider.send('evm_revert', [snapshotId]); // Revert to snapshot
        vi.restoreAllMocks();
    });

    describe('castEncryptedVote', () => {
        it('should allow a registered holder to cast a vote during voting period', async () => {
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            
            // Advance time to make the voting period active
            // Voting period starts at sessionParams.startDate (which is registrationEndDate)
            const currentTime = (await provider.getBlock('latest')).timestamp;
            const targetVotingStartTime = sessionParams.startDate + 60; // 60s into voting period

            if (targetVotingStartTime > currentTime) {
                await provider.send('evm_setNextBlockTimestamp', [targetVotingStartTime]);
                await provider.send('evm_mine', []);
            } else {
                // If already past, just ensure we are not past endDate
                if (currentTime >= sessionParams.endDate) {
                    throw new Error(`Test setup error: Current time ${currentTime} is already past voting end date ${sessionParams.endDate}`);
                }
                console.log(`WARN: Voting period for session ${sessionId} already started or slightly past intended start. Current: ${currentTime}, TargetStart: ${targetVotingStartTime}`);
            }
            console.log(`DEBUG castEncryptedVote: EVM time set to ${await provider.getBlock('latest').timestamp} for voting.`);

            const ciphertext = ethers.toUtf8Bytes("mock_encrypted_vote_payload");
            const g1r = ethers.toUtf8Bytes("mock_g1r_point_bytes"); // Placeholder G1 point
            const g2r = ethers.toUtf8Bytes("mock_g2r_point_bytes"); // Placeholder G2 point
            const alpha = [ethers.ZeroHash, ethers.ZeroHash]; // Placeholder array of bytes32, e.g., for shared secret components
            const threshold = BigInt(sessionParams.minShareThreshold); // From session parameters

            blockchainProviderService.setSigner(userSigner);
            const txReceipt = await voteSessionVotingService.castEncryptedVote(
                voteSessionAddress, 
                ciphertext,
                g1r,
                g2r,
                alpha,
                threshold
            );

            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify EncryptedVoteCast event
            const eventInterface = new ethers.Interface(VoteSessionABI);
            const voteCastEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'EncryptedVoteCast');
            
            expect(voteCastEvent).toBeDefined();
            expect(voteCastEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(voteCastEvent.args.voter).toBe(participantAddress);
            // voteCastEvent.args.voteIndex would be present, can check if it's >= 0
            expect(voteCastEvent.args.voteIndex).toBeGreaterThanOrEqual(0n); // Example check for voteIndex
        }, 60000);

        it('should prevent casting vote if not voting period', async () => {
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            
            // Scenario 1: Test before voting period (i.e., during registration)
            // deploySessionForVotingTests aims for startDate to be currentChainTime + 10 + ONE_HOUR.
            // The main beforeEach registers users. At this point, time should be before sessionParams.startDate.
            let currentTimeBeforeVoting = (await provider.getBlock('latest')).timestamp;
            console.log(`DEBUG prevent cast (before period): Current time ${currentTimeBeforeVoting}, startDate ${sessionParams.startDate}`);
            expect(currentTimeBeforeVoting).toBeLessThan(sessionParams.startDate); // Should be in registration

            const dummyParams = { ciphertext: ethers.toUtf8Bytes("vote"), g1r: ethers.toUtf8Bytes("g1r"), g2r: ethers.toUtf8Bytes("g2r"), alpha: [], threshold: 2n };            
            blockchainProviderService.setSigner(userSigner);
            await expect(voteSessionVotingService.castEncryptedVote(voteSessionAddress, dummyParams.ciphertext, dummyParams.g1r, dummyParams.g2r, dummyParams.alpha, dummyParams.threshold))
                .rejects.toThrow(/Session: Voting not open/i);

            // Scenario 2: Test after voting period ends
            const targetTimeAfterVoting = sessionParams.endDate + 60; // 60s after voting ends
            await provider.send('evm_setNextBlockTimestamp', [targetTimeAfterVoting]);
            await provider.send('evm_mine', []);
            console.log(`DEBUG prevent cast (after period): EVM time set to ${await provider.getBlock('latest').timestamp} (after voting end).`);

            await expect(voteSessionVotingService.castEncryptedVote(voteSessionAddress, dummyParams.ciphertext, dummyParams.g1r, dummyParams.g2r, dummyParams.alpha, dummyParams.threshold))
                .rejects.toThrow(/Session: Voting not open/i);
        }, 60000);
    });

    describe('submitDecryptionShare', () => {
        beforeEach(async () => {
            // Common setup for share submission: cast a vote first during voting period.
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            const currentTime = (await provider.getBlock('latest')).timestamp;
            const targetVotingTime = sessionParams.startDate + 60; // 60s into voting.
            
            if (targetVotingTime > currentTime) {
                await provider.send('evm_setNextBlockTimestamp', [targetVotingTime]);
                await provider.send('evm_mine', []);
            }
            console.log(`DEBUG submitDecryptionShare.beforeEach: EVM time set to ${await provider.getBlock('latest').timestamp} for voting.`);
            
            blockchainProviderService.setSigner(userSigner);
            await voteSessionVotingService.castEncryptedVote(
                voteSessionAddress, 
                ethers.toUtf8Bytes("initial_vote"), 
                ethers.toUtf8Bytes("g1r_setup"), 
                ethers.toUtf8Bytes("g2r_setup"), 
                [], 
                BigInt(sessionParams.minShareThreshold)
            );
        });

        it('should allow a holder to submit a decryption share during shares collection period', async () => {
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            const currentTime = (await provider.getBlock('latest')).timestamp;
            // Shares collection period is between sessionParams.endDate and sessionParams.sharesEndDate
            const targetSharesTime = sessionParams.endDate + 60; // 60s into shares collection

            if (targetSharesTime > currentTime) {
                await provider.send('evm_setNextBlockTimestamp', [targetSharesTime]);
                await provider.send('evm_mine', []);
            } else {
                 if (currentTime >= sessionParams.sharesEndDate) {
                    throw new Error(`Test setup error: Current time ${currentTime} is already past shares end date ${sessionParams.sharesEndDate}`);
                }
                console.log(`WARN: Shares collection period for session ${sessionId} already started or slightly past intended start. Current: ${currentTime}, TargetStart: ${targetSharesTime}`);
            }
            console.log(`DEBUG submitDecryptionShare: EVM time set to ${await provider.getBlock('latest').timestamp} for shares collection.`);

            const voteIndex  = 0; // index of the encrypted vote just cast
            const shareIndex = 0; // first (or only) share for that vote
            // Literal hex string for "mock_decryption_share"
            const share      = "0x6d6f636b5f64656372797074696f6e5f7368617265"; 

            blockchainProviderService.setSigner(userSigner);
            const txReceipt = await voteSessionVotingService.submitDecryptionShare(
                voteSessionAddress, 
                voteIndex,
                share,
                shareIndex
            );

            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify DecryptionShareSubmitted event
            const eventInterface = new ethers.Interface(VoteSessionABI);
            const shareSubmittedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'DecryptionShareSubmitted');
            
            expect(shareSubmittedEvent).toBeDefined();
            expect(shareSubmittedEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(shareSubmittedEvent.args.holder).toBe(participantAddress);
            expect(shareSubmittedEvent.args.shareIndex).toBe(BigInt(shareIndex));
        }, 60000);
    });
});

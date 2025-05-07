import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js';
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js'; // For status/period checks

// Utilities
import { generateBLSKeyPair } from '../../services/utils/blsCryptoUtils.js';

// Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

// Import ABI directly
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';
const VoteSessionABI = VoteSessionABI_File.abi;

async function deploySessionForVotingTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const latestBlock = await provider.getBlock('latest');
    const now = latestBlock.timestamp;
    const ONE_HOUR = 3600;
    const ONE_DAY = 24 * ONE_HOUR;

    const defaultSessionParams = {
        title: "Vote Voting Test Session",
        description: "Session for testing VoteSessionVotingService",
        options: ["VoteOpt A", "VoteOpt B"],
        startDate: now + ONE_HOUR, // Start in 1 hour to allow setup before active
        endDate: now + ONE_HOUR + ONE_DAY,   // Ends 1 day after start
        sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR, // Shares end 1 hour after voting ends
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 2, // Corrected from 1
        metadata: "vote-session-voting-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for voting test - ID: ${deployedInfo.sessionId}, SessionAddr: ${deployedInfo.voteSessionContract}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        sessionParams 
    };
}

describe('VoteSessionVotingService', () => {
    let testVotingContext;
    let participantAddress;
    let blsKeys;

    beforeEach(async () => {
        blockchainProviderService.setSigner(deployerSigner);
        testVotingContext = await deploySessionForVotingTests();

        // Advance time to make the registration period active for the deployed session
        const { sessionParams, sessionId, voteSessionAddress } = testVotingContext;
        
        const targetTimestampForRegistration = sessionParams.startDate - 30; // Target 30s *before* startDate (which is registrationEndDate)
        // console.log(`DEBUG: Current block time before advance: ${Math.floor((await provider.getBlock('latest')).timestamp)}`);
        // console.log(`DEBUG: sessionParams.startDate: ${sessionParams.startDate}`);
        // console.log(`DEBUG: Advancing to target timestamp for registration: ${targetTimestampForRegistration}`);

        const currentActualBlockTime = (await provider.getBlock('latest')).timestamp;
        console.log(`DEBUG: Main beforeEach for session ${sessionId}: Current EVM time BEFORE setting: ${currentActualBlockTime}, Target to set: ${targetTimestampForRegistration}`);

        if (targetTimestampForRegistration > currentActualBlockTime) {
            await provider.send('evm_setNextBlockTimestamp', [targetTimestampForRegistration]);
            await provider.send('evm_mine', []); 
        } else {
            console.warn(`WARN: Main beforeEach for session ${sessionId}: Target registration time ${targetTimestampForRegistration} is NOT GREATER than current EVM time ${currentActualBlockTime}. SKIPPING evm_setNextBlockTimestamp. This test group might fail due to incorrect timing setup from previous tests.`);
            // Ideally, we'd use evm_revert to a snapshot here if this becomes a persistent issue.
        }

        // const newBlockTime = Math.floor((await provider.getBlock('latest')).timestamp);
        // console.log(`DEBUG: New block time after advance: ${newBlockTime}`);

        // Debug check immediately after time travel
        // const regOpenDebug = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
        // console.log(`DEBUG: isRegistrationOpen immediately after evm_setNextBlockTimestamp to ${targetTimestampForRegistration}? ${regOpenDebug}`);

        // Register userSigner as a holder for these tests
        blsKeys = generateBLSKeyPair();
        blockchainProviderService.setSigner(userSigner);
        participantAddress = await userSigner.getAddress();
        try {
            await registryParticipantService.registerAsHolder(sessionId, blsKeys.pk.toHex());
        } catch (e) {
            console.error("ERROR in main beforeEach trying to registerAsHolder:", e);
            // This registration is critical, if it fails, many tests will be invalid.
            // Consider re-checking isRegistrationOpen from voteSessionViewService if debugging
            const regOpen = await voteSessionViewService.isRegistrationOpen(voteSessionAddress);
            console.error(`Is registration open for session ${sessionId} after time advance? ${regOpen}`);
            throw e; // Re-throw to fail the hook clearly if registration fails
        }
    }, 30000); // Increased timeout for this main beforeEach hook

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('castEncryptedVote', () => {
        it('should allow a registered holder to cast a vote during voting period', async () => {
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            
            // Advance time to make the voting period active
            let timeToAdvanceToVotingPeriod = sessionParams.startDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60; // 60s into period
            if (timeToAdvanceToVotingPeriod > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToVotingPeriod]);
                await provider.send('evm_mine', []);
            }

            // Parameters aligned with contract: (bytes memory ciphertext, bytes memory g1r, bytes memory g2r, bytes[] memory alpha, uint256 threshold)
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
            // Ensure time is past endDate
            let timeToAdvancePastVoting = sessionParams.endDate - Math.floor((await provider.getBlock('latest')).timestamp) + 120; // 120s after end
            if (timeToAdvancePastVoting <= 0) { // If already past, advance by a fixed small amount to ensure state
                 timeToAdvancePastVoting = 120;
            }
            await provider.send('evm_increaseTime', [timeToAdvancePastVoting]);
            await provider.send('evm_mine', []);
            
            blockchainProviderService.setSigner(userSigner);
            // Provide dummy valid-format params for the service call, actual values don't matter as it should revert on period check
            const ciphertext = ethers.toUtf8Bytes("vote");
            const g1r = ethers.toUtf8Bytes("g1r");
            const g2r = ethers.toUtf8Bytes("g2r");
            const alpha = [];
            const threshold = 2n;

            await expect(voteSessionVotingService.castEncryptedVote(voteSessionAddress, ciphertext, g1r, g2r, alpha, threshold))
                .rejects
                .toThrow(/Session: Voting not open/i);
        }, 60000);
    });

    describe('submitDecryptionShare', () => {
        beforeEach(async () => {
            // Common setup for share submission: cast a vote first
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            let timeToAdvanceToVotingPeriod = sessionParams.startDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60;
            if (timeToAdvanceToVotingPeriod > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToVotingPeriod]);
                await provider.send('evm_mine', []);
            }
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
            
            // Advance time to shares collection period (after endDate, before sharesEndDate)
            let timeToAdvanceToSharesPeriod = sessionParams.endDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60; // 60s into period
            if (timeToAdvanceToSharesPeriod > 0) {
                await provider.send('evm_increaseTime', [timeToAdvanceToSharesPeriod]);
                await provider.send('evm_mine', []);
            }

            const voteIndex = 0; // Assuming first vote cast by this user, or global first vote
            const shareIndex = 0; // Assuming this is the first (and only) share for this holder for this voteIndex
            const shareData = ethers.toUtf8Bytes("mock_decryption_share_g2_point_bytes");
            
            blockchainProviderService.setSigner(userSigner);
            const txReceipt = await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, voteIndex, shareData, shareIndex);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            const eventInterface = new ethers.Interface(VoteSessionABI);
            const shareSubmittedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'DecryptionShareSubmitted');
            
            expect(shareSubmittedEvent).toBeDefined();
            expect(shareSubmittedEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(shareSubmittedEvent.args.holder).toBe(participantAddress);
            expect(shareSubmittedEvent.args.voteIndex).toBe(BigInt(voteIndex));
            expect(shareSubmittedEvent.args.shareIndex).toBe(BigInt(shareIndex));
            expect(shareSubmittedEvent.args.share).toBe(ethers.hexlify(shareData));
        }, 70000);

        it('should prevent submitting share if not shares collection period', async () => {
            const { voteSessionAddress, sessionParams } = testVotingContext;
            // Ensure we are past sharesEndDate
            let timeToAdvancePastShares = sessionParams.sharesEndDate - Math.floor((await provider.getBlock('latest')).timestamp) + 120;
             if (timeToAdvancePastShares <= 0) { 
                timeToAdvancePastShares = 120;
            }
            await provider.send('evm_increaseTime', [timeToAdvancePastShares]);
            await provider.send('evm_mine', []);

            blockchainProviderService.setSigner(userSigner);
            await expect(voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, ethers.toUtf8Bytes("share"), 0))
                .rejects
                .toThrow(/Session: Share collection not open/i);
        }, 60000);
    });

    describe('submitDecryptionValue', () => {
        beforeEach(async () => {
            // Common setup: cast vote, advance to shares period, submit share
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            let timeToAdvanceToVoting = sessionParams.startDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60;
            if (timeToAdvanceToVoting > 0) { await provider.send('evm_increaseTime', [timeToAdvanceToVoting]); await provider.send('evm_mine', []); }
            
            blockchainProviderService.setSigner(userSigner);
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, ethers.toUtf8Bytes("vote_for_value"), ethers.toUtf8Bytes("g1r_val"), ethers.toUtf8Bytes("g2r_val"), [], BigInt(sessionParams.minShareThreshold));
            
            let timeToAdvanceToShares = sessionParams.endDate - Math.floor((await provider.getBlock('latest')).timestamp) + 60;
            if (timeToAdvanceToShares > 0) { await provider.send('evm_increaseTime', [timeToAdvanceToShares]); await provider.send('evm_mine', []); }
            
            await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, ethers.toUtf8Bytes("share_for_value"), 0);
        });

        it('should allow a holder to submit a decryption value if shares were submitted', async () => {
            const { voteSessionAddress, sessionId, sessionParams } = testVotingContext;
            // Shares collection period should still be active from beforeEach

            const valueToSubmit = ethers.keccak256(ethers.toUtf8Bytes("mock_sk_hash_for_decryption_value"));
            
            blockchainProviderService.setSigner(userSigner);
            const txReceipt = await voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueToSubmit);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            const eventInterface = new ethers.Interface(VoteSessionABI);
            const valueSubmittedEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'DecryptionValueSubmitted');
            
            expect(valueSubmittedEvent).toBeDefined();
            expect(valueSubmittedEvent.args.sessionId).toBe(BigInt(sessionId));
            expect(valueSubmittedEvent.args.holder).toBe(participantAddress);
            // expect(valueSubmittedEvent.args.index).toBe(BigInt(expected_participant_registry_index_after_share_submission)); // This index is tricky
            expect(valueSubmittedEvent.args.value).toBe(valueToSubmit);
        }, 80000);

        it('should prevent submitting value if shares were not submitted (test by trying with another user)', async () => {
            const { voteSessionAddress, sessionParams } = testVotingContext;
            const anotherHolderSigner = anotherUserSigner; // Assuming anotherUserSigner is in setup.js and registered
            const anotherHolderAddress = await anotherUserSigner.getAddress();
            
            // Register anotherUserSigner as a holder but they WONT submit shares
            blockchainProviderService.setSigner(deployerSigner); // Admin to register them quickly
            const { pk: otherPk } = generateBLSKeyPair();
            await registryParticipantService.registerAsHolder(testVotingContext.sessionId, otherPk.toHex(), {signer: anotherUserSigner}); // Special call with signer

            // Ensure shares collection period is active (it should be from outer beforeEach and submitDecryptionShare's beforeEach)
            const valueToSubmit = ethers.keccak256(ethers.toUtf8Bytes("value_for_non_submitter"));
            blockchainProviderService.setSigner(anotherUserSigner);

            await expect(voteSessionVotingService.submitDecryptionValue(voteSessionAddress, valueToSubmit))
                .rejects
                .toThrow(/Shares not submitted by this participant/i); // Or specific contract revert
        }, 70000);
    });
}); 
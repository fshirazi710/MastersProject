import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { ethers } from 'ethers';

// Services
import { voteSessionAdminService } from '../../services/contracts/voteSessionAdminService.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { voteSessionViewService } from '../../services/contracts/voteSessionViewService.js'; // Likely needed for verification
import { registryFundService } from '../../services/contracts/registryFundService.js'; // Added for funding
import { registryParticipantService } from '../../services/contracts/registryParticipantService.js'; // For holder registration
import { voteSessionVotingService } from '../../services/contracts/voteSessionVotingService.js'; // For voting and share submission

// Utilities & Setup
import { provider, deployerSigner, userSigner, anotherUserSigner } from '../setup.js';

// Import ABI directly
import VoteSessionABI_File from '../../../crypto-core/artifacts/contracts/VoteSession.sol/VoteSession.json';
const VoteSessionABI = VoteSessionABI_File.abi;

async function deploySessionForVoteAdminTests(customParams = {}) {
    blockchainProviderService.setSigner(deployerSigner);
    const latestBlock = await provider.getBlock('latest');
    const now = latestBlock.timestamp;
    const ONE_HOUR = 3600;
    const ONE_DAY = 24 * ONE_HOUR;

    const defaultSessionParams = {
        title: "Vote Admin Test Session",
        description: "Session for testing VoteSessionAdminService",
        options: ["VoteAdminOpt A", "VoteAdminOpt B"],
        startDate: now + ONE_HOUR, 
        endDate: now + ONE_HOUR + ONE_DAY, 
        sharesEndDate: now + ONE_HOUR + ONE_DAY + ONE_HOUR, 
        requiredDeposit: ethers.parseEther("0.01"),
        minShareThreshold: 2, // Defaulting to 2
        metadata: "vote-admin-test"
    };
    const sessionParams = { ...defaultSessionParams, ...customParams };
    const deployedInfo = await factoryService.createVoteSession(sessionParams);
    console.log(`Deployed session for vote admin test - ID: ${deployedInfo.sessionId}`);
    return {
        sessionId: deployedInfo.sessionId,
        registryAddress: deployedInfo.participantRegistryContract,
        voteSessionAddress: deployedInfo.voteSessionContract,
        initialDepositRequired: sessionParams.requiredDeposit,
        sessionParams // return sessionParams for date checks
    };
}

describe('VoteSessionAdminService', () => {
    let originalVoteAdminTestContext; // To hold deployed session info from beforeAll
    let snapshotId; // Store snapshot ID from beforeAll
    let testContext; // Per-test context, reset from originalVoteAdminTestContext

    beforeAll(async () => {
        blockchainProviderService.setSigner(deployerSigner); // Set signer for deployment
        originalVoteAdminTestContext = await deploySessionForVoteAdminTests();
        snapshotId = await provider.send('evm_snapshot', []); // Snapshot the state after deployment
    }, 60000); // Longer timeout for initial deployment

    beforeEach(async () => {
        await provider.send('evm_revert', [snapshotId]); // Revert to the clean deployed state
        // Take a new snapshot for isolating the current test (and update snapshotId for the next revert)
        snapshotId = await provider.send('evm_snapshot', []); 
        testContext = originalVoteAdminTestContext; // Reuse the deployed context addresses/IDs
        blockchainProviderService.setSigner(deployerSigner); // Reset default signer for consistency
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('transferSessionOwnership', () => {
        it('should allow the current owner to transfer session ownership', async () => {
            const { voteSessionAddress } = testContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();
            const originalOwnerAddress = await deployerSigner.getAddress(); // Deployer is initial owner

            blockchainProviderService.setSigner(deployerSigner); 
            const txReceipt = await voteSessionAdminService.transferSessionOwnership(voteSessionAddress, newOwnerAddress);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify OwnershipTransferred event from VoteSession contract
            const eventInterface = new ethers.Interface(VoteSessionABI);
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
            const { voteSessionAddress } = testContext;
            const newOwnerAddress = await anotherUserSigner.getAddress();

            blockchainProviderService.setSigner(userSigner); // Non-owner
            await expect(voteSessionAdminService.transferSessionOwnership(voteSessionAddress, newOwnerAddress))
                .rejects
                .toThrow(/OwnableUnauthorizedAccount/i);
        }, 60000);
    });

    describe('setDecryptionParameters', () => {
        it('should allow the owner to set valid decryption parameters', async () => {
            const { voteSessionAddress } = testContext;
            const mockAlphasBytes = [
                ethers.randomBytes(32),
                ethers.randomBytes(32),
            ];
            const mockAlphasHex = mockAlphasBytes.map(a => ethers.hexlify(a)); // Convert to hex
            const mockThreshold = 2n; // Use BigInt for uint256

            blockchainProviderService.setSigner(deployerSigner); // Ensure owner
            const txReceipt = await voteSessionAdminService.setDecryptionParameters(
                voteSessionAddress,
                mockAlphasHex, // Pass hex strings
                mockThreshold
            );

            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Event check removed as contract does not emit DecryptionParametersSet
            // const eventInterface = new ethers.Interface(VoteSessionABI);
            // const event = txReceipt.logs
            //     .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
            //     .find(parsedLog => parsedLog && parsedLog.name === 'DecryptionParametersSet');
            // expect(event).toBeDefined();

            // Verify parameters stored on contract using view service
            const storedParams = await voteSessionViewService.getDecryptionParameters(voteSessionAddress);
            expect(storedParams).toBeDefined();
            expect(BigInt(storedParams.threshold)).toBe(mockThreshold); // Compare as BigInt
            // Compare hex strings directly
            expect(storedParams.alphas).toEqual(mockAlphasHex);

        }, 60000); // Increased timeout

        it('should prevent non-owner from setting decryption parameters', async () => {
            const { voteSessionAddress } = testContext;
            const mockAlphasBytes = [ethers.randomBytes(32)];
            const mockAlphasHex = mockAlphasBytes.map(a => ethers.hexlify(a)); // Convert to hex
            const mockThreshold = 2n;

            blockchainProviderService.setSigner(userSigner); // Non-owner
            await expect(voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphasHex, mockThreshold))
                .rejects
                .toThrow(/OwnableUnauthorizedAccount/i); // Use OZ5 error
        });

        it('should allow setting decryption parameters with threshold 1', async () => {
            const { voteSessionAddress } = testContext;
            const mockAlphasBytes = [ethers.randomBytes(32), ethers.randomBytes(32)];
            const mockAlphasHex = mockAlphasBytes.map(a => ethers.hexlify(a));
            
            blockchainProviderService.setSigner(deployerSigner);
            // Test with threshold 1 - should succeed as contract requires _threshold > 0
            const txReceipt = await voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphasHex, 1n);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify parameters stored
            const storedParams = await voteSessionViewService.getDecryptionParameters(voteSessionAddress);
            expect(BigInt(storedParams.threshold)).toBe(1n); // Compare as BigInt
            expect(storedParams.alphas).toEqual(mockAlphasHex);
        });

        it('should prevent setting decryption parameters with threshold 0', async () => {
            const { voteSessionAddress } = testContext;
            const mockAlphasBytes = [ethers.randomBytes(32), ethers.randomBytes(32)];
            const mockAlphasHex = mockAlphasBytes.map(a => ethers.hexlify(a));
            
            blockchainProviderService.setSigner(deployerSigner);
            // Test with threshold 0 - should fail due to service validation first
            await expect(voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphasHex, 0n))
                .rejects
                .toThrow(/VoteSessionAdminService: Invalid threshold provided. Expected a positive number or BigInt./i);
        });

        it('should prevent setting decryption parameters more than once', async () => {
            const { voteSessionAddress } = testContext;
            const mockAlphasBytes1 = [ethers.randomBytes(32), ethers.randomBytes(32)];
            const mockAlphasHex1 = mockAlphasBytes1.map(a => ethers.hexlify(a)); // Convert to hex
            const mockThreshold1 = 2n;
            const mockAlphasBytes2 = [ethers.randomBytes(32)];
            const mockAlphasHex2 = mockAlphasBytes2.map(a => ethers.hexlify(a)); // Convert to hex
            const mockThreshold2 = 3n;

            blockchainProviderService.setSigner(deployerSigner);
            // First call (should succeed)
            await voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphasHex1, mockThreshold1);

            // Second call (should fail)
            await expect(voteSessionAdminService.setDecryptionParameters(voteSessionAddress, mockAlphasHex2, mockThreshold2))
                .rejects
                .toThrow(/Session: Decryption parameters already set/i); // Updated to match actual contract error
        });
    });

    describe('updateSessionStatus', () => {
        it('should correctly update the session status based on time', async () => {
            const { voteSessionAddress, sessionParams } = testContext;
            const { startDate, endDate, sharesEndDate } = sessionParams;

            // Helper to get current status from view service
            const getCurrentStatus = async () => {
                const info = await voteSessionViewService.getSessionInfo(voteSessionAddress);
                return info.status; // This returns the string status like 'Created', 'VotingOpen'
            };

            // Updated SessionStatus Enum based on voteSessionViewService.js and contract logic
            const SessionStatus = { 
                Created: 'Created', 
                RegistrationOpen: 'RegistrationOpen',
                VotingOpen: 'VotingOpen', 
                SharesCollectionOpen: 'SharesCollectionOpen', 
                DecryptionOpen: 'DecryptionOpen', // Status after sharesEndDate before completion
                Completed: 'Completed', 
                Cancelled: 'Cancelled' 
            };

            let currentStatusString = await getCurrentStatus();
            // Initial status can be Created or RegistrationOpen
            expect([SessionStatus.Created, SessionStatus.RegistrationOpen]).toContain(currentStatusString);

            // Advance past startDate -> VotingOpen
            let blockTimestamp = (await provider.getBlock('latest')).timestamp;
            let timeToAdvance = startDate - blockTimestamp + 10; // 10s past start
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            currentStatusString = await getCurrentStatus();
            expect(currentStatusString).toBe(SessionStatus.VotingOpen);

            // Advance past endDate -> SharesCollectionOpen
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = endDate - blockTimestamp + 10; // 10s past end
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            currentStatusString = await getCurrentStatus();
            expect(currentStatusString).toBe(SessionStatus.SharesCollectionOpen);

            // Advance past sharesEndDate -> DecryptionOpen (as per service enum for state 4)
            blockTimestamp = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = sharesEndDate - blockTimestamp + 10; // 10s past shares end
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            currentStatusString = await getCurrentStatus();
            expect(currentStatusString).toBe(SessionStatus.DecryptionOpen);
        }, 70000); // Increase timeout for multiple time advancements
    });

    describe('triggerRewardCalculation (VoteSession context)', () => {
        it('should allow the owner to trigger reward calculation after shares collection ends', async () => {
            const { voteSessionAddress, sessionParams, sessionId, registryAddress, initialDepositRequired } = testContext;
            const { startDate, endDate, sharesEndDate } = sessionParams;
            const userSignerAddress = await userSigner.getAddress();
            let timeToAdvance; // Declare once with let
            let currentBlockTime; // Declare once with let

            // --- Participant actions to become eligible ---
            blockchainProviderService.setSigner(userSigner);
            console.log(`Test: Registering user ${userSignerAddress} as holder for session ${sessionId} at registry ${registryAddress}`);
            await registryParticipantService.registerAsHolder(sessionId, '0x01', { registryAddress, initialDepositRequired });

            console.log(`Test: Advancing time to voting period for session ${sessionId}`);
            currentBlockTime = (await provider.getBlock('latest')).timestamp;
            timeToAdvance = startDate - currentBlockTime + 60; // 60s into voting period
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            } else { // If already past startDate, ensure we are not past endDate
                expect(currentBlockTime).toBeLessThan(endDate);
            }
            
            console.log(`Test: User ${userSignerAddress} casting vote for session ${sessionId}`);
            await voteSessionVotingService.castEncryptedVote(
                voteSessionAddress,
                ethers.toUtf8Bytes("mockVoteData"), // ciphertext
                ethers.randomBytes(32),            // g1r
                ethers.randomBytes(64),            // g2r
                [],                                // alpha (assuming not used or empty for this basic vote)
                2n                                 // threshold (assuming a default or mock)
            );

            console.log(`Test: Advancing time to shares collection period for session ${sessionId}`);
            // currentBlockTime = (await provider.getBlock('latest')).timestamp; // No longer needed for relative jump
            // timeToAdvance = endDate - currentBlockTime + 60; // No longer needed for relative jump
            // if (timeToAdvance > 0) { // No longer needed for relative jump
            //     await provider.send('evm_increaseTime', [timeToAdvance]);
            //     await provider.send('evm_mine', []);
            // } else { // If already past endDate, ensure we are not past sharesEndDate
            //      expect(currentBlockTime).toBeLessThan(sharesEndDate);
            // }

            // Use absolute timestamp to land in the middle of SharesCollectionOpen
            const targetSharesCollectionTime = endDate + 60; // 60 seconds into SharesCollectionOpen
            console.log(`Test: Setting next block timestamp to: ${targetSharesCollectionTime} (endDate: ${endDate})`);
            await provider.send('evm_setNextBlockTimestamp', [targetSharesCollectionTime]);
            await provider.send('evm_mine', []); // Mine a block at the new timestamp

            // Explicitly update status and check
            console.log(`Test: Current block timestamp after advancing to shares collection period: ${(await provider.getBlock('latest')).timestamp}`);
            console.log(`Test: Configured session endDate: ${endDate}, sharesEndDate: ${sharesEndDate}`);
            
            blockchainProviderService.setSigner(deployerSigner); // Owner can call updateStatus
            console.log("Test: Explicitly calling updateSessionStatus via admin service before share submission...");
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            blockchainProviderService.setSigner(userSigner); // Switch back to user for share submission

            const statusAfterExplicitUpdate = await voteSessionViewService.getStatus(voteSessionAddress);
            console.log(`Test: Status after explicit updateSessionStatus (before share submission): ${statusAfterExplicitUpdate}`);
            expect(statusAfterExplicitUpdate).toBe('SharesCollectionOpen'); // Assert status

            console.log(`Test: User ${userSignerAddress} submitting decryption share for session ${sessionId}`);
            // Signer is already userSigner (from the switch above)
            await voteSessionVotingService.submitDecryptionShare(voteSessionAddress, 0, ethers.randomBytes(32), 0);
            // --- End of participant actions ---

            // Fund the reward pool first
            blockchainProviderService.setSigner(deployerSigner); // Switch back to deployer for admin actions
            const fundingAmount = ethers.parseEther("1.0");
            await registryFundService.addRewardFunding(sessionId, fundingAmount, { registryAddress });
            console.log(`Test: Added ${ethers.formatEther(fundingAmount)} ETH to reward pool for session ${sessionId} at registry ${registryAddress}`);

            // Advance time past sharesEndDate
            currentBlockTime = (await provider.getBlock('latest')).timestamp; // Reuse variable
            timeToAdvance = sharesEndDate - currentBlockTime + 10; // 10s past shares end, reuse variable
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }

            // Update status to ensure it's DecryptionOpen
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            let status = await voteSessionViewService.getStatus(voteSessionAddress);
            expect(status).toBe('DecryptionOpen'); // Status should be DecryptionOpen (4)

            blockchainProviderService.setSigner(deployerSigner); // Ensure owner
            const txReceipt = await voteSessionAdminService.triggerRewardCalculation(voteSessionAddress);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify RewardsCalculationTriggered event
            const eventInterface = new ethers.Interface(VoteSessionABI);
            const rewardsTriggeredEvent = txReceipt.logs
                .map(log => { try { return eventInterface.parseLog(log); } catch (e) { return null; } })
                .find(parsedLog => parsedLog && parsedLog.name === 'RewardsCalculationTriggered');
            expect(rewardsTriggeredEvent).toBeDefined();
            expect(rewardsTriggeredEvent.args.triggerer).toBe(await deployerSigner.getAddress());

            // Verify SessionStatusChanged event to Completed (Re-added for debugging)
            const allParsedLogs = txReceipt.logs.map(log => {
                try {
                    const parsed = eventInterface.parseLog(log);
                    if (parsed && parsed.name === 'SessionStatusChanged') {
                        console.log('Found SessionStatusChanged event in triggerRewardCalculation tx:', {
                            name: parsed.name,
                            sessionId: parsed.args.sessionId ? parsed.args.sessionId.toString() : 'N/A',
                            oldStatus_raw: parsed.args.oldStatus,
                            oldStatus_type: typeof parsed.args.oldStatus,
                            oldStatus_str: parsed.args.oldStatus !== undefined ? parsed.args.oldStatus.toString() : 'N/A',
                            newStatus_raw: parsed.args.newStatus,
                            newStatus_type: typeof parsed.args.newStatus,
                            newStatus_str: parsed.args.newStatus !== undefined ? parsed.args.newStatus.toString() : 'N/A'
                        });
                    }
                    return parsed;
                } catch (e) {
                    // console.warn('Could not parse a log:', e.message); // Optional: for very deep debugging
                    return null;
                }
            });

            const statusChangedEvent = allParsedLogs
                .find(parsedLog => {
                    if (parsedLog && parsedLog.name === 'SessionStatusChanged') {
                        // Temporary stricter log for the specific condition we're interested in
                        console.log('Checking log for find:', {
                            name: parsedLog.name,
                            newStatus_raw: parsedLog.args.newStatus,
                            newStatus_type: typeof parsedLog.args.newStatus,
                            newStatus_str: parsedLog.args.newStatus !== undefined ? parsedLog.args.newStatus.toString() : 'N/A',
                            conditionMet: parsedLog.args.newStatus !== undefined && BigInt(parsedLog.args.newStatus) === 5n
                        });
                        return parsedLog.args.newStatus !== undefined && BigInt(parsedLog.args.newStatus) === 5n;
                    }
                    return false;
                });
            expect(statusChangedEvent).toBeDefined("SessionStatusChanged to Completed (5) event not found");

            // Verify contract state: rewardsCalculatedTriggered should be true
            const contractInstance = voteSessionAdminService._getContractInstance(voteSessionAddress, false);
            expect(await contractInstance.rewardsCalculatedTriggered()).toBe(true);
            
            // Verify status is now Completed via view service as final check
            const finalStatus = await voteSessionViewService.getStatus(voteSessionAddress);
            expect(finalStatus).toBe('Completed');

            // Calling a second time should fail with the more specific error now
            await expect(voteSessionAdminService.triggerRewardCalculation(voteSessionAddress))
                .rejects
                .toThrow(/Session: Rewards already calculated/i); 
        }, 70000); 

        it('should prevent triggering reward calculation before shares collection ends', async () => {
            const { voteSessionAddress, sessionParams, sessionId, registryAddress, initialDepositRequired } = testContext;
            const { startDate, endDate, sharesEndDate } = sessionParams;
            const userSignerAddress = await userSigner.getAddress();
            // let timeToAdvance; // Not needed if setting to specific timestamp
            // let currentBlockTime; // Not needed if setting to specific timestamp

            // --- Participant actions (simplified for this test's focus) ---
            blockchainProviderService.setSigner(userSigner);
            await registryParticipantService.registerAsHolder(sessionId, '0x01', { registryAddress, initialDepositRequired });
            // Vote casting is not strictly necessary if we are only testing the period for triggerRewardCalculation
            // but let's keep it for consistency with a holder who would intend to participate.
            let currentBlockTimeForVote = (await provider.getBlock('latest')).timestamp;
            if (currentBlockTimeForVote < startDate) {
                await provider.send('evm_setNextBlockTimestamp', [startDate + 60]);
                await provider.send('evm_mine', []);
            }
            await voteSessionVotingService.castEncryptedVote(voteSessionAddress, ethers.toUtf8Bytes("mockVote"), ethers.randomBytes(32), ethers.randomBytes(64), [], 2n);
            // --- End of participant actions ---

            // Explicitly set time to midway through SharesCollectionOpen period
            const midSharesCollectionTime = endDate + Math.floor((sharesEndDate - endDate) / 2);
            const currentBlockTimestamp = (await provider.getBlock('latest')).timestamp;
            if (midSharesCollectionTime > currentBlockTimestamp) {
                console.log(`Test (early trigger): Advancing time to ${midSharesCollectionTime} (mid SharesCollectionOpen)`);
                await provider.send('evm_setNextBlockTimestamp', [midSharesCollectionTime]);
                await provider.send('evm_mine', []);
            } else {
                console.warn(`Test (early trigger): midSharesCollectionTime (${midSharesCollectionTime}) is not in the future. Current: ${currentBlockTimestamp}. Skipping advancement.`);
                // This might happen if session durations are very short or tests run slow
                // For a robust test, ensure endDate and sharesEndDate are sufficiently apart.
                // If already past mid-point but before sharesEndDate, that's also fine for this test.
                if (currentBlockTimestamp >= sharesEndDate) {
                    console.error("Test (early trigger): Current time is already past sharesEndDate. Cannot test 'too early' scenario properly.");
                    return; // Exit test if timing is completely off
                }
            }
            
            // Fund the reward pool 
            blockchainProviderService.setSigner(deployerSigner);
            const fundingAmount = ethers.parseEther("0.5");
            await registryFundService.addRewardFunding(sessionId, fundingAmount, { registryAddress });

            await voteSessionAdminService.updateSessionStatus(voteSessionAddress);
            const status = await voteSessionViewService.getStatus(voteSessionAddress);
            console.log(`Test (early trigger): Status after advancing to mid-shares collection: ${status}`);
            expect(status).toBe('SharesCollectionOpen'); // Should be exactly this status

            blockchainProviderService.setSigner(deployerSigner);
            await expect(voteSessionAdminService.triggerRewardCalculation(voteSessionAddress))
                .rejects
                .toThrow(/Session: Not DecryptionOpen/i); // Updated to match the contract require statement
        }, 70000);

        it('should prevent non-owner from triggering reward calculation', async () => {
            const { voteSessionAddress, sessionParams } = testContext;
            const { sharesEndDate } = sessionParams;

            // Advance time past shares collection end date
            const blockTimestamp = (await provider.getBlock('latest')).timestamp;
            const timeToAdvance = sharesEndDate - blockTimestamp + 10; 
            if (timeToAdvance > 0) {
                await provider.send('evm_increaseTime', [timeToAdvance]);
                await provider.send('evm_mine', []);
            }
            await voteSessionAdminService.updateSessionStatus(voteSessionAddress); // Update to Completed

            blockchainProviderService.setSigner(userSigner); // Non-owner
            await expect(voteSessionAdminService.triggerRewardCalculation(voteSessionAddress))
                .rejects
                .toThrow(/OwnableUnauthorizedAccount/i); // Use OZ5 error
        });
    });
}); 
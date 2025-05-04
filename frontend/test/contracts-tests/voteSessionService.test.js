import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ethers } from 'ethers';
import { voteSessionService } from '../../services/contracts/voteSessionService.js';
import { registryService } from '../../services/contracts/registryService.js';
import { ethersBaseService } from '../../services/contracts/ethersBase.js';
import { provider, userSigner, deployerSigner, DEPLOYED_FACTORY_ADDRESS } from '../setup.js';
import { factoryService } from '../../services/contracts/factoryService.js';
import { generateBLSKeyPair } from '../../services/utils/cryptographyUtils.js';

describe('VoteSessionService', () => {
    let sessionId;
    let sessionAddress;
    let registryAddress;
    let sessionParams;

    beforeEach(async () => {
        // Configure base service (using deployer for setup)
        ethersBaseService.provider = provider;
        ethersBaseService.signer = deployerSigner;
        ethersBaseService.factoryAddress = DEPLOYED_FACTORY_ADDRESS;
        ethersBaseService.isConnected = true;
        ethersBaseService.account = await deployerSigner.getAddress();

        // Define and deploy session
        sessionParams = {
            title: "Vote Session Test",
            description: "Testing VoteSessionService",
            options: ["Option 1", "Option 2", "Option 3"],
            requiredDeposit: ethers.parseEther("0.01"),
            minShareThreshold: 1,
            startDate: Math.floor(Date.now() / 1000) - 300,
            endDate: Math.floor(Date.now() / 1000) + 3600,
            sharesEndDate: Math.floor(Date.now() / 1000) + 7200
        };
        const txReceipt = await factoryService.createNewVoteSession(
            sessionParams.title,
            sessionParams.description,
            sessionParams.startDate,
            sessionParams.endDate,
            sessionParams.sharesEndDate,
            sessionParams.options,
            sessionParams.requiredDeposit,
            sessionParams.minShareThreshold
        );
        const createdEvent = txReceipt.logs.find(log => log.eventName === 'SessionCreated');
        if (!createdEvent) throw new Error("SessionCreated event not found");

        sessionId = Number(createdEvent.args.sessionId);
        sessionAddress = createdEvent.args.sessionAddress;
        registryAddress = createdEvent.args.registryAddress;
    });

    afterEach(() => {
        ethersBaseService.setSigner(deployerSigner); // Ensure reset
    });

    it('should retrieve the correct session info', async () => {
        const info = await voteSessionService.getSessionInfo(sessionId);

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
        // Check status (should likely be Active or similar enum value)
        // Adjust expected value based on your contract's SessionStatus enum
        expect(info.sessionStatus).toBe(1); // Assuming 1 corresponds to Active/VotingOpen
    });

    it('should return null info for a non-existent session ID', async () => {
        const info = await voteSessionService.getSessionInfo(999999);
        expect(info).toBeNull();
    });

    // --- Tests requiring prior registration --- 
    describe('Actions requiring registration', () => {
        let userAddress;
        let blsKeys;

        beforeEach(async () => {
            // This block now assumes ethersBaseService is already configured
            // Register the userSigner before tests in this block
            blsKeys = generateBLSKeyPair();
            ethersBaseService.setSigner(userSigner); // Set signer for registration
            userAddress = await userSigner.getAddress();
            await registryService.registerParticipant(sessionId, blsKeys.pk.x, blsKeys.pk.y);
            // Keep signer as userSigner for subsequent actions unless changed in test
        });

        it('should cast a vote (with placeholder proof/nullifier)', async () => {
            const encryptedVote = ethers.toUtf8Bytes("placeholder_encrypted_vote"); // Placeholder
            const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes(`nullifier_${userAddress}_${sessionId}`)); // Placeholder
            const proof = { // Placeholder ZKP
                a: ['0x01', '0x02'],
                b: [['0x03', '0x04'], ['0x05', '0x06']],
                c: ['0x07', '0x08']
            };

            ethersBaseService.setSigner(userSigner); // Ensure signer is user

            const txReceipt = await voteSessionService.castVote(sessionId, encryptedVote, nullifierHash, proof);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify VoteCast event (assuming it exists in VoteSession)
            const voteCastEvent = txReceipt.logs.find(log => log.eventName === 'VoteCast');
            expect(voteCastEvent).toBeDefined();
            expect(voteCastEvent.args.voter).toBe(userAddress);
            expect(voteCastEvent.args.encryptedVote).toBe(ethers.hexlify(encryptedVote));
            expect(voteCastEvent.args.nullifierHash).toBe(nullifierHash);
            
            // Check number of votes increased
            const voteCount = await voteSessionService.getNumberOfVotes(sessionId);
            expect(voteCount).toBe(1);

            // Check retrieving the vote
            const retrievedVote = await voteSessionService.getEncryptedVote(sessionId, 0);
            expect(retrievedVote).toBe(ethers.hexlify(encryptedVote));

        }, 60000);

        it('should submit shares (with placeholder shares)', async () => {
            // Placeholder: Real shares would be G2 points (bytes)
            const shares = [ethers.toUtf8Bytes("share1"), ethers.toUtf8Bytes("share2")]; 
            
            ethersBaseService.setSigner(userSigner);

            // TODO: Advance time in Hardhat past endDate but before sharesEndDate
            // await provider.send('evm_increaseTime', [3700]); // Increase time by 1hr + 100s
            // await provider.send('evm_mine', []);

            const txReceipt = await voteSessionService.submitShares(sessionId, shares);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);

            // Verify SharesSubmitted event (assuming it exists)
            const sharesSubmittedEvent = txReceipt.logs.find(log => log.eventName === 'SharesSubmitted');
            expect(sharesSubmittedEvent).toBeDefined();
            expect(sharesSubmittedEvent.args.participant).toBe(userAddress);
            expect(sharesSubmittedEvent.args.shares).toEqual(shares.map(s => ethers.hexlify(s))); // Compare hex
            
            // Check number of shares
            const shareCount = await voteSessionService.getNumberOfShares(sessionId);
            expect(shareCount).toBe(shares.length);
            
             // Check retrieving shares
            const retrievedShare = await voteSessionService.getDecryptionShare(sessionId, 0);
            expect(retrievedShare).toBe(ethers.hexlify(shares[0]));

        }, 60000);

        it('should submit decryption value (with placeholder value)', async () => {
            // Placeholder: Real value would be G1 point (bytes)
            const decryptionValue = ethers.toUtf8Bytes("decryption_value_g1"); 
            
            ethersBaseService.setSigner(userSigner);

            // TODO: Advance time past sharesEndDate if required by contract logic
            // await provider.send('evm_increaseTime', [7300]); // Increase time past shares end
            // await provider.send('evm_mine', []);

            const txReceipt = await voteSessionService.submitDecryptionValue(sessionId, decryptionValue);
            expect(txReceipt).toBeDefined();
            expect(txReceipt.status).toBe(1);
            
            // Verify DecryptionValueSubmitted event (assuming it exists)
            const valueSubmittedEvent = txReceipt.logs.find(log => log.eventName === 'DecryptionValueSubmitted');
            expect(valueSubmittedEvent).toBeDefined();
            expect(valueSubmittedEvent.args.participant).toBe(userAddress);
            expect(valueSubmittedEvent.args.value).toBe(ethers.hexlify(decryptionValue));
        }, 60000);

        // TODO: Add tests for failure cases (voting twice, submitting shares too early/late, etc.)
        // TODO: Add tests for getVoteRoundParameters (g1r, g2r) - check contract for function name
    });
}); 
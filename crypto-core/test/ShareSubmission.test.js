const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("Share Submission Period Tests", function () {
    // Load common fixture
    async function setup() {
        return await loadFixture(deployVoteSessionFixture);
    }

    // Destructure common variables
    let voteSession, registry, owner, addr1, addr2, addr3, addrs;
    let sessionId, requiredDeposit, minShareThreshold, startTime, endTime, sharesEndTime;

    beforeEach(async function () {
        const deployed = await setup();
        voteSession = deployed.voteSession;
        registry = deployed.registry;
        owner = deployed.owner;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
        addr3 = deployed.addr3;
        addrs = deployed.addrs;
        sessionId = deployed.sessionId;
        requiredDeposit = deployed.requiredDeposit;
        minShareThreshold = deployed.minShareThreshold;
        startTime = deployed.startTime;
        endTime = deployed.endTime;
        sharesEndTime = deployed.sharesEndTime;
    });

    // === Share Submission Tests (Copied from original file) ===
    describe("Share Submission Functionality", function () {
        // Nested beforeEach specific to these share submission tests
         beforeEach(async function() {
            // Pre-register holders and cast a vote
            await registry.connect(addr1).joinAsHolder(sessionId, "0xBLS1", { value: requiredDeposit });
            await registry.connect(addr2).joinAsHolder(sessionId, "0xBLS2", { value: requiredDeposit });
            await registry.connect(addr3).joinAsHolder(sessionId, "0xBLS3", { value: requiredDeposit });

            await time.increaseTo(startTime + 1);
            // addr1 casts a vote that needs decrypting
             const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("VoteCipher"));
             await voteSession.connect(addr1).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold);
        });

        it("Should fail share submission before shares collection period opens", async function () {
            // Action: Try submitting shares during voting period
             // Assert: Reverts
             const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
             await expect(voteSession.connect(addr2).submitDecryptionShare(0, dummyShare, 0))
                 .to.be.revertedWith("Session: Share collection not open");
        });

        it("Should allow holders to submit shares during the correct period", async function () {
             // Action: Increase time to shares collection period
             await time.increaseTo(endTime + 1);
             // Action: addr2 submits share for vote 0
             const shareData2 = ethers.hexlify(ethers.toUtf8Bytes("ShareData2"));
             await expect(voteSession.connect(addr2).submitDecryptionShare(0, shareData2, 0))
                .to.emit(voteSession, "DecryptionShareSubmitted");
             // Assert: Registry should now show addr2 has submitted
             const holderInfo2 = await registry.getParticipantInfo(sessionId, addr2.address);
             expect(holderInfo2.hasSubmittedShares).to.be.true;

             // Action: addr3 submits share for vote 0
             const shareData3 = ethers.hexlify(ethers.toUtf8Bytes("ShareData3"));
              await expect(voteSession.connect(addr3).submitDecryptionShare(0, shareData3, 1))
                 .to.emit(voteSession, "DecryptionShareSubmitted");
             const holderInfo3 = await registry.getParticipantInfo(sessionId, addr3.address);
             expect(holderInfo3.hasSubmittedShares).to.be.true;

             expect(await voteSession.getNumberOfDecryptionShares()).to.equal(2);
        });

        it("Should fail share submission if not an active holder", async function () {
            await time.increaseTo(endTime + 1);
            // Action: addr4 (not registered) tries to submit
            // Assert: Reverts
            const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
            await expect(voteSession.connect(addrs[0]).submitDecryptionShare(0, dummyShare, 0))
                .to.be.revertedWith("Session: Not a registered holder");
        });

         it("Should fail share submission if shares already submitted", async function () {
            await time.increaseTo(endTime + 1);
            const shareData2 = ethers.hexlify(ethers.toUtf8Bytes("ShareData2"));
            await voteSession.connect(addr2).submitDecryptionShare(0, shareData2, 0);
            // Action: addr2 tries to submit again
            // Assert: Reverts
            await expect(voteSession.connect(addr2).submitDecryptionShare(0, shareData2, 0))
                .to.be.revertedWith("Registry: Shares already recorded");
        });

        it("Should fail share submission after shares collection period ends", async function () {
             // Action: Increase time past shares collection end
             await time.increaseTo(sharesEndTime + 1);
             // Action: addr2 tries to submit
             // Assert: Reverts
             const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
              await expect(voteSession.connect(addr2).submitDecryptionShare(0, dummyShare, 0))
                 .to.be.revertedWith("Session: Share collection not open");
        });
    });
}); 
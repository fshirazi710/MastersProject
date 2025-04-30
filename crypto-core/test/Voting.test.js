const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("Voting Period Tests", function () {
    // Load common fixture
    async function setup() {
        return await loadFixture(deployVoteSessionFixture);
    }

    // Destructure common variables used across tests
    let voteSession, registry, owner, addr1, addr2, addr3, addrs;
    let sessionId, requiredDeposit, minShareThreshold, startTime, endTime;

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
    });

    // === Voting Tests (Copied from original file) ===
     describe("Voting Period Functionality", function () {
        // Nested beforeEach specific to these voting tests
        beforeEach(async function() {
            // Pre-register users for voting tests
            await registry.connect(addr1).registerAsVoter(sessionId);
            await registry.connect(addr2).joinAsHolder(sessionId, "0xBLS2", { value: requiredDeposit });
        });

        it("Should fail voting before start time", async function () {
             // Action: addr1 tries to vote
             // Assert: Reverts because status is still RegistrationOpen/Created
             const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("dummy"));
             // Need to manually check status or time, fixture doesn't guarantee status
             await expect(voteSession.connect(addr1).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold))
                 .to.be.revertedWith("Session: Voting not open");
        });

        it("Should allow registered participants to vote during the voting period", async function () {
            // Action: Increase time to voting period
            await time.increaseTo(startTime + 1);
            // Action: addr1 (voter) votes
            const dummyBytes1 = ethers.hexlify(ethers.toUtf8Bytes("cipher1"));
            await expect(voteSession.connect(addr1).castEncryptedVote(dummyBytes1, dummyBytes1, dummyBytes1, [], minShareThreshold))
                .to.emit(voteSession, "EncryptedVoteCast");
            expect(await voteSession.hasVoted(addr1.address)).to.be.true;

             // Action: addr2 (holder) votes
             const dummyBytes2 = ethers.hexlify(ethers.toUtf8Bytes("cipher2"));
             await expect(voteSession.connect(addr2).castEncryptedVote(dummyBytes2, dummyBytes2, dummyBytes2, [], minShareThreshold))
                 .to.emit(voteSession, "EncryptedVoteCast");
             expect(await voteSession.hasVoted(addr2.address)).to.be.true;
             expect(await voteSession.getNumberOfVotes()).to.equal(2);
        });

        it("Should fail voting if not registered", async function () {
            await time.increaseTo(startTime + 1);
             // Action: addr3 (unregistered) tries to vote
             // Assert: Reverts
             const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("dummy"));
            await expect(voteSession.connect(addr3).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold))
                .to.be.revertedWith("Session: Voter not registered"); // Check comes from registry via voteSession
        });

        it("Should fail voting if participant already voted", async function () {
            await time.increaseTo(startTime + 1);
            const dummyBytes1 = ethers.hexlify(ethers.toUtf8Bytes("cipher1"));
            await voteSession.connect(addr1).castEncryptedVote(dummyBytes1, dummyBytes1, dummyBytes1, [], minShareThreshold);
            // Action: addr1 tries to vote again
            // Assert: Reverts
            const dummyBytes2 = ethers.hexlify(ethers.toUtf8Bytes("cipher2"));
            await expect(voteSession.connect(addr1).castEncryptedVote(dummyBytes2, dummyBytes2, dummyBytes2, [], minShareThreshold))
                .to.be.revertedWith("Session: Already voted");
        });

        it("Should fail voting after end time", async function () {
            // Action: Increase time past voting end
            await time.increaseTo(endTime + 1);
            // Action: addr1 tries to vote
            // Assert: Reverts
            const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("dummy"));
            await expect(voteSession.connect(addr1).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold))
                .to.be.revertedWith("Session: Voting not open"); // Status would have changed
        });
    });
}); 
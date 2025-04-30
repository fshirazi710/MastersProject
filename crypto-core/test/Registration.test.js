const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("Participant Registration Tests", function () {
    // Load common fixture
    async function setup() {
        return await loadFixture(deployVoteSessionFixture);
    }

    // Destructure common variables used in tests
    let registry, owner, addr1, addr2, addrs;
    let sessionId, requiredDeposit, startTime;

    beforeEach(async function () {
        const deployed = await setup();
        registry = deployed.registry;
        owner = deployed.owner;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
        addrs = deployed.addrs;
        sessionId = deployed.sessionId;
        requiredDeposit = deployed.requiredDeposit;
        startTime = deployed.startTime; // Needed for time-based tests
    });

    // === Registration Tests (Copied from original file) ===
    describe("Participant Registration Functionality", function () {
        it("Should allow a user to register as a Holder with correct deposit", async function () {
            // Action: addr1 registers as holder
            // Assert: Event emitted, addr1 is active holder in registry, deposit recorded
             await expect(registry.connect(addr1).joinAsHolder(sessionId, "0xBLS_KEY_1", { value: requiredDeposit }))
                .to.emit(registry, "HolderRegistered")
                .withArgs(sessionId, addr1.address, requiredDeposit, "0xBLS_KEY_1");
            const holderInfo = await registry.getParticipantInfo(sessionId, addr1.address);
            expect(holderInfo.isRegistered).to.be.true;
            expect(holderInfo.isHolder).to.be.true;
            expect(holderInfo.depositAmount).to.equal(requiredDeposit);
            expect(holderInfo.blsPublicKeyHex).to.equal("0xBLS_KEY_1");
        });

        it("Should allow a user to register as a Voter with no deposit", async function () {
            // Action: addr1 registers as voter
            // Assert: Event emitted, addr1 is registered (but not holder) in registry
            await expect(registry.connect(addr1).registerAsVoter(sessionId))
                .to.emit(registry, "VoterRegistered")
                .withArgs(sessionId, addr1.address);
            const voterInfo = await registry.getParticipantInfo(sessionId, addr1.address);
            expect(voterInfo.isRegistered).to.be.true;
            expect(voterInfo.isHolder).to.be.false;
            expect(voterInfo.depositAmount).to.equal(0);
        });

        it("Should fail Holder registration with incorrect deposit", async function () {
             const wrongDeposit = ethers.parseEther("0.05");
             // Action: addr1 tries to register as holder with wrong deposit
             // Assert: Transaction reverts
             await expect(registry.connect(addr1).joinAsHolder(sessionId, "0xBLS_KEY_1", { value: wrongDeposit }))
                 .to.be.revertedWith("Registry: Incorrect deposit amount");
        });

         it("Should fail registration if already registered", async function () {
            await registry.connect(addr1).registerAsVoter(sessionId);
            // Action: addr1 tries to register again (as voter or holder)
            // Assert: Transaction reverts
            await expect(registry.connect(addr1).registerAsVoter(sessionId))
                .to.be.revertedWith("Registry: Already registered");
            await expect(registry.connect(addr1).joinAsHolder(sessionId, "0xKEY", { value: requiredDeposit }))
                .to.be.revertedWith("Registry: Already registered");
        });

        it("Should fail registration if registration period is closed", async function () {
            // Action: Increase time past registration end (== startTime)
            await time.increaseTo(startTime + 1);
            // Action: addr1 tries to register
            // Assert: Transaction reverts
             await expect(registry.connect(addr1).registerAsVoter(sessionId))
                .to.be.revertedWith("Registry: Registration closed");
             await expect(registry.connect(addr1).joinAsHolder(sessionId, "0xKEY", { value: requiredDeposit }))
                .to.be.revertedWith("Registry: Registration closed");
        });
    });
}); 
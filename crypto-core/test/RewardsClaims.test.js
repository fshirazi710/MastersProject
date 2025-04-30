const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("Rewards and Claims Tests", function () {
    // Load common fixture
    async function setup() {
        return await loadFixture(deployVoteSessionFixture);
    }

    // Destructure common variables
    let voteSession, registry, owner, addr1, addr2, addr3;
    let sessionId, requiredDeposit, minShareThreshold, startTime, endTime, sharesEndTime;

    beforeEach(async function () {
        const deployed = await setup();
        voteSession = deployed.voteSession;
        registry = deployed.registry;
        owner = deployed.owner;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
        addr3 = deployed.addr3;
        // addrs = deployed.addrs; // Not needed for these tests
        sessionId = deployed.sessionId;
        requiredDeposit = deployed.requiredDeposit;
        minShareThreshold = deployed.minShareThreshold;
        startTime = deployed.startTime;
        endTime = deployed.endTime;
        sharesEndTime = deployed.sharesEndTime;
    });

    // === Rewards and Deposit Claim Tests (Copied from original file) ===
    describe("Reward Funding, Calculation, and Claims", function () {
         // Nested beforeEach for these tests
         beforeEach(async function() {
            // Setup: 3 holders register, 2 submit shares
            await registry.connect(addr1).joinAsHolder(sessionId, "0xBLS1", { value: requiredDeposit });
            await registry.connect(addr2).joinAsHolder(sessionId, "0xBLS2", { value: requiredDeposit });
            await registry.connect(addr3).joinAsHolder(sessionId, "0xBLS3", { value: requiredDeposit }); // addr3 does not submit

            await time.increaseTo(startTime + 1);
            // A vote is cast (doesn't matter by who for this test)
            const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("VoteCipher"));
            await voteSession.connect(addr1).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold);

            await time.increaseTo(endTime + 1);
            // addr1 and addr2 submit shares
            const share1 = ethers.hexlify(ethers.toUtf8Bytes("Share1"));
            const share2 = ethers.hexlify(ethers.toUtf8Bytes("Share2"));
            await voteSession.connect(addr1).submitDecryptionShare(0, share1, 0);
            await voteSession.connect(addr2).submitDecryptionShare(0, share2, 1);

            // Increase time past share collection end
            await time.increaseTo(sharesEndTime + 1);
        });

        it("Should allow owner to add reward funding", async function () {
            const fundingAmount = ethers.parseEther("1.0");
            await expect(registry.connect(owner).addRewardFunding(sessionId, { value: fundingAmount }))
                .to.not.be.reverted;
            expect(await registry.getTotalRewardPool(sessionId)).to.equal(fundingAmount);

            // Try funding from non-owner - should fail
            await expect(registry.connect(addr1).addRewardFunding(sessionId, { value: fundingAmount }))
                .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
        });

        it("Should allow reward calculation to be triggered", async function () {
            // Add external funding
            const externalFunding = ethers.parseEther("0.5");
            await registry.connect(owner).addRewardFunding(sessionId, { value: externalFunding });

            // Action: Trigger reward calculation
            await expect(voteSession.connect(owner).triggerRewardCalculation())
                .to.emit(registry, "RewardsCalculated"); // Check registry event

            // Assert internal state of registry (check rewardsOwed)
            const forfeitedDeposit = requiredDeposit;
            const totalCalculatedPool = forfeitedDeposit + externalFunding;
            const expectedRewardPer = totalCalculatedPool / BigInt(2); // 2 eligible holders

            expect(await registry.rewardsOwed(sessionId, addr1.address)).to.equal(expectedRewardPer);
            expect(await registry.rewardsOwed(sessionId, addr2.address)).to.equal(expectedRewardPer);
            expect(await registry.rewardsOwed(sessionId, addr3.address)).to.equal(0);

            // Check event emission for total pool
            const filter = registry.filters.RewardsCalculated(sessionId);
            const events = await registry.queryFilter(filter, "latest");
            expect(events.length).to.equal(1);
            expect(events[0].args.totalRewardPoolCalculated).to.equal(totalCalculatedPool);
        });

         it("Should fail to trigger reward calculation twice", async function () {
             // Add some funding so first calculation doesn't fail
             await registry.connect(owner).addRewardFunding(sessionId, { value: ethers.parseEther("0.1") });
             await voteSession.connect(owner).triggerRewardCalculation();
             // Action: Trigger again
             // Assert: Reverts
             await expect(voteSession.connect(owner).triggerRewardCalculation())
                .to.be.revertedWith("Session: Rewards already triggered");
         });

         it("Should allow eligible holders to claim rewards after calculation", async function () {
            // Add funding & calculate
            await registry.connect(owner).addRewardFunding(sessionId, { value: ethers.parseEther("0.5") });
            await voteSession.connect(owner).triggerRewardCalculation();
            const rewardAmount = await registry.rewardsOwed(sessionId, addr1.address);
            expect(rewardAmount).to.be.gt(0);

            // Action: addr1 claims reward
            const initialBalance = await ethers.provider.getBalance(addr1.address);
            const tx = await registry.connect(addr1).claimReward(sessionId);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const finalBalance = await ethers.provider.getBalance(addr1.address);

            // Assert: Event emitted, balance increased, reward owed is 0
             expect(tx).to.emit(registry, "RewardClaimed").withArgs(sessionId, addr1.address, rewardAmount);
            expect(finalBalance + gasUsed).to.equal(initialBalance + rewardAmount);
            expect(await registry.rewardsOwed(sessionId, addr1.address)).to.equal(0);
            expect(await registry.rewardClaimed(sessionId, addr1.address)).to.be.true;
         });

        it("Should fail reward claim if calculation not triggered", async function () {
             // Action: addr1 tries to claim reward
             // Assert: Reverts (rewardsOwed is 0)
             await expect(registry.connect(addr1).claimReward(sessionId))
                .to.be.revertedWith("Registry: No reward owed or calculation pending");
        });

         it("Should fail reward claim if reward already claimed", async function () {
            // Add funding & calculate
            await registry.connect(owner).addRewardFunding(sessionId, { value: ethers.parseEther("0.5") });
            await voteSession.connect(owner).triggerRewardCalculation();
            await registry.connect(addr1).claimReward(sessionId);
            // Action: addr1 tries to claim again
            // Assert: Reverts
            await expect(registry.connect(addr1).claimReward(sessionId))
                .to.be.revertedWith("Registry: Reward already claimed");
         });

         it("Should fail reward claim for ineligible holder", async function () {
            // Add funding & calculate
            await registry.connect(owner).addRewardFunding(sessionId, { value: ethers.parseEther("0.5") });
            await voteSession.connect(owner).triggerRewardCalculation();
            // Action: addr3 (didn't submit shares) tries to claim
            // Assert: Reverts (rewardsOwed is 0)
             await expect(registry.connect(addr3).claimReward(sessionId))
                .to.be.revertedWith("Registry: No reward owed or calculation pending");
         });

         it("Should allow eligible holders (who submitted shares) to claim deposit", async function () {
             const depositAmount = await registry.participants(sessionId, addr1.address).then(p => p.depositAmount);
             expect(depositAmount).to.equal(requiredDeposit);

            // Action: addr1 claims deposit
             const initialBalance = await ethers.provider.getBalance(addr1.address);
             const tx = await registry.connect(addr1).claimDeposit(sessionId);
             const receipt = await tx.wait();
             const gasUsed = receipt.gasUsed * receipt.gasPrice;
             const finalBalance = await ethers.provider.getBalance(addr1.address);

             // Assert: Event emitted, balance increased, deposit is 0
              expect(tx).to.emit(registry, "DepositClaimed").withArgs(sessionId, addr1.address, depositAmount);
             expect(finalBalance + gasUsed).to.equal(initialBalance + depositAmount);
             const finalInfo = await registry.getParticipantInfo(sessionId, addr1.address);
             expect(finalInfo.depositAmount).to.equal(0);
             expect(await registry.depositClaimed(sessionId, addr1.address)).to.be.true;
         });

         it("Should fail deposit claim if shares were not submitted", async function () {
            // addr3 did NOT submit shares in the beforeEach block
            await expect(registry.connect(addr3).claimDeposit(sessionId))
              .to.be.revertedWith("Registry: Shares not submitted");
         });

         it("Should fail deposit claim if deposit already claimed", async function () {
            // addr1 submitted shares and is eligible based on beforeEach
            // First claim succeeds
            await registry.connect(addr1).claimDeposit(sessionId);
            // Second claim fails
            await expect(registry.connect(addr1).claimDeposit(sessionId))
              .to.be.revertedWith("Registry: Deposit already claimed");
         });
    });
}); 
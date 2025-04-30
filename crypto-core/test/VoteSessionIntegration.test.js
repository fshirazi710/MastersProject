const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VoteSessionFactory and Integration Tests", function () {
    let VoteSessionFactory, factory;
    let ParticipantRegistry, registry;
    let VoteSession, voteSession;
    let owner, addr1, addr2, addr3, addrs;
    let registryAddress, voteSessionAddress;
    let sessionId = 0; // Assuming first session ID is 0

    // Session Parameters
    const title = "Test Session";
    const description = "A session for testing purposes";
    let startTime, endTime, sharesEndTime;
    const options = ["Option A", "Option B"];
    const metadata = "{}"; // Empty JSON metadata
    const requiredDeposit = ethers.parseEther("0.1"); // 0.1 ETH
    const minShareThreshold = 2;

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

        // Deploy Factory
        VoteSessionFactory = await ethers.getContractFactory("VoteSessionFactory");
        factory = await VoteSessionFactory.deploy(owner.address);

        // Set Timestamps relative to the latest block
        const latestBlock = await ethers.provider.getBlock("latest");
        const latestTimestamp = latestBlock.timestamp;
        startTime = latestTimestamp + 60; // Starts in 1 minute
        endTime = startTime + 300; // Voting lasts 5 minutes
        sharesEndTime = endTime + 60; // Share collection lasts 1 minute after voting ends

        // Deploy session pair using the factory
        const deployTx = await factory.connect(owner).createSessionPair(
            title,
            description,
            startTime,
            endTime,
            sharesEndTime,
            options,
            metadata,
            requiredDeposit,
            minShareThreshold
        );
        const receipt = await deployTx.wait();

        // --- Find deployed addresses from event (robust way) ---
        const eventTopic = factory.interface.getEvent("SessionPairDeployed").topicHash;
        const log = receipt.logs.find(x => x.topics[0] === eventTopic);
        if (!log) {
            throw new Error("SessionPairDeployed event not found in transaction logs");
        }
        const decodedLog = factory.interface.decodeEventLog("SessionPairDeployed", log.data, log.topics);

        sessionId = decodedLog.sessionId;
        voteSessionAddress = decodedLog.voteSessionContract;
        registryAddress = decodedLog.participantRegistryContract;
        // --- ---

        // Get contract instances at the deployed addresses
        registry = await ethers.getContractAt("ParticipantRegistry", registryAddress);
        voteSession = await ethers.getContractAt("VoteSession", voteSessionAddress);

        // *** ADDED STEP: Link Registry to VoteSession externally ***
        await registry.connect(owner).setVoteSessionContract(sessionId, voteSessionAddress);
        // ***********************************************************
    });

    // === Factory Tests ===
    describe("Factory Deployment", function () {
        it("Should set the right owner for the factory", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should deploy a pair and emit an event", async function () {
            // Note: Deployment is already done in beforeEach, this mainly checks addresses
            expect(voteSessionAddress).to.properAddress;
            expect(registryAddress).to.properAddress;
            expect(await factory.getDeployedSessionCount()).to.equal(1);
            expect(await factory.getVoteSessionAddressByIndex(0)).to.equal(voteSessionAddress);
            expect(await factory.getVoteSessionAddressById(sessionId)).to.equal(voteSessionAddress);
            expect(await factory.getRegistryAddressById(sessionId)).to.equal(registryAddress);
        });

         it("Should set the correct owner for deployed contracts", async function () {
             expect(await registry.owner()).to.equal(owner.address);
             expect(await voteSession.owner()).to.equal(owner.address);
         });

         it("Should link the contracts correctly", async function () {
            // Check if registry knows the vote session address
            expect(await registry.voteSessionContracts(sessionId)).to.equal(voteSessionAddress);
            // Check if vote session knows the registry address (via immutable variable check - harder to check directly)
            // We infer this link is correct if interactions work later.
         });
    });

    // === Registration Tests ===
    describe("Participant Registration", function () {
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
            // expect(await registry.getTotalRewardPool(sessionId)).to.equal(requiredDeposit); // REMOVED - Pool no longer increases on registration
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

     // === Voting Tests ===
    describe("Voting Period", function () {
        beforeEach(async function() {
            // Pre-register users for voting tests
            await registry.connect(addr1).registerAsVoter(sessionId);
            await registry.connect(addr2).joinAsHolder(sessionId, "0xBLS2", { value: requiredDeposit });
        });

        it("Should fail voting before start time", async function () {
             // Action: addr1 tries to vote
             // Assert: Reverts because status is still RegistrationOpen
             const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("dummy"));
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
                .to.be.revertedWith("Session: Voter already voted");
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

     // === Share Submission Tests ===
    describe("Share Submission Period", function () {
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
             await expect(voteSession.connect(addr2).submitDecryptionShares([0], [0], [dummyShare]))
                 .to.be.revertedWith("Session: Share collection not open");
        });

        it("Should allow holders to submit shares during the correct period", async function () {
             // Action: Increase time to shares collection period
             await time.increaseTo(endTime + 1);
             // Action: addr2 submits share for vote 0
             const shareData2 = ethers.hexlify(ethers.toUtf8Bytes("ShareData2"));
             await expect(voteSession.connect(addr2).submitDecryptionShares([0], [0], [shareData2]))
                .to.emit(voteSession, "DecryptionShareSubmitted");
             // Assert: Registry should now show addr2 has submitted
             const holderInfo2 = await registry.getParticipantInfo(sessionId, addr2.address);
             expect(holderInfo2.hasSubmittedShares).to.be.true;

             // Action: addr3 submits share for vote 0
             const shareData3 = ethers.hexlify(ethers.toUtf8Bytes("ShareData3"));
              await expect(voteSession.connect(addr3).submitDecryptionShares([0], [1], [shareData3])) // Note different share index
                 .to.emit(voteSession, "DecryptionShareSubmitted");
             const holderInfo3 = await registry.getParticipantInfo(sessionId, addr3.address);
             expect(holderInfo3.hasSubmittedShares).to.be.true;

             expect(await voteSession.getNumberOfSubmittedShares()).to.equal(2); // Two shares submitted in total
        });

        it("Should fail share submission if not an active holder", async function () {
            await time.increaseTo(endTime + 1);
            // Action: addr4 (not registered) tries to submit
            // Assert: Reverts
            const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
            await expect(voteSession.connect(addrs[0]).submitDecryptionShares([0], [0], [dummyShare]))
                .to.be.revertedWith("Session: Caller is not a holder"); // Check comes from registry via voteSession
        });

         it("Should fail share submission if shares already submitted", async function () {
            await time.increaseTo(endTime + 1);
            const shareData2 = ethers.hexlify(ethers.toUtf8Bytes("ShareData2"));
            await voteSession.connect(addr2).submitDecryptionShares([0], [0], [shareData2]);
            // Action: addr2 tries to submit again
            // Assert: Reverts
            await expect(voteSession.connect(addr2).submitDecryptionShares([0], [0], [shareData2]))
                .to.be.revertedWith("Session: Shares already submitted (via Registry)");
        });

        it("Should fail share submission after shares collection period ends", async function () {
             // Action: Increase time past shares collection end
             await time.increaseTo(sharesEndTime + 1);
             // Action: addr2 tries to submit
             // Assert: Reverts
             const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
              await expect(voteSession.connect(addr2).submitDecryptionShares([0], [0], [dummyShare]))
                 .to.be.revertedWith("Session: Share collection not open");
        });
    });

    // === Rewards and Deposit Claim Tests ===
    describe("Rewards and Claims", function () {
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
            await voteSession.connect(addr1).submitDecryptionShares([0], [0], [share1]);
            await voteSession.connect(addr2).submitDecryptionShares([0], [1], [share2]);

            // Increase time past share collection end
            await time.increaseTo(sharesEndTime + 1);
        });

        // New test for adding funding
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
            // Setup: addr1, addr2 submitted shares. addr3 did not.
            // Forfeited deposit = addr3's deposit = requiredDeposit
            const forfeitedDeposit = requiredDeposit;
            const totalCalculatedPool = forfeitedDeposit + externalFunding;
            const expectedRewardPer = totalCalculatedPool / BigInt(2); // 2 eligible holders

            expect(await registry.rewardsOwed(sessionId, addr1.address)).to.equal(expectedRewardPer);
            expect(await registry.rewardsOwed(sessionId, addr2.address)).to.equal(expectedRewardPer);
            expect(await registry.rewardsOwed(sessionId, addr3.address)).to.equal(0); // addr3 submitted no shares

            // Check that the RewardsCalculated event emitted the correct total pool amount
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
            await voteSession.connect(owner).triggerRewardCalculation();
            await registry.connect(addr1).claimReward(sessionId);
            // Action: addr1 tries to claim again
            // Assert: Reverts
            await expect(registry.connect(addr1).claimReward(sessionId))
                .to.be.revertedWith("Registry: Reward already claimed");
         });

         it("Should fail reward claim for ineligible holder", async function () {
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

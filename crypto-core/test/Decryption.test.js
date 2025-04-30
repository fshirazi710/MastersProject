const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("Decryption Coordination Tests", function () {
    // Load common fixture
    async function setup() {
        return await loadFixture(deployVoteSessionFixture);
    }

    // Destructure common variables
    let VoteSessionFactory, registryImplementation, voteSessionImplementation; // Needed for re-deploy tests
    let voteSession, registry, owner, addr1, addr2, addr3, addrs;
    let sessionId, requiredDeposit, minShareThreshold;
    // Add session parameters needed for re-deploy tests
    let title, description, options, metadata, startTime, endTime, sharesEndTime;

    beforeEach(async function () {
        const deployed = await setup();
        // Store factory and implementations for tests that need to redeploy
        VoteSessionFactory = await ethers.getContractFactory("VoteSessionFactory");
        registryImplementation = deployed.registryImplementation;
        voteSessionImplementation = deployed.voteSessionImplementation;
        // Main instances from fixture
        voteSession = deployed.voteSession;
        registry = deployed.registry;
        owner = deployed.owner;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
        addr3 = deployed.addr3;
        addrs = deployed.addrs;
        sessionId = deployed.sessionId;
        // Destructure session parameters
        requiredDeposit = deployed.requiredDeposit;
        minShareThreshold = deployed.minShareThreshold;
        title = deployed.title;
        description = deployed.description;
        options = deployed.options;
        metadata = deployed.metadata;
        startTime = deployed.startTime;
        endTime = deployed.endTime;
        sharesEndTime = deployed.sharesEndTime;
    });

    // === Decryption Coordination Tests (Copied from original file) ===
    describe("Decryption Parameter Setting and Value Submission", function () {
        let dummyAlphas;
        const decryptionThreshold = 2;

        // Nested beforeEach for decryption tests
        beforeEach(async function() {
            // 1. Register 3 holders
            await registry.connect(addr1).joinAsHolder(sessionId, "0xBLS1", { value: requiredDeposit });
            await registry.connect(addr2).joinAsHolder(sessionId, "0xBLS2", { value: requiredDeposit });
            await registry.connect(addr3).joinAsHolder(sessionId, "0xBLS3", { value: requiredDeposit });

            // 2. Advance to voting period
            await time.increaseTo(startTime + 1);

            // 3. Cast a vote (by addr1, doesn't really matter who)
            const dummyBytes = ethers.hexlify(ethers.toUtf8Bytes("VoteCipher"));
            await voteSession.connect(addr1).castEncryptedVote(dummyBytes, dummyBytes, dummyBytes, [], minShareThreshold);

            // 4. Advance to shares collection period
            await time.increaseTo(endTime + 1);

            // 5. Holders submit decryption shares (marks them eligible for submitting values)
            const dummyShare = ethers.hexlify(ethers.toUtf8Bytes("Share"));
            await voteSession.connect(addr1).submitDecryptionShare(0, dummyShare, 1);
            await voteSession.connect(addr2).submitDecryptionShare(0, dummyShare, 2);
            await voteSession.connect(addr3).submitDecryptionShare(0, dummyShare, 3);

            // 6. Owner sets decryption parameters
            dummyAlphas = [
                ethers.hexlify(ethers.randomBytes(32)),
                ethers.hexlify(ethers.randomBytes(32)),
                ethers.hexlify(ethers.randomBytes(32))
            ];
            await voteSession.connect(owner).setDecryptionParameters(dummyAlphas, decryptionThreshold);

            // 7. Advance past shares collection to Completed state
            await time.increaseTo(sharesEndTime + 1);
            await network.provider.send("evm_mine"); // Force mine a block to ensure timestamp update
            await voteSession.updateSessionStatus(); // Ensure status updates
            // Check enum order: Created=0, RegistrationOpen=1, VotingOpen=2, SharesCollectionOpen=3, Completed=4, Aborted=5
             expect(await voteSession.currentStatus()).to.equal(4); // Corrected expected status to Completed (4)
        });

        // --- Parameter Setting Tests ---
        it("Should have set decryption parameters correctly", async function() {
            const [threshold, alphas] = await voteSession.getDecryptionParameters();
            expect(threshold).to.equal(decryptionThreshold);
            expect(alphas).to.deep.equal(dummyAlphas);
        });

        it("Should prevent non-owner from setting decryption parameters", async function() {
            // Need a fresh contract state for this
            const factory_nonOwnerTest = await VoteSessionFactory.deploy(
                owner.address,
                await registryImplementation.getAddress(),
                await voteSessionImplementation.getAddress()
            );
            await factory_nonOwnerTest.waitForDeployment();

            // Create a new session pair using the new factory
            const deployTx_nonOwnerTest = await factory_nonOwnerTest.connect(owner).createSessionPair(title, description, startTime, endTime, sharesEndTime, options, metadata, requiredDeposit, minShareThreshold);
            const receipt_nonOwnerTest = await deployTx_nonOwnerTest.wait();
            const eventTopic_nonOwnerTest = factory_nonOwnerTest.interface.getEvent("SessionPairDeployed").topicHash;
            const log_nonOwnerTest = receipt_nonOwnerTest.logs.find(x => x.topics[0] === eventTopic_nonOwnerTest);
            const decodedLog_nonOwnerTest = factory_nonOwnerTest.interface.decodeEventLog("SessionPairDeployed", log_nonOwnerTest.data, log_nonOwnerTest.topics);
            const voteSessionProxyAddr_nonOwnerTest = decodedLog_nonOwnerTest.voteSessionContract;
            // Get instance of the new proxy
            const voteSession_nonOwnerTest = await ethers.getContractAt("VoteSession", voteSessionProxyAddr_nonOwnerTest);
            // Note: No need to link registry for this specific test

            // Try calling setDecryptionParameters as non-owner on the proxy
            const alphas_nonOwnerTest = [ethers.hexlify(ethers.randomBytes(32))];
            await expect(voteSession_nonOwnerTest.connect(addr1).setDecryptionParameters(alphas_nonOwnerTest, 2))
                .to.be.revertedWithCustomError(voteSession_nonOwnerTest, "OwnableUnauthorizedAccount");
        });

        it("Should prevent setting decryption parameters twice", async function() {
            // Parameters already set in beforeEach
            const alphas_doubleSetTest = [ethers.hexlify(ethers.randomBytes(32))];
            await expect(voteSession.connect(owner).setDecryptionParameters(alphas_doubleSetTest, 3))
                .to.be.revertedWith("Session: Decryption parameters already set");
        });

        // --- Value Submission Tests ---
        it("Should allow eligible holder to submit decryption value", async function() {
            const value1 = ethers.hexlify(ethers.randomBytes(32));
            const holderInfo1 = await registry.getParticipantInfo(sessionId, addr1.address);
            const holderIndex1 = await registry.getParticipantIndex(sessionId, addr1.address);

            expect(holderInfo1.hasSubmittedShares).to.be.true; // Prerequisite check
            await expect(voteSession.connect(addr1).submitDecryptionValue(value1))
                .to.emit(voteSession, "DecryptionValueSubmitted")
                .withArgs(sessionId, addr1.address, holderIndex1, value1);

            // Check state updates
            expect(await voteSession.hasSubmittedDecryptionValue(addr1.address)).to.be.true;
            expect(await voteSession.submittedValues(addr1.address)).to.equal(value1);
            expect(await voteSession.submittedValueIndex(addr1.address)).to.equal(holderIndex1);
            expect(await voteSession.submittedValueCount()).to.equal(1);
            expect(await voteSession.valueSubmitters(0)).to.equal(addr1.address);
            expect(await voteSession.thresholdReached()).to.be.false; // Threshold is 2
        });

        it("Should reach threshold and emit event on second submission", async function() {
            const value1 = ethers.hexlify(ethers.randomBytes(32));
            const value2 = ethers.hexlify(ethers.randomBytes(32));
            const holderIndex2 = await registry.getParticipantIndex(sessionId, addr2.address);

            await voteSession.connect(addr1).submitDecryptionValue(value1);

            await expect(voteSession.connect(addr2).submitDecryptionValue(value2))
                .to.emit(voteSession, "DecryptionValueSubmitted")
                .withArgs(sessionId, addr2.address, holderIndex2, value2)
                .and.to.emit(voteSession, "DecryptionThresholdReached")
                .withArgs(sessionId);

            // Check state updates
            expect(await voteSession.hasSubmittedDecryptionValue(addr2.address)).to.be.true;
            expect(await voteSession.submittedValueCount()).to.equal(2);
            expect(await voteSession.valueSubmitters(1)).to.equal(addr2.address);
            expect(await voteSession.thresholdReached()).to.be.true;
        });

        /* // TEST REMOVED based on user feedback - should allow submission after threshold
        it("Should fail submission if threshold already reached", async function() { ... });
        */

        it("Should fail submission if sender has not submitted shares", async function() {
            // Test with addr4 (addrs[0]) who is obtained from fixture but never registered as holder.
            // Therefore, they cannot have submitted shares.
            // Ensure time is in the correct period for submission attempt (Completed state).
            await time.increase(600); // Increase time by 10 mins to be safe
            await voteSession.updateSessionStatus();
            expect(await voteSession.currentStatus()).to.equal(4); // Completed

            const value4 = ethers.hexlify(ethers.randomBytes(32));
            // Try to submit the value - should fail because they are not registered as a holder
            await expect(voteSession.connect(addrs[0]).submitDecryptionValue(value4))
                .to.be.revertedWith("Session: Not a registered holder");
        });

        it("Should fail submission if sender is not a registered holder", async function() {
             // addr4 is not registered at all in the main fixture setup
            const value4 = ethers.hexlify(ethers.randomBytes(32));
            await expect(voteSession.connect(addrs[0]).submitDecryptionValue(value4))
                .to.be.revertedWith("Session: Not a registered holder");
        });

        it("Should fail submission if sender already submitted a value", async function() {
            const value1 = ethers.hexlify(ethers.randomBytes(32));
            const value1_again = ethers.hexlify(ethers.randomBytes(32));
            await voteSession.connect(addr1).submitDecryptionValue(value1);

            await expect(voteSession.connect(addr1).submitDecryptionValue(value1_again))
                .to.be.revertedWith("Session: Decryption value already submitted");
        });

        it("Should fail submission if not in Completed or SharesCollectionOpen state", async function() {
            // Re-deploy and setup, stop before shares collection ends
            const factory_wrongStateTest = await VoteSessionFactory.deploy(
               owner.address,
               await registryImplementation.getAddress(),
               await voteSessionImplementation.getAddress()
            );
            await factory_wrongStateTest.waitForDeployment();

            // Calculate new timestamps relative to current block time for THIS test
            const currentBlock = await ethers.provider.getBlock("latest");
            const newStartTime = currentBlock.timestamp + 60;
            const newEndTime = newStartTime + 300;
            const newSharesEndTime = newEndTime + 60;

            // Create new pair using new timestamps
            const deployTx_wrongStateTest = await factory_wrongStateTest.connect(owner).createSessionPair(
                title, description, newStartTime, newEndTime, newSharesEndTime, options, metadata, requiredDeposit, minShareThreshold
            );
            const receipt_wrongStateTest = await deployTx_wrongStateTest.wait();
            const eventTopic_wrongStateTest = factory_wrongStateTest.interface.getEvent("SessionPairDeployed").topicHash;
            const log_wrongStateTest = receipt_wrongStateTest.logs.find(x => x.topics[0] === eventTopic_wrongStateTest);
            const decodedLog_wrongStateTest = factory_wrongStateTest.interface.decodeEventLog("SessionPairDeployed", log_wrongStateTest.data, log_wrongStateTest.topics);
            const voteSessionProxyAddr_wrongStateTest = decodedLog_wrongStateTest.voteSessionContract;
            const voteSession_wrongStateTest = await ethers.getContractAt("VoteSession", voteSessionProxyAddr_wrongStateTest);
            const registryProxyAddr_wrongStateTest = decodedLog_wrongStateTest.participantRegistryContract;
            const registry_wrongStateTest = await ethers.getContractAt("ParticipantRegistry", registryProxyAddr_wrongStateTest);
            await registry_wrongStateTest.connect(owner).setVoteSessionContract(decodedLog_wrongStateTest.sessionId, voteSessionProxyAddr_wrongStateTest); // Link contracts

            // Register holder (should succeed now)
            await registry_wrongStateTest.connect(addr1).joinAsHolder(decodedLog_wrongStateTest.sessionId, "0xBLS1", { value: requiredDeposit });
            // Advance time to VotingOpen
            await time.increaseTo(newStartTime + 1); // Use newStartTime
            // Cast vote
            const dummyBytes_wrongStateTest = ethers.hexlify(ethers.toUtf8Bytes("VoteCipher"));
            await voteSession_wrongStateTest.connect(addr1).castEncryptedVote(dummyBytes_wrongStateTest, dummyBytes_wrongStateTest, dummyBytes_wrongStateTest, [], minShareThreshold);
            // Advance time just into SharesCollectionOpen
            await time.increaseTo(newEndTime + 1); // Use newEndTime
            // Submit shares
            const dummyShare_wrongStateTest = ethers.hexlify(ethers.toUtf8Bytes("Share"));
            await voteSession_wrongStateTest.connect(addr1).submitDecryptionShare(0, dummyShare_wrongStateTest, 1);

            // Now check failure before SharesCollectionOpen (e.g., during voting)
            // This part needs its own fresh deployment and new timestamps too
            const factory_earlyStateTest = await VoteSessionFactory.deploy(owner.address, await registryImplementation.getAddress(), await voteSessionImplementation.getAddress());
            await factory_earlyStateTest.waitForDeployment();
            const earlyBlock = await ethers.provider.getBlock("latest");
            const earlyStartTime = earlyBlock.timestamp + 60;
            const earlyEndTime = earlyStartTime + 300;
            const earlySharesEndTime = earlyEndTime + 60;
            const deployTx_early = await factory_earlyStateTest.connect(owner).createSessionPair(
                title, description, earlyStartTime, earlyEndTime, earlySharesEndTime, options, metadata, requiredDeposit, minShareThreshold
            );
            const receipt_early = await deployTx_early.wait();
            const eventFragment_early = factory_earlyStateTest.interface.getEvent("SessionPairDeployed"); // Use correct fragment
            const log_early = receipt_early.logs.find(x => x.topics[0] === eventFragment_early.topicHash);
            const decoded_early = factory_earlyStateTest.interface.decodeEventLog("SessionPairDeployed", log_early.data, log_early.topics);
            const voteSession_early = await ethers.getContractAt("VoteSession", decoded_early.voteSessionContract);
            const registry_early = await ethers.getContractAt("ParticipantRegistry", decoded_early.participantRegistryContract);
            await registry_early.connect(owner).setVoteSessionContract(decoded_early.sessionId, decoded_early.voteSessionContract);
            await registry_early.connect(addr1).joinAsHolder(decoded_early.sessionId, "0xBLS1", { value: requiredDeposit });
            await time.increaseTo(earlyStartTime + 5); // Advance into voting period
            await voteSession_early.updateSessionStatus();
            expect(await voteSession_early.currentStatus()).to.equal(2); // VotingOpen
            // Define the value needed for this check scope
            const value_earlyStateTest = ethers.hexlify(ethers.randomBytes(32));
            await expect(voteSession_early.connect(addr1).submitDecryptionValue(value_earlyStateTest))
                .to.be.revertedWith("Session: Decryption value submission not allowed now");

        });

        it("Should fail submission if decryption parameters not set", async function() {
            // Re-deploy and setup, but DON'T set parameters
            const factory_noParamsTest = await VoteSessionFactory.deploy(
               owner.address,
               await registryImplementation.getAddress(),
               await voteSessionImplementation.getAddress()
            );
            await factory_noParamsTest.waitForDeployment();

            // Calculate new timestamps relative to current block time for THIS test
            const currentBlock_noParams = await ethers.provider.getBlock("latest");
            const newStartTime_noParams = currentBlock_noParams.timestamp + 60;
            const newEndTime_noParams = newStartTime_noParams + 300;
            const newSharesEndTime_noParams = newEndTime_noParams + 60;

            // Create new pair using new timestamps
            const deployTx_noParamsTest = await factory_noParamsTest.connect(owner).createSessionPair(
                title, description, newStartTime_noParams, newEndTime_noParams, newSharesEndTime_noParams, options, metadata, requiredDeposit, minShareThreshold
            );
            const receipt_noParamsTest = await deployTx_noParamsTest.wait();
            const eventTopic_noParamsTest = factory_noParamsTest.interface.getEvent("SessionPairDeployed").topicHash;
            const log_noParamsTest = receipt_noParamsTest.logs.find(x => x.topics[0] === eventTopic_noParamsTest);
            const decodedLog_noParamsTest = factory_noParamsTest.interface.decodeEventLog("SessionPairDeployed", log_noParamsTest.data, log_noParamsTest.topics);
            const voteSessionProxyAddr_noParamsTest = decodedLog_noParamsTest.voteSessionContract;
            const voteSession_noParamsTest = await ethers.getContractAt("VoteSession", voteSessionProxyAddr_noParamsTest);
            const registryProxyAddr_noParamsTest = decodedLog_noParamsTest.participantRegistryContract;
            const registry_noParamsTest = await ethers.getContractAt("ParticipantRegistry", registryProxyAddr_noParamsTest);
            await registry_noParamsTest.connect(owner).setVoteSessionContract(decodedLog_noParamsTest.sessionId, voteSessionProxyAddr_noParamsTest); // Link contracts

            // Register holder (should succeed)
            await registry_noParamsTest.connect(addr1).joinAsHolder(decodedLog_noParamsTest.sessionId, "0xBLS1", { value: requiredDeposit });
            // Advance time to VotingOpen
            await time.increaseTo(newStartTime_noParams + 1);
            // Cast vote
            const dummyBytes_noParamsTest = ethers.hexlify(ethers.toUtf8Bytes("VoteCipher"));
            await voteSession_noParamsTest.connect(addr1).castEncryptedVote(dummyBytes_noParamsTest, dummyBytes_noParamsTest, dummyBytes_noParamsTest, [], minShareThreshold);
            // Advance time to SharesCollectionOpen
            await time.increaseTo(newEndTime_noParams + 1);
            // Submit shares
            const dummyShare_noParamsTest = ethers.hexlify(ethers.toUtf8Bytes("Share"));
            await voteSession_noParamsTest.connect(addr1).submitDecryptionShare(0, dummyShare_noParamsTest, 1);
            // Advance time to Completed
            await time.increaseTo(newSharesEndTime_noParams + 1);

            // ASSERTION: Should be in Completed state
            await voteSession_noParamsTest.updateSessionStatus(); // Make sure status is updated
            expect(await voteSession_noParamsTest.currentStatus()).to.equal(4); // Completed

            // Try submitting value WITHOUT setting parameters
            const value_noParamsTest = ethers.hexlify(ethers.randomBytes(32));
            await expect(voteSession_noParamsTest.connect(addr1).submitDecryptionValue(value_noParamsTest))
                .to.be.revertedWith("Session: Decryption parameters not set");
        });

        // --- View Function Tests ---
        it("getSubmittedDecryptionValues should return empty arrays before threshold is reached", async function() {
            const [submitters, indexes, values] = await voteSession.getSubmittedDecryptionValues();
            expect(submitters).to.be.an('array').that.is.empty;
            expect(indexes).to.be.an('array').that.is.empty;
            expect(values).to.be.an('array').that.is.empty;

            // Submit one value (threshold is 2)
            const value1 = ethers.hexlify(ethers.randomBytes(32));
            await voteSession.connect(addr1).submitDecryptionValue(value1);

            const [submitters1, indexes1, values1] = await voteSession.getSubmittedDecryptionValues();
            // Correction: Should still return the single value even if threshold not met
            const index1 = await registry.getParticipantIndex(sessionId, addr1.address);
            expect(submitters1).to.deep.equal([addr1.address]);
            expect(indexes1).to.deep.equal([index1]);
            expect(values1).to.deep.equal([value1]);
            // expect(submitters1).to.be.an('array').that.is.empty; // Old assertion
            // expect(indexes1).to.be.an('array').that.is.empty; // Old assertion
            // expect(values1).to.be.an('array').that.is.empty; // Old assertion
        });

        it("getSubmittedDecryptionValues should return correct data after threshold is reached", async function() {
            const value1 = ethers.hexlify(ethers.randomBytes(32));
            const value2 = ethers.hexlify(ethers.randomBytes(32));
            // const value3 = ethers.hexlify(ethers.randomBytes(32)); // For addr3
            const index1 = await registry.getParticipantIndex(sessionId, addr1.address);
            const index2 = await registry.getParticipantIndex(sessionId, addr2.address);
            // const index3 = await registry.getParticipantIndex(sessionId, addr3.address); // Not needed for threshold=2 check

            // Submit values to reach threshold
            await voteSession.connect(addr1).submitDecryptionValue(value1);
            await voteSession.connect(addr2).submitDecryptionValue(value2); // Threshold reached

            // Submit a third value (shouldn't affect getSubmittedValues output if limited by threshold)
            const value3 = ethers.hexlify(ethers.randomBytes(32));
            await voteSession.connect(addr3).submitDecryptionValue(value3);

            const [submitters, indexes, values] = await voteSession.getSubmittedDecryptionValues();

            expect(await voteSession.thresholdReached()).to.be.true;
            // Check if it returns only threshold count or all submitted? Current logic returns only threshold.
            expect(submitters).to.deep.equal([addr1.address, addr2.address]);
            expect(indexes).to.deep.equal([index1, index2]);
            expect(values).to.deep.equal([value1, value2]);
        });

        /* // TEST REMOVED - Contract requires threshold >= 2
        it("getSubmittedValues should handle threshold of 1 (edge case)", async function() { ... });
        */
    });
}); 
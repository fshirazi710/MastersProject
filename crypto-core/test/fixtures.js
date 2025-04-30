const { ethers } = require("hardhat");

async function deployVoteSessionFixture() {
    // Get signers
    const [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    // 1. Deploy Implementations
    const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
    const registryImplementation = await ParticipantRegistry.deploy();
    await registryImplementation.waitForDeployment();
    const registryImplAddr = await registryImplementation.getAddress();

    const VoteSession = await ethers.getContractFactory("VoteSession");
    const voteSessionImplementation = await VoteSession.deploy();
    await voteSessionImplementation.waitForDeployment();
    const voteSessionImplAddr = await voteSessionImplementation.getAddress();

    // 2. Deploy Factory with Implementation Addresses
    const VoteSessionFactory = await ethers.getContractFactory("VoteSessionFactory");
    const factory = await VoteSessionFactory.deploy(owner.address, registryImplAddr, voteSessionImplAddr);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    // Session Parameters for the first session deployed by the fixture
    const title = "Fixture Session";
    const description = "Session deployed by fixture";
    const options = ["Yes", "No"];
    const metadata = "{}";
    const requiredDeposit = ethers.parseEther("0.1");
    const minShareThreshold = 2;

    // Set Timestamps relative to the latest block
    const latestBlock = await ethers.provider.getBlock("latest");
    const latestTimestamp = latestBlock.timestamp;
    const startTime = latestTimestamp + 60; // Starts in 1 minute
    const endTime = startTime + 300;       // Voting lasts 5 minutes
    const sharesEndTime = endTime + 900;    // Share collection lasts 15 minutes (900s) after voting ends

    // 3. Call the factory to create the first session pair
    const tx = await factory.createSessionPair(
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
    const receipt = await tx.wait();

    // 4. Get Proxy addresses from event in the receipt
    const eventFragment = factory.interface.getEvent("SessionPairDeployed");
    const log = receipt.logs.find(log => log.topics[0] === eventFragment.topicHash && log.address === factoryAddress );
    if (!log) {
        throw new Error("Fixture Error: SessionPairDeployed event not found.");
    }
    const decodedLog = factory.interface.decodeEventLog("SessionPairDeployed", log.data, log.topics);
    const sessionId = decodedLog.sessionId;
    const voteSessionAddress = decodedLog.voteSessionContract;
    const registryAddress = decodedLog.participantRegistryContract;

    // 5. Get contract instances at the PROXY addresses
    const registry = await ethers.getContractAt("ParticipantRegistry", registryAddress);
    const voteSession = await ethers.getContractAt("VoteSession", voteSessionAddress);

    // 6. Link the contracts externally
    await registry.connect(owner).setVoteSessionContract(sessionId, voteSessionAddress);

    // Return all necessary variables for tests
    return {
        factory, factoryAddress,
        registry, registryAddress, registryImplementation, // Include implementation for specific tests if needed
        voteSession, voteSessionAddress, voteSessionImplementation,
        owner, addr1, addr2, addr3, addrs,
        sessionId,
        // Session parameters
        title, description, options, metadata, requiredDeposit, minShareThreshold,
        startTime, endTime, sharesEndTime
    };
}

module.exports = { deployVoteSessionFixture }; 
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVoteSessionFixture } = require("./fixtures");

describe("VoteSessionFactory Tests", function () {
    // We use loadFixture to run the setup function once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    let factory, owner;
    let registryAddress, voteSessionAddress, sessionId;

    beforeEach(async function () {
        // Load the fixture and destructure needed variables
        const deployed = await loadFixture(deployVoteSessionFixture);
        factory = deployed.factory;
        owner = deployed.owner;
        registryAddress = deployed.registryAddress;
        voteSessionAddress = deployed.voteSessionAddress;
        sessionId = deployed.sessionId;
        // We also get registry and voteSession instances from the fixture if needed later
    });

    // === Factory Tests (Copied from original file) ===
    describe("Factory Deployment and Functionality", function () {
        it("Should set the right owner for the factory", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should deploy a pair and emit an event (checked via fixture setup)", async function () {
            // The fixture already performed the deployment and got addresses.
            // We just check if the values loaded from the fixture seem correct.
            expect(voteSessionAddress).to.properAddress;
            expect(registryAddress).to.properAddress;
            expect(await factory.getDeployedSessionCount()).to.equal(1);
            expect(await factory.getVoteSessionAddressByIndex(0)).to.equal(voteSessionAddress);
            expect(await factory.getVoteSessionAddressById(sessionId)).to.equal(voteSessionAddress);
            expect(await factory.getRegistryAddressById(sessionId)).to.equal(registryAddress);
        });

        // Note: Tests for owner of deployed contracts and linking are removed
        // because those are now handled *outside* the factory in the fixture.
        // Testing them here would be redundant with the fixture logic.
        // If needed, dedicated integration tests for linking could be added elsewhere.
    });

    // Add more factory-specific tests here if needed (e.g., deploying multiple pairs)

}); 
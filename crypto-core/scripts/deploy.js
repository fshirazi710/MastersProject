const hre = require("hardhat");

async function main() {
  // Get the deployer signer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy ParticipantRegistry Implementation
  console.log("Deploying ParticipantRegistry implementation...");
  const ParticipantRegistry = await hre.ethers.getContractFactory("ParticipantRegistry");
  const registryImpl = await ParticipantRegistry.deploy();
  await registryImpl.waitForDeployment();
  const registryImplAddress = await registryImpl.getAddress();
  console.log(`ParticipantRegistry implementation deployed to: ${registryImplAddress}`);

  // 2. Deploy VoteSession Implementation
  console.log("Deploying VoteSession implementation...");
  const VoteSession = await hre.ethers.getContractFactory("VoteSession");
  const voteSessionImpl = await VoteSession.deploy();
  await voteSessionImpl.waitForDeployment();
  const voteSessionImplAddress = await voteSessionImpl.getAddress();
  console.log(`VoteSession implementation deployed to: ${voteSessionImplAddress}`);

  // 3. Deploy VoteSessionFactory, passing implementation addresses
  console.log("Deploying VoteSessionFactory...");
  const VoteSessionFactory = await hre.ethers.getContractFactory("VoteSessionFactory");
  const factory = await VoteSessionFactory.deploy(
      deployer.address, // initialOwner
      registryImplAddress,
      voteSessionImplAddress
  );

  // Wait for the factory deployment transaction to be mined
  await factory.waitForDeployment();

  // Log the deployed factory address
  const factoryAddress = await factory.getAddress();
  console.log(`VoteSessionFactory deployed to: ${factoryAddress}`);

  // --- Create and Link First Session Pair ---
  console.log("\nCreating the first session pair via factory...");

  const title = "Test Session 1";
  const description = "This is a deployment script test session.";
  const block = await hre.ethers.provider.getBlock("latest");
  const currentTime = block.timestamp;
  const oneHour = 3600;
  const fifteenMinutes = 900;
  const startDate = currentTime + oneHour; // Start in 1 hour
  const endDate = startDate + oneHour; // Voting lasts 1 hour
  const sharesEndDate = endDate + fifteenMinutes; // Shares submission lasts 15 mins
  const options = ["Option A", "Option B", "Option C"];
  const metadata = JSON.stringify({ hint: "Choose wisely!" });
  const requiredDeposit = hre.ethers.parseEther("0.01"); // 0.01 ETH
  const minShareThreshold = 2;

  // Call createSessionPair
  const tx = await factory.createSessionPair(
      title,
      description,
      startDate,
      endDate,
      sharesEndDate,
      options,
      metadata,
      requiredDeposit,
      minShareThreshold
  );

  // Wait for the transaction to be mined and get the receipt
  const receipt = await tx.wait();
  console.log("createSessionPair transaction hash:", tx.hash);

  // Find the deployed addresses from the event logs
  let registryProxyAddress, voteSessionProxyAddress, sessionId;
  const eventSignature = "SessionPairDeployed(uint256,address,address,address)";
  const eventTopic = hre.ethers.id(eventSignature);

  const log = receipt.logs.find(log => log.topics[0] === eventTopic);

  if (log) {
      const decodedLog = factory.interface.parseLog(log);
      sessionId = decodedLog.args.sessionId;
      voteSessionProxyAddress = decodedLog.args.voteSessionContract;
      registryProxyAddress = decodedLog.args.participantRegistryContract;
      console.log(`Session Pair Deployed:`);
      console.log(`  Session ID: ${sessionId.toString()}`);
      console.log(`  VoteSession Proxy Address: ${voteSessionProxyAddress}`);
      console.log(`  ParticipantRegistry Proxy Address: ${registryProxyAddress}`);
  } else {
      console.error("Could not find SessionPairDeployed event in transaction logs!");
      process.exit(1);
  }

  // 4. Link the Registry to the Session Contract
  console.log("\nLinking ParticipantRegistry to VoteSession...");
  // Get an instance of the ParticipantRegistry proxy contract
  const registryProxy = await hre.ethers.getContractAt("ParticipantRegistry", registryProxyAddress);

  const linkTx = await registryProxy.setVoteSessionContract(sessionId, voteSessionProxyAddress);
  await linkTx.wait();
  console.log(`Registry linked to Session contract. Tx hash: ${linkTx.hash}`);

  console.log("\nDeployment and initial session creation complete.");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 
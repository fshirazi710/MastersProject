const hre = require("hardhat");

async function main() {
  // Get the deployer signer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get the ContractFactory for VoteSessionFactory
  const VoteSessionFactory = await hre.ethers.getContractFactory("VoteSessionFactory");

  // Deploy the factory, passing the deployer's address as the initial owner
  const factory = await VoteSessionFactory.deploy(deployer.address);

  // Wait for the deployment transaction to be mined
  await factory.waitForDeployment();

  // Log the deployed factory address
  const factoryAddress = await factory.getAddress();
  console.log(`VoteSessionFactory deployed to: ${factoryAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 
const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

const abi = JSON.parse(fs.readFileSync("./build/contracts/TimedReleaseVoting.json")).abi;
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const contract = new ethers.Contract(contractAddress, abi, signer);

// print all events
async function printAllEvents() {
  const events = await contract.queryFilter("*", 0, "latest");
  for (const e of events) {
    console.log(`🟢 ${e.event}:`, e.args);
  }
}

async function main() {
  try {
    await contract.callStatic.withdraw();
  } catch (err) {
    console.error("Transaction would revert with reason:", err.reason);
  }
  
  await printAllEvents();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
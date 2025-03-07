const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
require('dotenv').config();

// Check if .env file exists with required variables
if (!process.env.PRIVATE_KEY || !process.env.WEB3_PROVIDER_URL) {
    console.error('Error: Missing environment variables. Please create a .env file with PRIVATE_KEY and WEB3_PROVIDER_URL.');
    process.exit(1);
}

// Load contract data
const contractBuildPath = path.resolve(__dirname, 'build', 'contracts', 'TimedReleaseVoting.json');
if (!fs.existsSync(contractBuildPath)) {
    console.error('Error: Contract build file not found. Please run compile.js first.');
    process.exit(1);
}

const contractData = JSON.parse(fs.readFileSync(contractBuildPath, 'utf8'));
const { abi, bytecode } = contractData;

// Initialize Web3
const web3 = new Web3(process.env.WEB3_PROVIDER_URL);
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Deploy the contract
async function deploy() {
    console.log('Deploying contract...');
    console.log(`From account: ${account.address}`);
    
    try {
        // Get the network ID
        const networkId = await web3.eth.net.getId();
        console.log(`Network ID: ${networkId}`);
        
        // Create contract instance
        const contract = new web3.eth.Contract(abi);
        
        // Estimate gas
        const gas = await contract.deploy({
            data: '0x' + bytecode
        }).estimateGas({ from: account.address });
        
        console.log(`Estimated gas: ${gas}`);
        
        // Deploy contract
        const deployedContract = await contract.deploy({
            data: '0x' + bytecode
        }).send({
            from: account.address,
            gas,
            gasPrice: await web3.eth.getGasPrice()
        });
        
        console.log('Contract deployed successfully!');
        console.log(`Contract address: ${deployedContract.options.address}`);
        
        // Save deployment info
        const deploymentInfo = {
            network: networkId,
            address: deployedContract.options.address,
            deployer: account.address,
            timestamp: new Date().toISOString(),
            transactionHash: deployedContract.transactionHash
        };
        
        const deploymentPath = path.resolve(__dirname, 'build', 'deployment.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log(`Deployment info saved to ${deploymentPath}`);
        
        return deployedContract;
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
deploy().then(() => {
    console.log('Deployment process completed.');
    process.exit(0);
}).catch(error => {
    console.error('Deployment process failed:', error);
    process.exit(1);
}); 
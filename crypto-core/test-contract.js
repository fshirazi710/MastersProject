const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
require('dotenv').config();

// Check if .env file exists with required variables
if (!process.env.PRIVATE_KEY || !process.env.WEB3_PROVIDER_URL) {
    console.error('Error: Missing environment variables. Please create a .env file with PRIVATE_KEY and WEB3_PROVIDER_URL.');
    process.exit(1);
}

// Load deployment info
const deploymentPath = path.resolve(__dirname, 'build', 'deployment.json');
if (!fs.existsSync(deploymentPath)) {
    console.error('Error: Deployment info not found. Please deploy the contract first.');
    process.exit(1);
}

const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const contractAddress = deploymentInfo.address;

// Load contract ABI
const contractBuildPath = path.resolve(__dirname, 'build', 'contracts', 'TimedReleaseVoting.json');
const contractData = JSON.parse(fs.readFileSync(contractBuildPath, 'utf8'));
const { abi } = contractData;

// Initialize Web3
const web3 = new Web3(process.env.WEB3_PROVIDER_URL);

// Set up accounts
const account0 = web3.eth.accounts.privateKeyToAccount('0x' + process.env.PRIVATE_KEY);
web3.eth.accounts.wallet.add(account0);

// Create additional accounts for testing
const account1 = web3.eth.accounts.privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const account2 = web3.eth.accounts.privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
const account3 = web3.eth.accounts.privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
web3.eth.accounts.wallet.add(account1);
web3.eth.accounts.wallet.add(account2);
web3.eth.accounts.wallet.add(account3);

// Initialize contract
const contract = new web3.eth.Contract(abi, contractAddress);

// Helper function to handle errors
async function executeWithErrorHandling(description, func) {
    try {
        console.log(`Executing: ${description}...`);
        const result = await func();
        console.log(`✅ ${description} completed successfully.`);
        return result;
    } catch (error) {
        console.error(`❌ Error in ${description}:`, error.message);
        throw error;
    }
}

// Test functions
async function testContract() {
    try {
        console.log('=== Testing Contract Interaction ===');
        console.log(`Contract address: ${contractAddress}`);
        
        // Get the required deposit
        const requiredDeposit = await executeWithErrorHandling(
            'Get required deposit',
            () => contract.methods.requiredDeposit().call()
        );
        console.log(`Required deposit: ${web3.utils.fromWei(requiredDeposit, 'ether')} ETH`);
        
        // Join as holders
        console.log('\n=== Joining as Holders ===');
        
        // Generate mock public keys for testing - using strings that will be converted to BigNumber
        const publicKey1 = ['123456789', '987654321'];
        const publicKey2 = ['111222333', '444555666'];
        const publicKey3 = ['999888777', '666555444'];
        
        // Join as holder 1
        await executeWithErrorHandling(
            `Account 1 (${account1.address}) joining as holder`,
            () => contract.methods.joinAsHolder(publicKey1).send({
                from: account1.address,
                value: requiredDeposit,
                gas: 500000
            })
        );
        
        // Join as holder 2
        await executeWithErrorHandling(
            `Account 2 (${account2.address}) joining as holder`,
            () => contract.methods.joinAsHolder(publicKey2).send({
                from: account2.address,
                value: requiredDeposit,
                gas: 500000
            })
        );
        
        // Join as holder 3
        await executeWithErrorHandling(
            `Account 3 (${account3.address}) joining as holder`,
            () => contract.methods.joinAsHolder(publicKey3).send({
                from: account3.address,
                value: requiredDeposit,
                gas: 500000
            })
        );
        
        // Get number of holders
        const numHolders = await executeWithErrorHandling(
            'Get number of holders',
            () => contract.methods.getNumHolders().call()
        );
        console.log(`Number of holders: ${numHolders}`);
        
        // Get all holders
        const holders = await executeWithErrorHandling(
            'Get all holders',
            () => contract.methods.getHolders().call()
        );
        console.log('Holders:', holders);
        
        // Submit a vote
        console.log('\n=== Submitting a Vote ===');
        const ciphertext = web3.utils.asciiToHex('Encrypted vote data');
        const nonce = web3.utils.asciiToHex('Nonce');
        const decryptionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const g2r = ['123456', '654321']; // Using strings instead of toBN
        
        await executeWithErrorHandling(
            'Submit vote',
            () => contract.methods.submitVote(ciphertext, nonce, decryptionTime, g2r).send({
                from: account0.address,
                gas: 500000
            })
        );
        
        console.log(`Vote submitted with decryption time: ${new Date(decryptionTime * 1000).toLocaleString()}`);
        
        // Get vote data
        const voteId = 0;
        const voteData = await executeWithErrorHandling(
            `Get vote data for ID ${voteId}`,
            () => contract.methods.getVote(voteId).call()
        );
        
        console.log('\n=== Vote Data ===');
        console.log(`Ciphertext: ${web3.utils.hexToAscii(voteData.ciphertext)}`);
        console.log(`Nonce: ${web3.utils.hexToAscii(voteData.nonce)}`);
        console.log(`Decryption time: ${new Date(parseInt(voteData.decryptionTime) * 1000).toLocaleString()}`);
        console.log(`G2R: [${voteData.g2r[0]}, ${voteData.g2r[1]}]`);
        
        console.log('\n=== Contract Interaction Test Completed Successfully! ===');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testContract().then(() => {
    console.log('\n✅ All tests completed successfully.');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
}); 
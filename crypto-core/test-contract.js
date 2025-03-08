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
        
        // Get initial balances
        const initialBalance1 = await web3.eth.getBalance(account1.address);
        const initialBalance2 = await web3.eth.getBalance(account2.address);
        const initialBalance3 = await web3.eth.getBalance(account3.address);

        console.log(`Account 1 initial balance: ${web3.utils.fromWei(initialBalance1, 'ether')} ETH`);
        console.log(`Account 2 initial balance: ${web3.utils.fromWei(initialBalance2, 'ether')} ETH`);
        console.log(`Account 3 initial balance: ${web3.utils.fromWei(initialBalance3, 'ether')} ETH`);

        // Check if accounts are already holders
        const isHolder1 = await contract.methods.isHolder(account1.address).call();
        const isHolder2 = await contract.methods.isHolder(account2.address).call();
        const isHolder3 = await contract.methods.isHolder(account3.address).call();

        console.log(`\nAccount 1 is already a holder: ${isHolder1}`);
        console.log(`Account 2 is already a holder: ${isHolder2}`);
        console.log(`Account 3 is already a holder: ${isHolder3}`);

        // Join as holder 1 if not already a holder
        if (!isHolder1) {
            await executeWithErrorHandling(
                `Account 1 (${account1.address}) joining as holder`,
                () => contract.methods.joinAsHolder(publicKey1).send({
                    from: account1.address,
                    value: requiredDeposit,
                    gas: 500000
                })
            );
        } else {
            console.log(`Account 1 (${account1.address}) is already a holder, skipping join.`);
        }

        // Join as holder 2 if not already a holder
        if (!isHolder2) {
            await executeWithErrorHandling(
                `Account 2 (${account2.address}) joining as holder`,
                () => contract.methods.joinAsHolder(publicKey2).send({
                    from: account2.address,
                    value: requiredDeposit,
                    gas: 500000
                })
            );
        } else {
            console.log(`Account 2 (${account2.address}) is already a holder, skipping join.`);
        }

        // Join as holder 3 if not already a holder
        if (!isHolder3) {
            await executeWithErrorHandling(
                `Account 3 (${account3.address}) joining as holder`,
                () => contract.methods.joinAsHolder(publicKey3).send({
                    from: account3.address,
                    value: requiredDeposit,
                    gas: 500000
                })
            );
        } else {
            console.log(`Account 3 (${account3.address}) is already a holder, skipping join.`);
        }
        
        // Get balances after joining
        const afterJoinBalance1 = await web3.eth.getBalance(account1.address);
        const afterJoinBalance2 = await web3.eth.getBalance(account2.address);
        const afterJoinBalance3 = await web3.eth.getBalance(account3.address);

        console.log(`\nAccount 1 balance after joining: ${web3.utils.fromWei(afterJoinBalance1, 'ether')} ETH`);
        console.log(`Account 2 balance after joining: ${web3.utils.fromWei(afterJoinBalance2, 'ether')} ETH`);
        console.log(`Account 3 balance after joining: ${web3.utils.fromWei(afterJoinBalance3, 'ether')} ETH`);

        // Calculate and display the differences (including gas costs)
        const diff1 = web3.utils.fromWei(web3.utils.toBN(initialBalance1).sub(web3.utils.toBN(afterJoinBalance1)), 'ether');
        const diff2 = web3.utils.fromWei(web3.utils.toBN(initialBalance2).sub(web3.utils.toBN(afterJoinBalance2)), 'ether');
        const diff3 = web3.utils.fromWei(web3.utils.toBN(initialBalance3).sub(web3.utils.toBN(afterJoinBalance3)), 'ether');

        console.log(`\nAccount 1 spent: ${diff1} ETH (1 ETH deposit + gas)`);
        console.log(`Account 2 spent: ${diff2} ETH (1 ETH deposit + gas)`);
        console.log(`Account 3 spent: ${diff3} ETH (1 ETH deposit + gas)`);

        // Get contract balance to verify deposits are held in the contract
        const contractBalance = await web3.eth.getBalance(contractAddress);
        console.log(`\nContract balance: ${web3.utils.fromWei(contractBalance, 'ether')} ETH`);

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

        // Get current blockchain time
        const currentBlockTime = await web3.eth.getBlock('latest').then(block => block.timestamp);
        console.log(`Current blockchain time: ${new Date(currentBlockTime * 1000).toLocaleString()}`);

        const ciphertext = web3.utils.asciiToHex('Encrypted vote data');
        const nonce = web3.utils.asciiToHex('Nonce');
        const decryptionTime = currentBlockTime + 3600; // 1 hour from current blockchain time
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
        
        // Advance blockchain time past decryption time for testing share submission
        await executeWithErrorHandling(
            'Advance blockchain time past decryption time',
            async () => {
                // Advance time by 2 hours (7200 seconds) to ensure we're past the decryption time
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_increaseTime',
                    params: [7200],
                    id: new Date().getTime()
                }, () => {});
                
                // Mine a new block to update the blockchain
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: new Date().getTime()
                }, () => {});
                
                return true;
            }
        );

        // Test isHolder
        const isHolder = await executeWithErrorHandling(
            `Check if account1 is a holder`,
            () => contract.methods.isHolder(account1.address).call()
        );
        console.log(`Is account1 a holder? ${isHolder}`);

        // Test submitShare after decryption time
        await executeWithErrorHandling(
            `Account 1 (${account1.address}) submitting share for vote 0`,
            () => contract.methods.submitShare(0, 789, 101).send({
                from: account1.address,
                gas: 500000
            })
        );

        await executeWithErrorHandling(
            `Account 2 (${account2.address}) submitting share for vote 0`,
            () => contract.methods.submitShare(0, 123, 456).send({
                from: account2.address,
                gas: 500000
            })
        );

        // Test getSubmittedShares
        const shares = await executeWithErrorHandling(
            'Get submitted shares for vote 0',
            () => contract.methods.getSubmittedShares(0).call()
        );
        console.log('Share submitters for vote 0:', shares.submitters);
        console.log('Shares for vote 0:', shares.shares);
        
        // Test reward distribution
        console.log('\n=== Testing Reward Distribution ===');

        // Get current blockchain time
        const updatedBlockTime = await web3.eth.getBlock('latest').then(block => block.timestamp);
        console.log(`Updated blockchain time: ${new Date(updatedBlockTime * 1000).toLocaleString()}`);

        // Submit a vote with a reward
        const rewardAmount = web3.utils.toWei('0.3', 'ether'); // 0.3 ETH reward
        await executeWithErrorHandling(
            'Submit vote with reward',
            () => contract.methods.submitVote(
                web3.utils.asciiToHex('Encrypted vote with reward'),
                web3.utils.asciiToHex('Nonce2'),
                updatedBlockTime + 3600, // 1 hour from current blockchain time
                ['111222', '333444']
            ).send({
                from: account0.address,
                value: rewardAmount,
                gas: 500000
            })
        );

        // Advance time to reach decryption time
        await executeWithErrorHandling(
            'Advance blockchain time past decryption time for reward test',
            async () => {
                // Advance time by 2 hours (7200 seconds) to ensure we're past the decryption time
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_increaseTime',
                    params: [7200],
                    id: new Date().getTime()
                }, () => {});
                
                // Mine a new block to update the blockchain
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: new Date().getTime()
                }, () => {});
                
                return true;
            }
        );

        // Submit shares from account1 and account2 for vote 1, but not account3
        await executeWithErrorHandling(
            `Account 1 (${account1.address}) submitting share for vote 1`,
            () => contract.methods.submitShare(1, 111, 222).send({
                from: account1.address,
                gas: 500000
            })
        );

        await executeWithErrorHandling(
            `Account 2 (${account2.address}) submitting share for vote 1`,
            () => contract.methods.submitShare(1, 333, 444).send({
                from: account2.address,
                gas: 500000
            })
        );

        // Account 3 does not submit a share for vote 1

        // Test getSubmittedShares for vote 1
        const sharesVote1 = await executeWithErrorHandling(
            'Get submitted shares for vote 1',
            () => contract.methods.getSubmittedShares(1).call()
        );
        console.log('\nShare submitters for vote 1:', sharesVote1.submitters);
        console.log('Shares for vote 1:', sharesVote1.shares);

        // Advance time by another hour to meet the requirement for triggerRewardDistribution
        await executeWithErrorHandling(
            'Advance blockchain time by another hour',
            async () => {
                // Advance time by 1 hour (3600 seconds)
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_increaseTime',
                    params: [3600],
                    id: new Date().getTime()
                }, () => {});
                
                // Mine a new block to update the blockchain
                await web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: new Date().getTime()
                }, () => {});
                
                return true;
            }
        );

        // Manually trigger reward distribution
        await executeWithErrorHandling(
            'Trigger reward distribution for vote 1',
            () => contract.methods.triggerRewardDistribution(1).send({
                from: account0.address,
                gas: 500000
            })
        );

        // Check rewards for each holder
        const reward1 = await executeWithErrorHandling(
            `Get rewards for Account 1`,
            () => contract.methods.getHolderRewards(account1.address).call()
        );

        const reward2 = await executeWithErrorHandling(
            `Get rewards for Account 2`,
            () => contract.methods.getHolderRewards(account2.address).call()
        );

        const reward3 = await executeWithErrorHandling(
            `Get rewards for Account 3`,
            () => contract.methods.getHolderRewards(account3.address).call()
        );

        console.log(`\nAccount 1 rewards: ${web3.utils.fromWei(reward1, 'ether')} ETH`);
        console.log(`Account 2 rewards: ${web3.utils.fromWei(reward2, 'ether')} ETH`);
        console.log(`Account 3 rewards: ${web3.utils.fromWei(reward3, 'ether')} ETH (should be 0 since they didn't submit a share)`);

        // Get the vote reward amount to verify
        const voteReward = await executeWithErrorHandling(
            `Get reward amount for vote 1`,
            () => contract.methods.getVoteReward(1).call()
        );
        console.log(`\nVote 1 reward pool: ${web3.utils.fromWei(voteReward, 'ether')} ETH`);
        console.log(`Each submitter's share (${web3.utils.fromWei(voteReward, 'ether')} ETH / 2 submitters): ${web3.utils.fromWei(web3.utils.toBN(voteReward).div(web3.utils.toBN(2)), 'ether')} ETH`);

        // Test forceExitHolder for account3 who didn't submit a share
        console.log('\n=== Testing Force Exit Holder ===');

        // Force exit account3
        await executeWithErrorHandling(
            `Force exit Account 3 (${account3.address}) who didn't submit a share for vote 1`,
            () => contract.methods.forceExitHolder(account3.address, 1).send({
                from: account0.address,
                gas: 500000
            })
        );

        // Verify account3 is no longer a holder
        const isHolder3AfterForceExit = await executeWithErrorHandling(
            `Check if account3 is still a holder after force exit`,
            () => contract.methods.isHolder(account3.address).call()
        );
        console.log(`Is account3 still a holder? ${isHolder3AfterForceExit} (should be false)`);

        // Claim rewards for Account 1
        await executeWithErrorHandling(
            `Account 1 (${account1.address}) claiming rewards`,
            () => contract.methods.claimRewards().send({
                from: account1.address,
                gas: 500000
            })
        );

        // Check balance after claiming rewards
        const balanceAfterClaim = await web3.eth.getBalance(account1.address);
        console.log(`\nAccount 1 balance after claiming rewards: ${web3.utils.fromWei(balanceAfterClaim, 'ether')} ETH`);

        // Verify rewards are reset to 0 after claiming
        const rewardAfterClaim = await executeWithErrorHandling(
            `Get rewards for Account 1 after claiming`,
            () => contract.methods.getHolderRewards(account1.address).call()
        );
        console.log(`Account 1 rewards after claiming: ${web3.utils.fromWei(rewardAfterClaim, 'ether')} ETH (should be 0)`);

        // Test exitAsHolder functionality
        console.log('\n=== Testing Exit as Holder ===');

        // Exit as holder for Account 1
        await executeWithErrorHandling(
            `Account 1 (${account1.address}) exiting as holder`,
            () => contract.methods.exitAsHolder().send({
                from: account1.address,
                gas: 500000
            })
        );

        // Check balance after exiting to verify deposit was returned
        const balanceAfterExit = await web3.eth.getBalance(account1.address);
        console.log(`\nAccount 1 balance after exiting: ${web3.utils.fromWei(balanceAfterExit, 'ether')} ETH`);
        console.log(`Deposit returned: ${web3.utils.fromWei(web3.utils.toBN(balanceAfterExit).sub(web3.utils.toBN(balanceAfterClaim)), 'ether')} ETH (minus gas)`);

        // Verify account is no longer a holder
        const isHolderAfterExit = await executeWithErrorHandling(
            `Check if account1 is still a holder after exiting`,
            () => contract.methods.isHolder(account1.address).call()
        );
        console.log(`Is account1 still a holder? ${isHolderAfterExit} (should be false)`);

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
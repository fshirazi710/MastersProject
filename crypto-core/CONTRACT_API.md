# TimedReleaseVoting Contract API Documentation

This document provides a comprehensive guide to the functions and access points of the TimedReleaseVoting smart contract for backend integration.

## Contract Overview

The TimedReleaseVoting contract implements a timed-release cryptography system where:

1. Secret holders register by staking a deposit
2. Clients submit encrypted votes with a specified decryption time
3. Secret holders submit their shares after the decryption time
4. Rewards are distributed to secret holders who submitted their shares
5. Secret holders can exit and withdraw their deposit after fulfilling their obligations

## Constants

- `REQUIRED_DEPOSIT`: 1 ETH - The amount required to become a secret holder
- `MIN_HOLDERS`: 3 - The minimum number of holders required for a vote
- `REWARD_PER_VOTE`: 0.1 ETH - The default reward amount per vote (if no custom amount is provided)

## Functions for Secret Holders

### `joinAsHolder(uint256[2] memory publicKey)`

Allows an address to register as a secret holder by staking a deposit.

**Parameters:**
- `publicKey`: BLS12-381 G1 point (x, y) representing the holder's public key

**Requirements:**
- Must send at least `REQUIRED_DEPOSIT` ETH with the transaction
- Cannot already be a registered holder

**Example:**
```javascript
const publicKey = ['123456789', '987654321']; // Replace with actual BLS public key
await contract.methods.joinAsHolder(publicKey).send({
    from: holderAddress,
    value: web3.utils.toWei('1', 'ether'),
    gas: 500000
});
```

### `submitShare(uint256 voteId, uint256 shareIndex, uint256 shareValue)`

Allows a registered holder to submit their share for a vote after the decryption time.

**Parameters:**
- `voteId`: The ID of the vote
- `shareIndex`: The index of the share
- `shareValue`: The value of the share

**Requirements:**
- Must be a registered holder
- Vote must exist
- Current time must be after the vote's decryption time

**Example:**
```javascript
await contract.methods.submitShare(voteId, shareIndex, shareValue).send({
    from: holderAddress,
    gas: 500000
});
```

### `claimRewards()`

Allows a holder to claim their accumulated rewards.

**Requirements:**
- Must be a registered holder
- Must have rewards to claim

**Example:**
```javascript
await contract.methods.claimRewards().send({
    from: holderAddress,
    gas: 500000
});
```

### `exitAsHolder()`

Allows a holder to exit and withdraw their deposit after fulfilling all obligations.

**Requirements:**
- Must be a registered holder
- Must have submitted shares for all past votes
- Cannot have pending future votes

**Example:**
```javascript
await contract.methods.exitAsHolder().send({
    from: holderAddress,
    gas: 500000
});
```

## Functions for Clients

### `submitVote(bytes calldata ciphertext, bytes calldata nonce, uint256 decryptionTime, uint256[2] calldata g2r)`

Allows a client to submit an encrypted vote with a specified decryption time.

**Parameters:**
- `ciphertext`: The encrypted vote data
- `nonce`: The encryption nonce
- `decryptionTime`: The time when the vote can be decrypted (Unix timestamp)
- `g2r`: BLS12-381 G2 point for verification

**Requirements:**
- Must have at least `MIN_HOLDERS` registered holders
- Decryption time must be in the future

**Example:**
```javascript
const ciphertext = web3.utils.asciiToHex('Encrypted vote data');
const nonce = web3.utils.asciiToHex('Nonce');
const decryptionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const g2r = ['123456', '654321']; // Replace with actual G2 point
const rewardAmount = web3.utils.toWei('0.3', 'ether'); // Custom reward amount

await contract.methods.submitVote(ciphertext, nonce, decryptionTime, g2r).send({
    from: clientAddress,
    value: rewardAmount, // Optional: custom reward amount
    gas: 500000
});
```

### `triggerRewardDistribution(uint256 voteId)`

Allows anyone to trigger reward distribution for a vote after a waiting period.

**Parameters:**
- `voteId`: The ID of the vote

**Requirements:**
- Vote must exist
- Current time must be at least 1 hour after the vote's decryption time
- Rewards must not have been distributed yet
- At least one holder must have submitted a share

**Example:**
```javascript
await contract.methods.triggerRewardDistribution(voteId).send({
    from: anyAddress,
    gas: 500000
});
```

### `forceExitHolder(address holderAddress, uint256 voteId)`

Allows anyone to force exit a holder who failed to submit a share for a vote.

**Parameters:**
- `holderAddress`: The address of the holder to force exit
- `voteId`: The ID of the vote for which the holder failed to submit a share

**Requirements:**
- Vote must exist
- Current time must be after the vote's decryption time
- Holder must be active
- Holder must not have submitted a share for the vote

**Example:**
```javascript
await contract.methods.forceExitHolder(holderAddress, voteId).send({
    from: anyAddress,
    gas: 500000
});
```

## View Functions

### `getNumHolders()`

Returns the number of registered holders.

**Example:**
```javascript
const numHolders = await contract.methods.getNumHolders().call();
```

### `getHolders()`

Returns an array of all registered holder addresses.

**Example:**
```javascript
const holders = await contract.methods.getHolders().call();
```

### `getHolderPublicKey(address holderAddress)`

Returns the public key of a holder.

**Parameters:**
- `holderAddress`: The address of the holder

**Example:**
```javascript
const publicKey = await contract.methods.getHolderPublicKey(holderAddress).call();
```

### `isHolder(address holderAddress)`

Checks if an address is a registered holder.

**Parameters:**
- `holderAddress`: The address to check

**Example:**
```javascript
const isHolder = await contract.methods.isHolder(holderAddress).call();
```

### `getVote(uint256 voteId)`

Returns the data for a vote.

**Parameters:**
- `voteId`: The ID of the vote

**Returns:**
- `ciphertext`: The encrypted vote data
- `nonce`: The encryption nonce
- `decryptionTime`: The time when the vote can be decrypted
- `g2r`: The G2 point used for verification

**Example:**
```javascript
const voteData = await contract.methods.getVote(voteId).call();
console.log(`Decryption time: ${new Date(voteData.decryptionTime * 1000).toLocaleString()}`);
```

### `getSubmittedShares(uint256 voteId)`

Returns the submitted shares for a vote.

**Parameters:**
- `voteId`: The ID of the vote

**Returns:**
- `submitters`: Array of holder addresses that submitted shares
- `shares`: Array of shares submitted by holders

**Example:**
```javascript
const sharesData = await contract.methods.getSubmittedShares(voteId).call();
console.log('Share submitters:', sharesData.submitters);
console.log('Shares:', sharesData.shares);
```

### `getHolderRewards(address holderAddress)`

Returns the accumulated rewards for a holder.

**Parameters:**
- `holderAddress`: The address of the holder

**Example:**
```javascript
const rewards = await contract.methods.getHolderRewards(holderAddress).call();
console.log(`Rewards: ${web3.utils.fromWei(rewards, 'ether')} ETH`);
```

### `getVoteReward(uint256 voteId)`

Returns the reward amount for a vote.

**Parameters:**
- `voteId`: The ID of the vote

**Example:**
```javascript
const reward = await contract.methods.getVoteReward(voteId).call();
console.log(`Vote reward: ${web3.utils.fromWei(reward, 'ether')} ETH`);
```

### `requiredDeposit()`

Returns the required deposit amount to become a holder.

**Example:**
```javascript
const deposit = await contract.methods.requiredDeposit().call();
console.log(`Required deposit: ${web3.utils.fromWei(deposit, 'ether')} ETH`);
```

## Events

The contract emits the following events that can be monitored by the backend:

### `HolderJoined(address indexed holderAddress, uint256[2] publicKey)`

Emitted when a new holder joins.

### `HolderExited(address indexed holderAddress)`

Emitted when a holder exits.

### `VoteSubmitted(uint256 indexed voteId, uint256 decryptionTime)`

Emitted when a new vote is submitted.

### `ShareSubmitted(uint256 indexed voteId, address indexed holderAddress)`

Emitted when a holder submits a share.

### `RewardDistributed(uint256 indexed voteId, uint256 totalReward, uint256 numRecipients)`

Emitted when rewards are distributed for a vote.

### `RewardClaimed(address indexed holderAddress, uint256 amount)`

Emitted when a holder claims rewards.

## Integration Flow Examples

### Client Submitting a Vote

```javascript
// 1. Prepare vote data
const ciphertext = web3.utils.asciiToHex('Encrypted vote data');
const nonce = web3.utils.asciiToHex('Nonce');
const decryptionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const g2r = ['123456', '654321']; // Replace with actual G2 point
const rewardAmount = web3.utils.toWei('0.3', 'ether'); // Custom reward amount

// 2. Submit vote
const receipt = await contract.methods.submitVote(ciphertext, nonce, decryptionTime, g2r).send({
    from: clientAddress,
    value: rewardAmount,
    gas: 500000
});

// 3. Get vote ID from event
const voteId = receipt.events.VoteSubmitted.returnValues.voteId;
console.log(`Vote submitted with ID: ${voteId}`);
```

### Secret Holder Workflow

```javascript
// 1. Join as holder
await contract.methods.joinAsHolder(publicKey).send({
    from: holderAddress,
    value: web3.utils.toWei('1', 'ether'),
    gas: 500000
});

// 2. Listen for new votes
contract.events.VoteSubmitted({}, (error, event) => {
    if (error) {
        console.error('Error listening for votes:', error);
        return;
    }
    
    const voteId = event.returnValues.voteId;
    const decryptionTime = event.returnValues.decryptionTime;
    console.log(`New vote ${voteId} with decryption time ${new Date(decryptionTime * 1000).toLocaleString()}`);
    
    // Schedule share submission after decryption time
    const submitTime = decryptionTime * 1000 - Date.now() + 60000; // 1 minute after decryption time
    setTimeout(() => submitShare(voteId), submitTime);
});

// 3. Submit share function
async function submitShare(voteId) {
    // Calculate share (implementation depends on your cryptographic protocol)
    const shareIndex = 123;
    const shareValue = 456;
    
    try {
        await contract.methods.submitShare(voteId, shareIndex, shareValue).send({
            from: holderAddress,
            gas: 500000
        });
        console.log(`Share submitted for vote ${voteId}`);
    } catch (error) {
        console.error(`Error submitting share for vote ${voteId}:`, error);
    }
}

// 4. Periodically claim rewards
async function claimRewards() {
    try {
        const rewards = await contract.methods.getHolderRewards(holderAddress).call();
        if (rewards > 0) {
            await contract.methods.claimRewards().send({
                from: holderAddress,
                gas: 500000
            });
            console.log(`Claimed ${web3.utils.fromWei(rewards, 'ether')} ETH in rewards`);
        }
    } catch (error) {
        console.error('Error claiming rewards:', error);
    }
}
```

## Security Considerations

1. **Deposit Management**: Ensure your backend properly tracks deposit status for holders.
2. **Timing**: Implement proper timing mechanisms to submit shares after decryption time.
3. **Error Handling**: Handle contract errors gracefully, especially for transactions that may revert.
4. **Gas Estimation**: Always estimate gas before sending transactions to avoid failures.
5. **Event Monitoring**: Set up reliable event monitoring to catch all relevant contract events.
6. **Backup Mechanisms**: Implement backup mechanisms for share submission in case of network issues.

## Troubleshooting

1. **"Already a holder" Error**: Address is already registered as a holder.
2. **"Insufficient deposit" Error**: Not enough ETH sent with joinAsHolder transaction.
3. **"Decryption time not reached" Error**: Trying to submit a share before the decryption time.
4. **"Must submit shares for all past votes" Error**: Holder trying to exit without submitting shares for all past votes.
5. **"No rewards to claim" Error**: Holder trying to claim rewards when they have none.
6. **"Cannot exit with pending future votes" Error**: Holder trying to exit when they have future votes to participate in. 
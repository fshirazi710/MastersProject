# Backend Services Documentation

This document provides a guide to the core services used in the backend application for the Timed-Release Cryptography system.

## Table of Contents

1. [BlockchainService](#blockchainservice)
2. [CryptoService](#cryptoservice)
3. [Integration Examples](#integration-examples)
4. [Error Handling](#error-handling)

## BlockchainService

The `BlockchainService` handles all interactions with the TimedReleaseVoting smart contract on the blockchain.

### Initialization

```python
from app.services.blockchain import BlockchainService
from app.core.dependencies import get_blockchain_service

# Using dependency injection (recommended)
blockchain_service = get_blockchain_service()
```

### Holder Management

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `join_as_holder(deposit_amount)` | Join as a secret holder | `deposit_amount`: ETH to deposit | Dict with transaction hash and holder info |
| `exit_as_holder()` | Exit and withdraw deposit | None | Dict with transaction status |
| `force_exit_holder(holder_address, vote_id)` | Force exit a holder who failed to submit a share | `holder_address`: Address to exit<br>`vote_id`: Vote ID | Dict with transaction status |
| `verify_holder_status(address)` | Check if address is a registered holder | `address`: Address to check | Boolean |
| `get_required_deposit()` | Get required deposit amount | None | Float (ETH amount) |

### Vote Management

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `submit_vote(vote_data, decryption_time, reward_amount, threshold)` | Submit encrypted vote | `vote_data`: Vote data (bytes)<br>`decryption_time`: Unix timestamp<br>`reward_amount`: ETH reward (default: 0.1)<br>`threshold`: Min shares needed (default: 2/3 of holders) | Dict with vote ID, transaction hash, and threshold |
| `get_vote_data(vote_id)` | Get encrypted vote data | `vote_id`: Vote ID | Dict with vote data and metadata |
| `decrypt_vote(vote_id, threshold)` | Decrypt a vote | `vote_id`: Vote ID<br>`threshold`: Min shares (optional, defaults to contract-stored threshold) | Dict with decrypted data |

### Share Management

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `submit_share(vote_id, share)` | Submit a share | `vote_id`: Vote ID<br>`share`: Tuple (index, value) | Dict with transaction status |
| `get_share_status(vote_id)` | Get status of all shares | `vote_id`: Vote ID | Dict with share submission status |
| `verify_share_submission(vote_id, holder_address, share)` | Verify share validity | `vote_id`: Vote ID<br>`holder_address`: Holder address<br>`share`: Share to verify | Boolean |

### Reward Management

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `trigger_reward_distribution(vote_id)` | Trigger reward distribution | `vote_id`: Vote ID | Dict with transaction status |
| `claim_rewards()` | Claim accumulated rewards | None | Dict with claimed amount |
| `get_holder_rewards(holder_address)` | Get holder's rewards | `holder_address`: Holder address | Float (ETH amount) |

## CryptoService

The `CryptoService` provides cryptographic operations for the timed-release system.

### Initialization

```python
from app.services.crypto import CryptoService
from app.core.dependencies import get_crypto_service

# Using dependency injection (recommended)
crypto_service = get_crypto_service()
```

### Key Operations

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `generate_keypair()` | Generate BLS12-381 keypair | None | Tuple (private_key, public_key) |
| `scalar_to_g1_point(scalar)` | Convert scalar to G1 point | `scalar`: Integer | G1 point |
| `scalar_to_g2_point(scalar)` | Convert scalar to G2 point | `scalar`: Integer | G2 point |

### Secret Sharing

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `generate_shares(secret, num_shares, threshold)` | Generate secret shares | `secret`: Secret to share<br>`num_shares`: Number of shares<br>`threshold`: Min shares needed (must be ≥ 2 and ≤ num_shares) | List of (index, share) tuples |
| `reconstruct_secret(shares)` | Reconstruct secret from shares | `shares`: List of (index, share) tuples (must have at least threshold shares) | Reconstructed secret |

### Encryption/Decryption

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `encrypt_vote(vote_data, key)` | Encrypt vote data | `vote_data`: Data to encrypt<br>`key`: Encryption key | Tuple (ciphertext, nonce) |
| `decrypt_vote(ciphertext, key, nonce)` | Decrypt vote data | `ciphertext`: Encrypted data<br>`key`: Decryption key<br>`nonce`: Nonce | Decrypted data |

### Verification

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `verify_share(share, public_key, g2r)` | Verify share validity | `share`: Share to verify<br>`public_key`: Holder's public key<br>`g2r`: G2 point | Boolean |
| `hash_to_scalar(data)` | Hash data to scalar | `data`: Data to hash | Scalar value |

## Integration Examples

### Vote Submission and Decryption Flow

```python
# 1. Submit a vote with custom threshold
result = await blockchain_service.submit_vote(
    vote_data,
    decryption_time,
    reward_amount=0.3,
    threshold=3  # Explicitly set threshold to 3
)
vote_id = result['vote_id']
threshold = result['threshold']
print(f"Vote submitted with threshold: {threshold}")

# 2. Submit shares (by holders)
await blockchain_service.submit_share(vote_id, (1, 111222))
await blockchain_service.submit_share(vote_id, (2, 333444))
await blockchain_service.submit_share(vote_id, (3, 555666))

# 3. Trigger reward distribution
await blockchain_service.trigger_reward_distribution(vote_id)

# 4. Decrypt the vote (using the same threshold)
decrypted = await blockchain_service.decrypt_vote(vote_id)
# OR with explicit threshold override
# decrypted = await blockchain_service.decrypt_vote(vote_id, threshold=3)
```

### Holder Registration and Reward Claiming

```python
# 1. Join as holder
deposit = await blockchain_service.get_required_deposit()
result = await blockchain_service.join_as_holder(deposit)

# 2. Claim rewards
rewards = await blockchain_service.get_holder_rewards(result['holder_address'])
if rewards > 0:
    claim_result = await blockchain_service.claim_rewards()

# 3. Exit as holder
exit_result = await blockchain_service.exit_as_holder()
```

## Threshold Mechanism

The threshold parameter is a critical security feature in the system:

1. **Definition**: The threshold is the minimum number of secret shares needed to reconstruct the secret key and decrypt a vote.

2. **Default Calculation**: If not specified, the threshold defaults to 2/3 of the total number of holders (rounded down), with a minimum of 2.

3. **Storage**: The threshold is stored in the smart contract for each vote, ensuring transparency and immutability.

4. **Usage Flow**:
   - During vote submission, the threshold is set and stored in the contract
   - During decryption, exactly the threshold number of shares are used
   - If fewer than threshold shares are available, decryption fails
   - If more than threshold shares are available, only the first threshold shares are used

5. **Security Implications**:
   - Higher threshold = More security but higher risk of decryption failure
   - Lower threshold = Less security but higher chance of successful decryption
   - Minimum threshold is 2 (required by Shamir's Secret Sharing)
   - Maximum threshold is the number of holders

## Error Handling

Both services use standardized error handling through the `app.core.error_handling` module.

```python
# BlockchainService error handling
try:
    result = await blockchain_service.submit_vote(vote_data, decryption_time, threshold=3)
except HTTPException as e:
    print(f"Error {e.status_code}: {e.detail}")

# CryptoService error handling
try:
    decrypted = crypto_service.decrypt_vote(ciphertext, key, nonce)
except ValueError as e:
    print(f"Decryption error: {str(e)}")
except InvalidTag:
    print("Invalid key or corrupted ciphertext")
```

### Best Practices

1. Always wrap service calls in try-except blocks
2. Use the appropriate error handler for each operation
3. Log errors at the appropriate level
4. Return user-friendly error messages to the client 
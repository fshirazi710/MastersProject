import pytest
import asyncio
import os
import json
from pathlib import Path
from app.services.blockchain import BlockchainService
from app.core.config import settings
from web3 import Web3

# Skip these tests if not in integration test mode
pytestmark = pytest.mark.skipif(
    os.environ.get("INTEGRATION_TESTS") != "1",
    reason="Integration tests are skipped by default. Set INTEGRATION_TESTS=1 to run."
)

@pytest.fixture
def contract_address():
    """Get the contract address from the deployment info"""
    # Path to the deployment info file
    deployment_path = Path(__file__).parent.parent.parent / "crypto-core" / "build" / "deployment.json"
    
    if not deployment_path.exists():
        pytest.skip("Deployment info not found. Please deploy the contract first.")
    
    with open(deployment_path, 'r') as f:
        deployment_info = json.load(f)
    
    return deployment_info["address"]

@pytest.fixture
def blockchain_service(contract_address):
    """Create a blockchain service with the actual deployed contract"""
    # Store original settings
    original_contract_address = settings.CONTRACT_ADDRESS
    
    # Update settings to use the deployed contract
    settings.CONTRACT_ADDRESS = contract_address
    
    # Create the service
    service = BlockchainService()
    
    yield service
    
    # Restore original settings
    settings.CONTRACT_ADDRESS = original_contract_address

@pytest.mark.asyncio
async def test_get_required_deposit(blockchain_service):
    """Test getting the required deposit from the actual contract"""
    print("\n=== Integration Test: Get Required Deposit ===")
    
    # Get the required deposit directly without await
    deposit_wei = blockchain_service.contract.functions.requiredDeposit().call()
    deposit = blockchain_service.w3.from_wei(deposit_wei, 'ether')
    
    print(f"Required deposit: {deposit} ETH")
    
    # Verify the deposit is 1 ETH as defined in the contract
    assert float(deposit) == 1.0, f"Expected deposit to be 1.0 ETH, got {deposit} ETH"

@pytest.mark.asyncio
async def test_get_num_holders(blockchain_service):
    """Test getting the number of holders from the actual contract"""
    print("\n=== Integration Test: Get Number of Holders ===")
    
    # Get the number of holders directly without await
    num_holders = blockchain_service.contract.functions.getNumHolders().call()
    
    print(f"Number of holders: {num_holders}")
    
    # We expect 3 holders from our test-contract.js script
    assert num_holders == 3, f"Expected 3 holders, got {num_holders}"

@pytest.mark.asyncio
async def test_get_holders(blockchain_service):
    """Test getting the list of holders from the actual contract"""
    print("\n=== Integration Test: Get Holders ===")
    
    # Get the holders directly without await
    holders = blockchain_service.contract.functions.getHolders().call()
    
    print(f"Holders: {holders}")
    
    # Verify we have the expected holders from our test-contract.js script
    expected_holders = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Account #1
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",  # Account #2
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906"   # Account #3
    ]
    
    # Check that all expected holders are in the list (case-insensitive comparison)
    for holder in expected_holders:
        assert holder.lower() in [h.lower() for h in holders], f"Expected holder {holder} not found"
    
    assert len(holders) == 3, f"Expected 3 holders, got {len(holders)}"

@pytest.mark.asyncio
async def test_get_vote(blockchain_service):
    """Test getting vote data from the actual contract"""
    print("\n=== Integration Test: Get Vote Data ===")
    
    # Get the vote data directly without await
    vote_id = 0
    vote_data = blockchain_service.contract.functions.getVote(vote_id).call()
    
    print(f"Vote ID: {vote_id}")
    print(f"Ciphertext: {Web3.to_text(vote_data[0]) if vote_data[0] else 'None'}")
    print(f"Nonce: {Web3.to_text(vote_data[1]) if vote_data[1] else 'None'}")
    print(f"Decryption time: {vote_data[2]}")
    print(f"G2R: {vote_data[3]}")
    
    # Verify the vote data matches what we expect from test-contract.js
    assert Web3.to_text(vote_data[0]) == "Encrypted vote data", "Unexpected ciphertext"
    assert Web3.to_text(vote_data[1]) == "Nonce", "Unexpected nonce"
    assert vote_data[2] > 0, "Decryption time should be greater than 0"
    assert len(vote_data[3]) == 2, "G2R should have 2 elements"

@pytest.mark.asyncio
async def test_is_holder(blockchain_service):
    """Test checking if an address is a holder"""
    print("\n=== Integration Test: Is Holder ===")
    
    # Check if Account #1 is a holder directly without await
    account1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    is_holder = blockchain_service.contract.functions.isHolder(account1).call()
    
    print(f"Is {account1} a holder? {is_holder}")
    
    # Verify Account #1 is a holder
    assert is_holder, f"Expected {account1} to be a holder"
    
    # Check if a random address is a holder
    random_address = "0x0000000000000000000000000000000000000000"
    is_holder = blockchain_service.contract.functions.isHolder(random_address).call()
    
    print(f"Is {random_address} a holder? {is_holder}")
    
    # Verify random address is not a holder
    assert not is_holder, f"Expected {random_address} not to be a holder"

@pytest.mark.asyncio
async def test_get_holder_public_key(blockchain_service):
    """Test getting a holder's public key"""
    print("\n=== Integration Test: Get Holder Public Key ===")
    
    # Get Account #1's public key directly without await
    account1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    public_key = blockchain_service.contract.functions.getHolderPublicKey(account1).call()
    
    print(f"Public key for {account1}: {public_key}")
    
    # Verify the public key has 2 elements
    assert len(public_key) == 2, f"Expected public key to have 2 elements, got {len(public_key)}"
    
    # Verify the public key matches what we set in test-contract.js
    expected_public_key = [123456789, 987654321]
    assert [int(public_key[0]), int(public_key[1])] == expected_public_key, "Unexpected public key" 
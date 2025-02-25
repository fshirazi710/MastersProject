from web3 import Web3
from eth_typing import Address
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class BlockchainService:
    """
    Service for handling all blockchain interactions.
    Implements functionality from crypto-core/client-script for message submission
    and agent-script for monitoring.
    """
    
    def __init__(self):
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(settings.WEB3_PROVIDER_URL))
        self.contract_address = Address(bytes.fromhex(settings.CONTRACT_ADDRESS[2:]))
        
        # Load contract ABI
        self.contract = self._load_contract()
        
        # Initialize account from private key
        self.account = self.w3.eth.account.from_key(settings.PRIVATE_KEY)
        
    def _load_contract(self):
        """Load the smart contract interface"""
        # TODO: Load ABI from crypto-core/contracts/build
        abi = []  # This will come from the compiled contract
        return self.w3.eth.contract(address=self.contract_address, abi=abi)
    
    async def join_as_holder(self, deposit_amount: float) -> dict:
        """
        Allows a user to join as a secret holder by staking a deposit.
        Implements the joinAsHolder function from the smart contract.
        """
        try:
            # Convert deposit to Wei
            deposit_wei = self.w3.to_wei(deposit_amount, 'ether')
            
            # Build transaction
            transaction = self.contract.functions.joinAsHolder().build_transaction({
                'from': self.account.address,
                'value': deposit_wei,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully joined as holder. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex(),
                'holder_address': self.account.address
            }
            
        except Exception as e:
            logger.error(f"Failed to join as holder: {str(e)}")
            raise
    
    async def verify_holder_status(self, address: str) -> bool:
        """Verify if an address is a registered secret holder"""
        try:
            return await self.contract.functions.isHolder(address).call()
        except Exception as e:
            logger.error(f"Failed to verify holder status: {str(e)}")
            return False
    
    async def get_required_deposit(self) -> float:
        """Get the required deposit amount from the contract"""
        try:
            deposit_wei = await self.contract.functions.requiredDeposit().call()
            return self.w3.from_wei(deposit_wei, 'ether')
        except Exception as e:
            logger.error(f"Failed to get required deposit: {str(e)}")
            raise

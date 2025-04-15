from web3 import Web3
from eth_typing import Address
from app.core.config import settings
import logging
import json
import os
import asyncio

logger = logging.getLogger(__name__)

class BlockchainService:
    """
    Service for handling all blockchain interactions.
    Implements functionality for interacting with the TimedReleaseVoting contract.
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
        # Load ABI from the TimedReleaseVoting contract
        abi_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                               "../crypto-core/build/contracts/TimedReleaseVoting.json")
        
        try:
            with open(abi_path, 'r') as f:
                contract_json = json.load(f)
                abi = contract_json['abi']
        except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
            error_msg = f"Failed to load contract ABI: {str(e)}"
            logger.error(error_msg)
            # Return empty ABI if file not found or invalid
            abi = []
            
        return self.w3.eth.contract(address=self.contract_address, abi=abi)

    async def call_contract_function(self, function_name, *args):
        """
        Helper method to call a contract function with proper async handling.
        
        Args:
            function_name: Name of the contract function to call
            *args: Arguments to pass to the function
            
        Returns:
            Result of the contract function call
        """
        try:
            # Get the function from the contract
            func = getattr(self.contract.functions, function_name)
            # Call the function with the provided arguments
            contract_func = func(*args)
            # For Web3.py, we need to use a loop to properly await the call
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, contract_func.call)
            return result
        except Exception as e:
            logger.error(f"Error calling contract function {function_name}: {str(e)}")
            raise e

    async def is_holder_active(self, election_id: int, public_key: str) -> bool:
        """Check if a public key is registered and active as a holder for a specific election."""
        try:
            # Access the public mapping directly
            # Ensure public_key is passed correctly (might need prefix handling if stored differently in contract vs backend)
            is_active = await self.call_contract_function("isHolderActiveForElection", election_id, public_key)
            # Mappings return default value (false for bool) if key doesn't exist
            return is_active
        except Exception as e:
            logger.error(f"Error checking if holder {public_key} is active for election {election_id}: {str(e)}")
            # Depending on desired behavior, might return False or re-raise
            raise e

    async def has_holder_submitted(self, election_id: int, public_key: str) -> bool:
        """Check if a holder has submitted shares for a specific election."""
        try:
            # Access the public mapping directly
            has_submitted = await self.call_contract_function("hasSubmittedSharesForElection", election_id, public_key)
            return has_submitted
        except Exception as e:
            logger.error(f"Error checking if holder {public_key} has submitted for election {election_id}: {str(e)}")
            # Depending on desired behavior, might return False or re-raise
            raise e

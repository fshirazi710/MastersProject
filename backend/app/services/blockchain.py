from web3 import Web3
from eth_typing import Address
from app.core.config import settings
import logging
import json
import os
import asyncio
import pathlib  
from pathlib import Path

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


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

        # logger.info(f"Current working directory is: '{Path.cwd()}'")
        
        # Show abi path (on fly.io filesystem)
        abi_path = Path("/TimedReleaseVoting.json")
        # local_abi_path = f"{Path(__file__).resolve().parent.parent.parent}/TimedReleaseVoting.json"
        # logger.info(f"abi path is '{local_abi_path}'")

        try:
            with open(abi_path, 'r') as f:
                contract_json = json.load(f)
                abi = contract_json['abi']
                # logger.info(f"Contract ABI loaded successfully, {len(abi)} functions/events found.")
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

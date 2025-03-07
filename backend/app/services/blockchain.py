from web3 import Web3
from eth_typing import Address
from typing import Optional, List, Tuple
from app.core.config import settings
from app.services.crypto import CryptoService
import logging
import json
import os

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
        
        # Initialize crypto service
        self.crypto_service = CryptoService()
        
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
            logger.error(f"Failed to load contract ABI: {str(e)}")
            # Fallback to empty ABI if file not found or invalid
            abi = []
            
        return self.w3.eth.contract(address=self.contract_address, abi=abi)
    
    async def join_as_holder(self, deposit_amount: float) -> dict:
        """
        Allows a user to join as a secret holder by staking a deposit.
        Implements the joinAsHolder function from the smart contract.
        """
        try:
            # Generate BLS12-381 keypair for the holder
            private_key, public_key = self.crypto_service.generate_keypair()
            
            # Convert deposit to Wei
            deposit_wei = self.w3.to_wei(deposit_amount, 'ether')
            
            # Build transaction with public key
            transaction = self.contract.functions.joinAsHolder(
                [public_key[0].n, public_key[1].n]  # Convert FQ to integers
            ).build_transaction({
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
                'holder_address': self.account.address,
                'public_key': [public_key[0].n, public_key[1].n]
            }
            
        except Exception as e:
            logger.error(f"Failed to join as holder: {str(e)}")
            raise

    async def submit_vote(self, vote_data: bytes, decryption_time: int) -> dict:
        """
        Submit an encrypted vote to the blockchain.
        Args:
            vote_data: The vote data to encrypt
            decryption_time: Unix timestamp when the vote can be decrypted
        """
        try:
            # Generate random key for vote encryption
            key = self.crypto_service.hash_to_scalar(decryption_time.to_bytes(32, 'big')).to_bytes(32, 'big')
            
            # Encrypt vote
            ciphertext, nonce = self.crypto_service.encrypt_vote(vote_data, key)
            
            # Generate shares of the key
            num_shares = await self.contract.functions.getNumHolders().call()
            threshold = (num_shares * 2) // 3  # 2/3 threshold
            shares = self.crypto_service.generate_shares(
                int.from_bytes(key, 'big'),
                num_shares,
                threshold
            )
            
            # Build transaction
            transaction = self.contract.functions.submitVote(
                ciphertext,
                nonce,
                decryption_time,
                [share[1] for share in shares]  # Share values
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully submitted vote. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex(),
                'vote_id': receipt['events']['VoteSubmitted']['args']['voteId']
            }
            
        except Exception as e:
            logger.error(f"Failed to submit vote: {str(e)}")
            raise

    async def submit_share(self, vote_id: int, share: Tuple[int, int]) -> dict:
        """
        Submit a share for a vote.
        Args:
            vote_id: The ID of the vote
            share: Tuple of (index, share_value)
        """
        try:
            # Build transaction
            transaction = self.contract.functions.submitShare(
                vote_id,
                share[0],
                share[1]
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully submitted share. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"Failed to submit share: {str(e)}")
            raise

    async def get_vote_data(self, vote_id: int) -> dict:
        """
        Get the encrypted vote data and shares.
        Args:
            vote_id: The ID of the vote
        """
        try:
            vote_data = await self.contract.functions.getVote(vote_id).call()
            return {
                'ciphertext': vote_data[0],
                'nonce': vote_data[1],
                'decryption_time': vote_data[2],
                'shares': vote_data[3]
            }
        except Exception as e:
            logger.error(f"Failed to get vote data: {str(e)}")
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

    async def verify_share_submission(self, vote_id: int, holder_address: str, share: Tuple[int, int]) -> bool:
        """
        Verify if a submitted share is valid.
        Args:
            vote_id: The ID of the vote
            holder_address: The address of the secret holder
            share: The share to verify (index, value)
        Returns: True if share is valid, False otherwise
        """
        try:
            # Get holder's public key from blockchain
            holder_pk = await self.contract.functions.getHolderPublicKey(holder_address).call()
            
            # Get vote's g2r point from blockchain
            vote_data = await self.contract.functions.getVote(vote_id).call()
            g2r = vote_data[4]  # Assuming g2r is stored as the 5th element
            
            # Convert share to G1 point
            share_point = self.crypto_service.scalar_to_g1_point(share[1])
            
            # Verify share using BLS12-381 pairing
            return self.crypto_service.verify_share(share_point, holder_pk, g2r)
            
        except Exception as e:
            logger.error(f"Failed to verify share: {str(e)}")
            return False

    async def get_share_status(self, vote_id: int) -> dict:
        """
        Get the status of all shares for a vote.
        Args:
            vote_id: The ID of the vote
        Returns: Dictionary with share submission status
        """
        try:
            # Get all holders
            holders = await self.contract.functions.getHolders().call()
            
            # Get submitted shares
            submitted_shares = await self.contract.functions.getSubmittedShares(vote_id).call()
            
            # Get vote data for verification
            vote_data = await self.contract.functions.getVote(vote_id).call()
            g2r = vote_data[4]
            
            status = {
                'total_holders': len(holders),
                'submitted_shares': len(submitted_shares),
                'missing_shares': len(holders) - len(submitted_shares),
                'holder_status': {}
            }
            
            # Check each holder's share
            for holder in holders:
                holder_address = holder[0]  # Assuming holder data includes address
                if holder_address in submitted_shares:
                    share = submitted_shares[holder_address]
                    is_valid = await self.verify_share_submission(vote_id, holder_address, share)
                    status['holder_status'][holder_address] = {
                        'submitted': True,
                        'valid': is_valid
                    }
                else:
                    status['holder_status'][holder_address] = {
                        'submitted': False,
                        'valid': False
                    }
            
            return status
            
        except Exception as e:
            logger.error(f"Failed to get share status: {str(e)}")
            raise

    def decrypt_vote(self, vote_id: int) -> dict:
        """
        Decrypt a vote using submitted shares.
        
        Args:
            vote_id: The ID of the vote to decrypt
            
        Returns:
            Dictionary with decryption result
        """
        try:
            # Get the vote data
            vote_data = self.contract.functions.getVote(vote_id).call()
            ciphertext = vote_data[0]
            nonce = vote_data[1]
            decryption_time = vote_data[2]
            g2r = vote_data[3]
            
            # Check if decryption time has passed
            current_time = self.w3.eth.get_block('latest').timestamp
            if current_time < decryption_time:
                return {
                    "success": False,
                    "error": f"Vote cannot be decrypted yet. Decryption time: {decryption_time}, current time: {current_time}"
                }
            
            # Get all submitted shares
            submitters, shares = self.contract.functions.getSubmittedShares(vote_id).call()
            
            if len(shares) < 1:
                return {
                    "success": False,
                    "error": "No shares have been submitted for this vote"
                }
            
            # Format shares for reconstruction
            formatted_shares = [(int(share[0]), int(share[1])) for share in shares]
            
            # Reconstruct the secret key using the crypto service
            try:
                secret_key = self.crypto_service.reconstruct_secret(formatted_shares)
                
                # Convert the secret key to bytes
                secret_key_bytes = secret_key.to_bytes(32, 'big')
                
                # Decrypt the vote data
                decrypted_data = self.crypto_service.decrypt_vote(ciphertext, secret_key_bytes, nonce)
                
                # Convert to string if it's bytes
                if isinstance(decrypted_data, bytes):
                    decrypted_data = decrypted_data.decode('utf-8')
                
                return {
                    "success": True,
                    "data": {
                        "vote_data": decrypted_data,
                        "decryption_time": current_time,
                        "shares_used": len(shares)
                    }
                }
            except ValueError as e:
                # If reconstruction or decryption fails, try using the contract's decrypt function
                logger.info(f"Local decryption failed: {str(e)}. Trying contract decryption...")
                
                # Call the contract's decrypt function
                tx = self.contract.functions.decrypt(vote_id).build_transaction({
                    'from': self.account.address,
                    'gas': 3000000,
                    'gasPrice': self.w3.eth.gas_price,
                    'nonce': self.w3.eth.get_transaction_count(self.account.address),
                })
                
                # Sign and send the transaction
                signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=settings.PRIVATE_KEY)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                
                # Wait for the transaction to be mined
                tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
                
                if tx_receipt.status == 0:
                    return {
                        "success": False,
                        "error": "Transaction failed"
                    }
                
                # Get the decrypted data from the contract
                decrypted_data = self.contract.functions.getDecryptedVote(vote_id).call()
                
                return {
                    "success": True,
                    "data": {
                        "vote_data": decrypted_data.decode('utf-8') if isinstance(decrypted_data, bytes) else decrypted_data,
                        "decryption_time": current_time,
                        "shares_used": len(shares)
                    }
                }
            
        except Exception as e:
            logger.error(f"Failed to decrypt vote: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

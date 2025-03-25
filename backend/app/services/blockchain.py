from web3 import Web3
from eth_typing import Address
from typing import Optional, List, Tuple
from app.core.config import settings
from app.services.crypto import CryptoService
from app.core.error_handling import handle_blockchain_error
import logging
import json
import os
import secrets
import asyncio
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)

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
            error_msg = f"Failed to load contract ABI: {str(e)}"
            logger.error(error_msg)
            # Return empty ABI if file not found or invalid
            abi = []
            
        return self.w3.eth.contract(address=self.contract_address, abi=abi)
    
    async def join_as_holder(self, election_id: int, public_key: str) -> dict:
        """
        Allows a user to join as a secret holder by staking a deposit.
        Implements the joinAsHolder function from the smart contract.
        """
        try:
            nonce = self.w3.eth.get_transaction_count(WALLET_ADDRESS)
            estimated_gas = self.contract.functions.joinAsHolder(
                election_id, public_key
            ).estimate_gas({"from": WALLET_ADDRESS})

            join_as_holder_tx = self.contract.functions.joinAsHolder(
                election_id, public_key
            ).build_transaction({
                'from': WALLET_ADDRESS,
                'gas': estimated_gas,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })

            # Sign and send transaction
            signed_tx = self.w3.eth.account.sign_transaction(join_as_holder_tx, PRIVATE_KEY)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else self.w3.to_hex(tx_hash)

            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

            logger.info(f"Successfully joined as holder. Transaction: {tx_hash_hex}")
            return {
                'success': True,
                'transaction_hash': tx_hash_hex,
                'holder_address': WALLET_ADDRESS,
                'public_key': public_key
            }

        except Exception as e:
            logger.error(f"Failed to join as holder: {str(e)}")
            raise handle_blockchain_error("join as holder", e)

    async def submit_vote(self, vote_data: bytes, decryption_time: int, reward_amount: float = 0.1, threshold: int = None) -> dict:
        """
        Submit an encrypted vote to the blockchain.
        Args:
            vote_data: The vote data to encrypt
            decryption_time: Unix timestamp when the vote can be decrypted
            reward_amount: Amount of ETH to reward secret holders (default: 0.1 ETH)
            threshold: Minimum number of shares needed to reconstruct the secret
                       (default: None, which will use 2/3 of the total holders)
        """
        try:
            # Get number of holders
            num_holders = await self.contract.functions.getNumHolders().call()
            
            # Set default threshold if not provided
            if threshold is None:
                threshold = max(2, (num_holders * 2) // 3)  # At least 2, or 2/3 of holders
            elif threshold < 2:
                threshold = 2  # Minimum of 2 shares required for Lagrange interpolation
            elif threshold > num_holders:
                threshold = num_holders  # Can't require more shares than holders
                
            logger.info(f"Using threshold of {threshold} out of {num_holders} holders")
            
            # Generate random key for vote encryption
            key = self.crypto_service.hash_to_scalar(decryption_time.to_bytes(32, 'big')).to_bytes(32, 'big')
            
            # Encrypt vote
            ciphertext, nonce = self.crypto_service.encrypt_vote(vote_data, key)
            
            # Generate shares for the key
            secret = int.from_bytes(key, 'big')
            shares = self.crypto_service.generate_shares(secret, num_holders, threshold)
            
            # Calculate g2r for verification
            r = secrets.randbelow(self.crypto_service.curve_order)
            g2r = self.crypto_service.scalar_to_g2_point(r)
            
            # Convert g2r to contract format
            g2r_contract = [int(g2r[0].n), int(g2r[1].n)]
            
            # Estimate gas for the transaction
            gas_estimate = await self.contract.functions.submitVote(
                ciphertext,
                nonce,
                decryption_time,
                g2r_contract,
                threshold  # Pass threshold to the contract
            ).estimate_gas({
                'from': self.account.address,
                'value': self.w3.to_wei(reward_amount, 'ether')
            })
            
            # Build the transaction
            transaction = await self.contract.functions.submitVote(
                ciphertext,
                nonce,
                decryption_time,
                g2r_contract,
                threshold  # Pass threshold to the contract
            ).build_transaction({
                'from': self.account.address,
                'value': self.w3.to_wei(reward_amount, 'ether'),
                'gas': gas_estimate,
                'gasPrice': self.w3.to_wei('50', 'gwei'),
                'nonce': await self.w3.eth.get_transaction_count(self.account.address)
            })
            
            # Sign and send the transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = await self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt to get the vote ID
            receipt = await self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Get the vote ID from the event logs
            vote_id = None
            for log in receipt.logs:
                try:
                    # Try to decode the log as a VoteSubmitted event
                    event = self.contract.events.VoteSubmitted().process_log(log)
                    vote_id = event['args']['voteId']
                    break
                except:
                    continue
            
            if vote_id is None:
                vote_id = await self.contract.functions.voteCount().call() - 1
            
            # Store threshold in database for later use in decryption
            # This would require adding database storage for vote metadata
            # For now, we'll just return it in the response
            
            logger.info(f"Successfully submitted vote with threshold {threshold}. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex(),
                'vote_id': vote_id,
                'reward_amount': reward_amount,
                'threshold': threshold,
                'total_holders': num_holders
            }
            
        except Exception as e:
            logger.error(f"Failed to submit vote: {str(e)}")
            raise handle_blockchain_error("submit vote", e)

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
            raise handle_blockchain_error("submit share", e)

    async def trigger_reward_distribution(self, vote_id: int) -> dict:
        """
        Manually trigger reward distribution for a vote.
        Args:
            vote_id: The ID of the vote
        """
        try:
            # Build transaction
            transaction = self.contract.functions.triggerRewardDistribution(
                vote_id
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully triggered reward distribution. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"Failed to trigger reward distribution: {str(e)}")
            raise handle_blockchain_error("trigger reward distribution", e)

    async def claim_rewards(self) -> dict:
        """
        Claim accumulated rewards for the current account.
        """
        try:
            # Get current rewards
            rewards = await self.contract.functions.getHolderRewards(self.account.address).call()
            
            if int(rewards) == 0:
                return {
                    'success': False,
                    'error': 'No rewards to claim'
                }
            
            # Build transaction
            transaction = self.contract.functions.claimRewards().build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully claimed rewards. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex(),
                'rewards_claimed': self.w3.from_wei(rewards, 'ether')
            }
            
        except Exception as e:
            logger.error(f"Failed to claim rewards: {str(e)}")
            raise handle_blockchain_error("claim rewards", e)

    async def exit_as_holder(self) -> dict:
        """
        Exit as a secret holder and withdraw deposit.
        """
        try:
            # Build transaction
            transaction = self.contract.functions.exitAsHolder().build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully exited as holder. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"Failed to exit as holder: {str(e)}")
            raise handle_blockchain_error("exit as holder", e)

    async def force_exit_holder(self, holder_address: str, vote_id: int) -> dict:
        """
        Force exit a holder who failed to submit a share.
        Args:
            holder_address: The address of the holder to force exit
            vote_id: The ID of the vote for which the holder failed to submit a share
        """
        try:
            # Build transaction
            transaction = self.contract.functions.forceExitHolder(
                holder_address,
                vote_id
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
            })
            
            # Sign and send transaction
            signed_txn = self.account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for transaction receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"Successfully forced exit of holder {holder_address}. Transaction: {tx_hash.hex()}")
            return {
                'success': True,
                'transaction_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"Failed to force exit holder: {str(e)}")
            raise handle_blockchain_error("force exit holder", e)

    async def get_vote_data(self, vote_id: int) -> dict:
        """
        Get the encrypted vote data and metadata.
        Args:
            vote_id: The ID of the vote
        """
        try:
            vote_data = await self.contract.functions.getVote(vote_id).call()
            
            # Get vote reward
            vote_reward = await self.contract.functions.getVoteReward(vote_id).call()
            
            return {
                'ciphertext': vote_data[0],
                'nonce': vote_data[1],
                'decryption_time': vote_data[2],
                'g2r': vote_data[3],
                'reward': self.w3.from_wei(vote_reward, 'ether')
            }
        except Exception as e:
            logger.error(f"Failed to get vote data: {str(e)}")
            raise handle_blockchain_error("get vote data", e)
    
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
            raise handle_blockchain_error("get required deposit", e)

    async def get_holder_rewards(self, holder_address: str) -> float:
        """
        Get the accumulated rewards for a holder.
        Args:
            holder_address: The address of the holder
        """
        try:
            rewards_wei = await self.contract.functions.getHolderRewards(holder_address).call()
            return self.w3.from_wei(rewards_wei, 'ether')
        except Exception as e:
            logger.error(f"Failed to get holder rewards: {str(e)}")
            raise handle_blockchain_error("get holder rewards", e)

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
            g2r = vote_data[3]  # g2r is the 4th element in the tuple
            
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
            submitters, shares = await self.contract.functions.getSubmittedShares(vote_id).call()
            
            status = {
                'total_holders': len(holders),
                'submitted_shares': len(submitters),
                'missing_shares': len(holders) - len(submitters),
                'holder_status': {}
            }
            
            # Check each holder's share
            for holder in holders:
                if holder in submitters:
                    index = submitters.index(holder)
                    share = shares[index]
                    is_valid = await self.verify_share_submission(vote_id, holder, (share[0], share[1]))
                    status['holder_status'][holder] = {
                        'submitted': True,
                        'valid': is_valid,
                        'share': {
                            'index': share[0],
                            'value': share[1]
                        }
                    }
                else:
                    status['holder_status'][holder] = {
                        'submitted': False,
                        'valid': False
                    }
            
            return status
            
        except Exception as e:
            logger.error(f"Failed to get share status: {str(e)}")
            raise handle_blockchain_error("get share status", e)

    async def decrypt_vote(self, vote_id: int, threshold: int = None) -> dict:
        """
        Decrypt a vote using submitted shares.
        
        Args:
            vote_id: The ID of the vote to decrypt
            threshold: Minimum number of shares needed for decryption
                      (default: None, which will use the threshold stored in the contract)
            
        Returns:
            Dictionary with decryption result
        """
        try:
            # Get the vote data
            vote_data = await self.contract.functions.getVote(vote_id).call()
            ciphertext = vote_data[0]
            nonce = vote_data[1]
            decryption_time = vote_data[2]
            g2r = vote_data[3]
            contract_threshold = vote_data[4]  # Get threshold from contract
            
            logger.info(f"Vote {vote_id} has threshold {contract_threshold} set in the contract")
            
            # Use provided threshold or fall back to contract threshold
            if threshold is None:
                threshold = contract_threshold
                logger.info(f"Using contract threshold: {threshold}")
            else:
                logger.info(f"Using custom threshold: {threshold} (overriding contract threshold: {contract_threshold})")
            
            # Check if decryption time has passed
            current_time = (await self.w3.eth.get_block('latest'))['timestamp']
            if current_time < decryption_time:
                return {
                    "success": False,
                    "error": f"Vote cannot be decrypted yet. Decryption time: {decryption_time}, current time: {current_time}"
                }
            
            # Get all submitted shares
            submitters, shares = await self.contract.functions.getSubmittedShares(vote_id).call()
            
            if len(shares) < 1:
                return {
                    "success": False,
                    "error": "No shares have been submitted for this vote"
                }
            
            # Format shares for reconstruction
            formatted_shares = [(int(share[0]), int(share[1])) for share in shares]
            
            if len(formatted_shares) < threshold:
                return {
                    "success": False,
                    "error": f"Insufficient shares for decryption. Need {threshold}, have {len(formatted_shares)}"
                }
            
            # Use exactly the required number of shares (threshold)
            shares_to_use = formatted_shares[:threshold]
            
            logger.info(f"Attempting to decrypt vote {vote_id} using {len(shares_to_use)} shares (threshold: {threshold})")
            
            # Reconstruct the secret key using the crypto service
            try:
                secret = self.crypto_service.reconstruct_secret(shares_to_use)
                key = secret.to_bytes(32, 'big')
                
                # Decrypt the vote
                decrypted_data = self.crypto_service.decrypt_vote(ciphertext, key, nonce)
                
                return {
                    "success": True,
                    "data": {
                        "vote_data": decrypted_data.decode('utf-8'),
                        "decryption_time": decryption_time,
                        "shares_used": len(shares_to_use),
                        "threshold": threshold
                    }
                }
            except Exception as e:
                logger.error(f"Error reconstructing secret: {str(e)}")
                return {
                    "success": False,
                    "error": f"Failed to reconstruct secret: {str(e)}"
                }
        except Exception as e:
            logger.error(f"Error decrypting vote: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

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

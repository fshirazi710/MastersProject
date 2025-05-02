from web3 import Web3
from eth_typing import Address
from app.core.config import settings
import logging
import json
import os
import asyncio

logger = logging.getLogger(__name__)

# --- ABI Loading Helper ---
def load_abi(contract_name: str) -> list:
    """Loads the ABI for a given contract name from the artifacts directory."""
    # Construct the path relative to this file's location
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__))) # Moves up three levels from services/blockchain.py to backend/
    abi_path = os.path.join(
        base_path,
        "../crypto-core/artifacts/contracts/", # Move to crypto-core sibling directory
        f"{contract_name}.sol",
        f"{contract_name}.json"
    )
    logger.debug(f"Attempting to load ABI from: {abi_path}")
    try:
        with open(abi_path, 'r') as f:
            contract_json = json.load(f)
            logger.info(f"Successfully loaded ABI for {contract_name}")
            return contract_json['abi']
    except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to load contract ABI for {contract_name} at {abi_path}: {e}")
        # In a real scenario, proper error handling or application termination might be needed
        return [] # Return empty ABI on failure


class BlockchainService:
    """
    Service for handling all blockchain interactions.
    Interacts with VoteSessionFactory, VoteSession, and ParticipantRegistry contracts.
    """

    def __init__(self):
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(settings.WEB3_PROVIDER_URL))
        if not self.w3.is_connected():
            logger.error(f"Failed to connect to Web3 provider at {settings.WEB3_PROVIDER_URL}")
            # Consider raising an exception or handling the connection failure appropriately
            raise ConnectionError(f"Unable to connect to Web3 provider: {settings.WEB3_PROVIDER_URL}")
        else:
            logger.info(f"Connected to Web3 provider at {settings.WEB3_PROVIDER_URL}")

        # Load ABIs
        self.factory_abi = load_abi("VoteSessionFactory")
        self.session_abi = load_abi("VoteSession")
        self.registry_abi = load_abi("ParticipantRegistry")

        if not self.factory_abi or not self.session_abi or not self.registry_abi:
            # Handle case where ABIs failed to load - maybe raise an init error
            logger.critical("One or more contract ABIs failed to load. BlockchainService cannot operate.")
            raise ImportError("Failed to load required contract ABIs.")

        # Load Factory Contract Address from settings
        try:
            self.factory_address = Address(bytes.fromhex(settings.VOTE_SESSION_FACTORY_ADDRESS[2:]))
            logger.info(f"Loaded VoteSessionFactory address: {self.factory_address}")
        except AttributeError:
             logger.error("VOTE_SESSION_FACTORY_ADDRESS not found in settings. Please configure it.")
             # Decide how to handle this - raise error? Use a default?
             raise AttributeError("Missing VOTE_SESSION_FACTORY_ADDRESS in configuration.")
        except Exception as e:
            logger.error(f"Error processing VOTE_SESSION_FACTORY_ADDRESS: {e}")
            raise

        # Get the factory contract instance
        self.factory_contract = self.w3.eth.contract(address=self.factory_address, abi=self.factory_abi)

        # Initialize account from private key for sending transactions
        try:
            self.account = self.w3.eth.account.from_key(settings.PRIVATE_KEY)
            self.w3.eth.default_account = self.account.address # Optional: set default account
            logger.info(f"Loaded and set default account: {self.account.address}")
        except AttributeError:
            logger.error("PRIVATE_KEY not found in settings.")
            raise AttributeError("Missing PRIVATE_KEY in configuration.")
        except Exception as e:
            logger.error(f"Error initializing account from PRIVATE_KEY: {e}")
            raise

    def get_session_contract(self, session_address: str):
        """Get a contract instance for a specific VoteSession."""
        address = Address(bytes.fromhex(session_address[2:]))
        return self.w3.eth.contract(address=address, abi=self.session_abi)

    def get_registry_contract(self, registry_address: str):
        """Get a contract instance for a specific ParticipantRegistry."""
        address = Address(bytes.fromhex(registry_address[2:]))
        return self.w3.eth.contract(address=address, abi=self.registry_abi)


    async def call_contract_function(self, contract, function_name, *args):
        """
        Helper method to call a contract function with proper async handling.

        Args:
            contract: The web3 contract instance.
            function_name: Name of the contract function to call.
            *args: Arguments to pass to the function.

        Returns:
            Result of the contract function call.
        """
        try:
            # Get the function from the contract
            func = getattr(contract.functions, function_name)
            # Call the function with the provided arguments
            contract_func = func(*args)
            # For Web3.py, we need to use a loop to properly await the call
            # Note: For read-only 'call()', run_in_executor might be slight overkill
            # but provides consistency with potential future transaction sending.
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, contract_func.call)
            logger.debug(f"Successfully called {function_name} on {contract.address} with args {args}. Result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error calling contract function {function_name} on {contract.address}: {str(e)}")
            # Consider more specific exception handling (e.g., ContractLogicError)
            raise # Re-raise the exception after logging

    async def send_transaction(self, contract, function_name, *args, value=0):
        """
        Builds, signs, and sends a transaction for a contract function.

        Args:
            contract: The web3 contract instance.
            function_name: Name of the contract function to call.
            *args: Arguments to pass to the function.
            value: Amount of Ether to send with the transaction (in Wei).

        Returns:
            Transaction receipt upon successful sending.
        
        Raises:
            Exception: If any part of the transaction process fails.
        """
        try:
            logger.info(f"Preparing transaction for {function_name} on {contract.address} with args {args}")
            # Get the function from the contract
            func = getattr(contract.functions, function_name)
            contract_func = func(*args)

            # Estimate gas
            # Note: Gas estimation might fail for complex transactions or if the node doesn't support it well.
            # Consider adding a fallback or manual gas limit.
            try:
                estimated_gas = contract_func.estimate_gas({'from': self.account.address, 'value': value})
                logger.debug(f"Estimated gas: {estimated_gas}")
            except Exception as gas_error:
                logger.warning(f"Gas estimation failed for {function_name}: {gas_error}. Using default gas limit.")
                # Provide a sensible default or get from config if estimation fails
                estimated_gas = 500000 # Example default, adjust as needed

            # Build the transaction
            tx_params = {
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': estimated_gas,
                'gasPrice': self.w3.eth.gas_price, # Or use EIP-1559 fields: maxFeePerGas, maxPriorityFeePerGas
                'value': value
            }
            transaction = contract_func.build_transaction(tx_params)
            logger.debug(f"Built transaction: {transaction}")

            # Sign the transaction
            signed_tx = self.w3.eth.account.sign_transaction(transaction, self.account.key)
            logger.debug("Transaction signed.")

            # Send the transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            logger.info(f"Transaction sent for {function_name}. Tx Hash: {tx_hash.hex()}")
            
            # Optional: Wait for transaction receipt (can add a timeout)
            try:
                # Use run_in_executor for the blocking wait_for_transaction_receipt
                loop = asyncio.get_event_loop()
                tx_receipt = await loop.run_in_executor(
                    None, 
                    lambda: self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120) # e.g., 120 seconds
                ) 
                logger.info(f"Transaction {tx_hash.hex()} confirmed. Receipt: {tx_receipt}")
                # Check tx_receipt.status (1 for success, 0 for failure)
                if tx_receipt.status == 0:
                    logger.error(f"Transaction {tx_hash.hex()} failed. Receipt: {tx_receipt}")
                    # You might want a more specific exception type here
                    raise Exception(f"Transaction {tx_hash.hex()} failed on-chain.")
                # Return the full receipt on success
                return tx_receipt 
            except asyncio.TimeoutError:
                # If timeout occurs, the transaction might still succeed later.
                # Depending on requirements, you could: 
                # 1. Raise a timeout error.
                # 2. Return the hash and let the caller handle polling/checking later.
                # 3. Continue polling for longer (not shown here).
                # For now, let's raise a specific timeout error.
                logger.warning(f"Timeout waiting for transaction receipt for {tx_hash.hex()}.")
                raise TimeoutError(f"Timeout waiting for confirmation of transaction {tx_hash.hex()}.")

        except Exception as e:
            logger.error(f"Error sending transaction for {function_name} on {contract.address}: {e}")
            # Consider more specific exception handling (e.g., ValueError for bad args)
            raise

    # --- Factory Interactions ---

    async def create_vote_session(
        self,
        title: str,
        description: str,
        start_date: int,
        end_date: int,
        shares_end_date: int,
        options: list[str],
        metadata: str,
        required_deposit: int, # Expecting Wei
        min_share_threshold: int
    ) -> dict:
        """Creates a new VoteSession and ParticipantRegistry pair via the factory.
        Waits for the transaction receipt and parses the SessionPairDeployed event.
        
        Returns:
            A dictionary containing sessionId, voteSessionContract, and participantRegistryContract.
        
        Raises:
            Exception: If transaction fails, times out, or event parsing fails.
        """
        try:
            # Call send_transaction, which now waits for the receipt
            tx_receipt = await self.send_transaction(
                self.factory_contract,
                "createSessionPair",
                title,
                description,
                start_date,
                end_date,
                shares_end_date,
                options,
                metadata,
                required_deposit,
                min_share_threshold
            )

            # Transaction succeeded if we got here (send_transaction checks status)
            logger.info(f"Transaction successful. Processing receipt for event SessionPairDeployed...")
            
            # Process logs to find the SessionPairDeployed event
            # The factory contract instance (self.factory_contract) has an 'events' attribute
            # that can be used to decode logs.
            try:
                # This processes all logs in the receipt and decodes the ones matching the event ABI
                processed_logs = self.factory_contract.events.SessionPairDeployed().process_receipt(tx_receipt)
                
                if not processed_logs:
                    logger.error("SessionPairDeployed event not found in transaction logs.")
                    raise ValueError("SessionPairDeployed event not found after successful transaction.")
                    
                # Assuming only one such event is emitted per transaction
                event_args = processed_logs[0]['args'] 
                session_id = event_args.sessionId
                session_addr = event_args.voteSessionContract
                registry_addr = event_args.participantRegistryContract
                
                logger.info(f"Successfully deployed session pair: ID={session_id}, Session={session_addr}, Registry={registry_addr}")
                
                return {
                    "sessionId": session_id,
                    "voteSessionContract": session_addr,
                    "participantRegistryContract": registry_addr
                }
                
            except Exception as e: # Catch potential errors during log processing
                logger.error(f"Error processing SessionPairDeployed event logs: {e}")
                raise ValueError(f"Failed to parse SessionPairDeployed event: {e}")

        except TimeoutError as e:
             logger.error(f"Timeout waiting for session creation transaction: {e}")
             raise # Re-raise the timeout error
        except Exception as e:
            # This catches failures from send_transaction (on-chain failure or other errors)
            logger.error(f"Failed to create vote session: {e}")
            raise # Re-raise other exceptions

    async def get_session_count(self) -> int:
        """Gets the total number of deployed session pairs from the factory."""
        try:
            count = await self.call_contract_function(self.factory_contract, "getDeployedSessionCount")
            return count
        except Exception as e:
            logger.error(f"Failed to get session count: {e}")
            raise

    async def get_session_addresses(self, session_id: int) -> tuple[str | None, str | None]:
        """Gets the VoteSession and ParticipantRegistry addresses for a given session ID."""
        try:
            session_address = await self.call_contract_function(self.factory_contract, "getVoteSessionAddressById", session_id)
            registry_address = await self.call_contract_function(self.factory_contract, "getRegistryAddressById", session_id)
            
            # Check for zero address, which might indicate the session ID is invalid
            zero_address = "0x" + "0" * 40
            if session_address == zero_address or registry_address == zero_address:
                logger.warning(f"Session ID {session_id} returned zero address. Session may not exist.")
                return (None, None)
                
            return session_address, registry_address
        except Exception as e:
            logger.error(f"Failed to get addresses for session ID {session_id}: {e}")
            raise

    # --- Remove or refactor old functions interacting with TimedReleaseVoting ---

    async def is_participant_registered(self, session_id: int, participant_address: str) -> bool:
        """Checks if an address is registered in the ParticipantRegistry for a specific session."""
        try:
            _, registry_addr = await self.get_session_addresses(session_id)
            if not registry_addr:
                raise ValueError(f"Could not find registry address for session ID {session_id}")
                
            registry_contract = self.get_registry_contract(registry_addr)
            is_registered = await self.call_contract_function(
                registry_contract, 
                "isParticipantRegistered", 
                participant_address
            )
            logger.info(f"Participant {participant_address} registered status for session {session_id}: {is_registered}")
            return is_registered
        except Exception as e:
            logger.error(f"Error checking registration for participant {participant_address} in session {session_id}: {e}")
            raise

    async def has_participant_submitted_shares(self, session_id: int, participant_address: str) -> bool:
        """Checks if a participant has submitted shares, recorded in the ParticipantRegistry for a specific session."""
        try:
            # Share submission status is tracked in ParticipantRegistry via Structs.ParticipantInfo
            _, registry_addr = await self.get_session_addresses(session_id)
            if not registry_addr:
                raise ValueError(f"Could not find registry address for session ID {session_id}")

            registry_contract = self.get_registry_contract(registry_addr)
            # Access the 'participants' mapping which returns ParticipantInfo struct
            participant_data = await self.call_contract_function(
                registry_contract, # Call Registry, not Session
                "participants",
                participant_address
            )
            
            # Structs.ParticipantInfo: { isRegistered, isHolder, depositAmount, blsPublicKeyHex, hasSubmittedShares }
            # hasSubmittedShares is at index 4
            has_submitted = participant_data[4] # Index verified from Structs.sol
            logger.info(f"Participant {participant_address} share submission status for session {session_id}: {has_submitted}")
            return has_submitted
        except Exception as e:
            logger.error(f"Error checking share submission for participant {participant_address} in session {session_id}: {e}")
            raise

    # --- New functions for interacting with specific contracts ---

    async def get_participant_details(self, session_id: int, participant_address: str) -> dict:
        """Gets detailed information about a participant from the ParticipantRegistry."""
        try:
            _, registry_addr = await self.get_session_addresses(session_id)
            if not registry_addr:
                raise ValueError(f"Could not find registry address for session ID {session_id}")

            registry_contract = self.get_registry_contract(registry_addr)
            details_tuple = await self.call_contract_function(
                registry_contract,
                "participants", # Calls ParticipantRegistry.participants
                participant_address
            )

            # Map tuple to dict based on Structs.ParticipantInfo
            # struct ParticipantInfo { bool isRegistered; bool isHolder; uint256 depositAmount; string blsPublicKeyHex; bool hasSubmittedShares; }
            details = {
                "isRegistered": details_tuple[0],      # Index 0
                "isHolder": details_tuple[1],            # Index 1
                "depositAmount": details_tuple[2],     # Index 2
                "blsPublicKeyHex": details_tuple[3],   # Index 3
                "hasSubmittedShares": details_tuple[4]  # Index 4
            }
            logger.info(f"Details for participant {participant_address} in session {session_id}: {details}")
            return details
        except Exception as e:
            logger.error(f"Error getting details for participant {participant_address} in session {session_id}: {e}")
            raise

    async def get_session_details(self, session_id: int) -> dict:
        """Gets parameters and status for a specific VoteSession."""
        try:
            session_addr, _ = await self.get_session_addresses(session_id)
            if not session_addr:
                # Raise specific error if session address not found for ID
                raise ValueError(f"Could not find session address for session ID {session_id}")

            session_contract = self.get_session_contract(session_addr)
            
            # Call getSessionInfo which returns a tuple of most parameters + status
            session_info_tuple = await self.call_contract_function(session_contract, "getSessionInfo")
            # Fetch registry address separately
            registry_addr = await self.call_contract_function(session_contract, "participantRegistry")
            # Fetch registration end date separately
            reg_end_date_ts = await self.call_contract_function(session_contract, "registrationEndDate")

            # Map results to dicts based on contract definitions
            # getSessionInfo returns: (title, desc, startDate, endDate, sharesEndDate, options, metadata, reqDeposit, minShareThreshold, currentStatus)
            # participantRegistry() returns: address
            # registrationEndDate() returns: uint256
            status_enum = session_info_tuple[9] # Status is the last element
            
            params = {
                "title": session_info_tuple[0],
                "description": session_info_tuple[1],
                "startDate": session_info_tuple[2],
                "endDate": session_info_tuple[3],
                "sharesCollectionEndDate": session_info_tuple[4],
                "options": session_info_tuple[5],
                "metadata": session_info_tuple[6],
                "requiredDeposit": session_info_tuple[7],
                "minShareThreshold": session_info_tuple[8],
                "participantRegistry": registry_addr, # From separate call
                "registrationEndDate": reg_end_date_ts # From separate call
            }
            
            # Ensure registry address from params matches the one fetched from factory (which we also use)
            # This check might be redundant now if we fetch directly, but keep for safety?
            # factory_session_addr, factory_registry_addr = await self.get_session_addresses(session_id)
            # if params["participantRegistry"] != factory_registry_addr:
            #      logger.warning(f"Registry address mismatch for session {session_id}. Factory: {factory_registry_addr}, Session Contract: {params['participantRegistry']}")
            #      params["participantRegistryFromFactory"] = factory_registry_addr
            
            # Map status enum to string
            status_map = {0: "Created", 1: "RegistrationOpen", 2: "VotingOpen", 3: "SharesCollectionOpen", 4: "Completed", 5: "Aborted"}
            status_str = status_map.get(status_enum, "UNKNOWN")

            details = {"parameters": params, "status": status_str}
            logger.info(f"Details for session {session_id}: Status='{status_str}', Params={params}")
            return details
        except ValueError as ve:
            # Re-raise specific value errors (like session not found)
            logger.error(f"Value error getting details for session {session_id}: {ve}")
            raise
        except Exception as e:
            # Catch other potential errors (ABI mismatch, network issues)
            logger.error(f"Error getting details for session {session_id}: {e}", exc_info=True)
            # Wrap in a generic error or raise specific based on type
            raise RuntimeError(f"Failed to get session details for {session_id}: {e}")
            
    # Removed get_vote_session_participant_status as VoteSession no longer tracks this combined status
    # Add specific functions instead:

    async def has_participant_voted(self, session_id: int, participant_address: str) -> bool:
        """Checks if a participant has voted in the VoteSession for a specific session."""
        try:
            session_addr, _ = await self.get_session_addresses(session_id)
            if not session_addr:
                raise ValueError(f"Could not find session address for session ID {session_id}")
                
            session_contract = self.get_session_contract(session_addr)
            # Access the simple 'hasVoted' mapping
            voted_status = await self.call_contract_function(
                session_contract,
                "hasVoted", 
                participant_address
            )
            logger.info(f"Participant {participant_address} voted status for session {session_id}: {voted_status}")
            return voted_status
        except Exception as e:
             logger.error(f"Error checking vote status for participant {participant_address} in session {session_id}: {e}")
             raise

    async def has_participant_submitted_decryption_value(self, session_id: int, participant_address: str) -> bool:
        """Checks if a participant has submitted their decryption value in the VoteSession for a specific session."""
        try:
            session_addr, _ = await self.get_session_addresses(session_id)
            if not session_addr:
                raise ValueError(f"Could not find session address for session ID {session_id}")
                
            session_contract = self.get_session_contract(session_addr)
            # Access the simple 'hasSubmittedDecryptionValue' mapping
            submitted_status = await self.call_contract_function(
                session_contract,
                "hasSubmittedDecryptionValue", 
                participant_address
            )
            logger.info(f"Participant {participant_address} decryption value submission status for session {session_id}: {submitted_status}")
            return submitted_status
        except Exception as e:
             logger.error(f"Error checking decryption value submission status for participant {participant_address} in session {session_id}: {e}")
             raise

    async def get_reward_pool_info(self, session_id: int) -> dict:
        """Gets reward pool information from the ParticipantRegistry."""
        try:
            _, registry_addr = await self.get_session_addresses(session_id)
            if not registry_addr:
                raise ValueError(f"Could not find registry address for session ID {session_id}")

            registry_contract = self.get_registry_contract(registry_addr)
            total_pool = await self.call_contract_function(registry_contract, "getTotalRewardPool")
            # Potentially add other relevant info if available, like if rewards are calculated/claimable
            info = {"totalRewardPool": total_pool}
            logger.info(f"Reward pool info for session {session_id}: {info}")
            return info
        except Exception as e:
            logger.error(f"Error getting reward pool info for session {session_id}: {e}")
            raise
            
    # --- Delete old functions --- 
    # Removing is_holder_active and has_holder_submitted_share as they are replaced

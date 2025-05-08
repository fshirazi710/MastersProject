"""
Service responsible for caching blockchain data into MongoDB.
Listens to events and updates the database cache.
"""
import asyncio
import logging
from web3 import Web3
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone # Import timezone

from app.services.blockchain import BlockchainService
from app.schemas.session import SessionCacheModel
from app.schemas.participant import ParticipantCacheModel # Import participant schema
from app.db.mongodb_utils import get_mongo_db # Assuming dependency injection setup

logger = logging.getLogger(__name__)

# Constants for polling intervals
EVENT_POLL_INTERVAL = 10 # seconds
STATUS_POLL_INTERVAL = 60 # seconds
PARTICIPANT_POLL_INTERVAL = 120 # seconds, less frequent than session status

class CacheService:
    def __init__(self, blockchain_service: BlockchainService, db: AsyncIOMotorDatabase):
        self.blockchain_service = blockchain_service
        self.db = db
        self.w3 = blockchain_service.w3 # Get web3 instance
        self._stop_event = asyncio.Event()
        self._listener_task = None
        self._status_poller_task = None
        self._participant_poller_task = None # Add task for participant polling

    async def update_session_cache(self, session_id: int) -> bool: # Add return type hint
        """Fetches details for a session and updates/inserts it into the MongoDB cache."""
        logger.info(f"Updating cache for session ID: {session_id}")
        try:
            # 1. Fetch session details from blockchain service
            session_details = await self.blockchain_service.get_session_details(session_id)
            
            if not session_details or not session_details.get('parameters'):
                 logger.warning(f"Could not fetch details for session {session_id} during cache update.")
                 return False # Indicate failure

            params = session_details['parameters']
            status_str = session_details.get('status', 'Unknown')
            
            # Fetch decryption parameters if set
            decryption_params_tuple = None
            try:
                # Need session address to get session contract
                session_addr, registry_addr_factory = await self.blockchain_service.get_session_addresses(session_id)
                if not session_addr or not registry_addr_factory:
                    logger.warning(f"Could not get contract addresses for session {session_id} in update_session_cache.")
                    return False
                
                if session_addr:
                     session_contract = self.blockchain_service.get_session_contract(session_addr)
                     # getDecryptionParameters returns (uint256 threshold, bytes32[] memory alphas_)
                     decryption_params_tuple = await self.blockchain_service.call_contract_function(session_contract, "getDecryptionParameters")
                     logger.debug(f"Fetched decryption params for session {session_id}: {decryption_params_tuple}")
                else:
                    logger.warning(f"Could not get session address to fetch decryption parameters for session {session_id}")
            except Exception as dp_err:
                 # Log as warning, params might not be set yet
                 logger.warning(f"Could not fetch decryption parameters for session {session_id}: {dp_err}")
                 
            # Fetch actual min share threshold if it differs (VoteSession.sol has getActualMinShareThreshold)
            actual_threshold = params.get('minShareThreshold') # Default to initial
            try:
                if session_addr:
                    session_contract = self.blockchain_service.get_session_contract(session_addr)
                    actual_threshold = await self.blockchain_service.call_contract_function(session_contract, "getActualMinShareThreshold")
                    logger.debug(f"Fetched actual threshold for session {session_id}: {actual_threshold}")
                else:
                     logger.warning(f"Could not get session address to fetch actual threshold for session {session_id}")
            except Exception as at_err:
                 logger.warning(f"Could not fetch actual threshold for session {session_id}, using initial: {at_err}")

            # 2. Prepare cache document data
            cache_data = {
                "session_id": session_id,
                "vote_session_address": session_addr, # Store correct session address
                "participant_registry_address": registry_addr_factory, # Store correct registry address
                "title": params.get('title'),
                "description": params.get('description'),
                "start_date_ts": params.get('startDate'),
                "end_date_ts": params.get('endDate'),
                "shares_collection_end_date_ts": params.get('sharesCollectionEndDate'),
                "options": params.get('options'),
                "metadata_contract": params.get('metadata'),
                "required_deposit_wei": str(params.get('requiredDeposit', 0)),
                "min_share_threshold": params.get('minShareThreshold'),
                "actual_min_share_threshold": actual_threshold,
                "current_status_str": status_str,
                "decryption_threshold": decryption_params_tuple[0] if decryption_params_tuple else None, 
                "alphas": [a.hex() for a in decryption_params_tuple[1]] if decryption_params_tuple and decryption_params_tuple[1] else None,
                "last_synced_ts": int(datetime.now(timezone.utc).timestamp()) # Use current UTC timestamp
            }

            # 3. Validate data with Pydantic model
            try:
                validated_data = SessionCacheModel(**cache_data).model_dump(exclude_none=True) # Exclude None values
            except Exception as pydantic_err:
                 logger.error(f"Pydantic validation failed for session {session_id} cache data: {pydantic_err}. Data: {cache_data}")
                 return False # Indicate failure

            # 4. Upsert into MongoDB using session_id as the primary key (_id)
            await self.db.sessions.update_one(
                {"session_id": session_id},
                {"$set": validated_data},
                upsert=True
            )
            logger.info(f"Successfully updated/inserted cache for session ID: {session_id}")
            return True # Indicate success

        except Exception as e:
            logger.error(f"Error updating cache for session {session_id}: {e}", exc_info=True)
            return False # Indicate failure

    async def update_participant_cache(self, session_id: int, participant_address: str):
        """Fetches participant details and updates the MongoDB cache."""
        logger.debug(f"Updating participant cache for {participant_address} in session {session_id}")
        checksum_address = self.w3.to_checksum_address(participant_address)
        try:
            # 1. Fetch core details from ParticipantRegistry
            registry_details = await self.blockchain_service.get_participant_details(session_id, checksum_address)
            if not registry_details or not registry_details.get('isRegistered'):
                # Participant not found or not registered in registry, potentially remove from cache?
                # For now, log and return.
                logger.warning(f"Participant {checksum_address} not found in registry for session {session_id}. Skipping cache update.")
                # Optional: Delete from cache if found?
                # await self.db.session_participants.delete_one({"session_id": session_id, "participant_address": checksum_address})
                return False

            # 2. Fetch additional status from VoteSession
            has_voted = False
            has_submitted_decryption_value = False
            try:
                # Need VoteSession address - fetch from session cache or service
                session_cache = await self.db.sessions.find_one({"session_id": session_id}, projection={"vote_session_address": 1})
                session_addr = session_cache.get('vote_session_address') if session_cache else None
                if not session_addr:
                    # Fallback: get from blockchain service (might be slightly slower)
                    session_addr, _ = await self.blockchain_service.get_session_addresses(session_id)
                
                if session_addr:
                    has_voted = await self.blockchain_service.has_participant_voted(session_id, checksum_address)
                    has_submitted_decryption_value = await self.blockchain_service.has_participant_submitted_decryption_value(session_id, checksum_address)
                else:
                     logger.warning(f"Could not find VoteSession address for session {session_id} to check vote/decryption value status for {checksum_address}")
            except Exception as session_err:
                logger.warning(f"Error fetching vote/decryption value status for {checksum_address} in session {session_id}: {session_err}")

            # 3. Prepare cache document data
            cache_data = {
                "session_id": session_id,
                "participant_address": checksum_address,
                "is_holder": registry_details.get('isHolder', False),
                "is_registered": registry_details.get('isRegistered', False),
                "deposit_amount_wei": str(registry_details.get('depositAmount', 0)),
                "bls_public_key_hex": registry_details.get('blsPublicKeyHex'),
                "has_submitted_shares": registry_details.get('hasSubmittedShares', False),
                "has_submitted_decryption_value": has_submitted_decryption_value,
                "has_voted": has_voted,
                "last_synced_ts": int(datetime.now(timezone.utc).timestamp())
            }

            # 4. Validate data
            try:
                validated_data = ParticipantCacheModel(**cache_data).model_dump(exclude_none=True)
            except Exception as pydantic_err:
                 logger.error(f"Pydantic validation failed for participant {checksum_address} cache data: {pydantic_err}. Data: {cache_data}")
                 return False

            # 5. Upsert into MongoDB using session_id and participant_address
            await self.db.session_participants.update_one(
                {"session_id": session_id, "participant_address": checksum_address},
                {"$set": validated_data},
                upsert=True
            )
            logger.debug(f"Successfully updated/inserted cache for participant {checksum_address} in session {session_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating participant cache for {checksum_address} in session {session_id}: {e}", exc_info=True)
            return False

    async def populate_initial_cache(self):
        """Populates the session cache with data for all existing sessions on startup."""
        logger.info("Starting initial session cache population...")
        try:
            session_count = await self.blockchain_service.get_session_count()
            logger.info(f"Found {session_count} existing sessions from factory.")
            if session_count > 0:
                tasks = [self.update_session_cache(i) for i in range(session_count)] # Assuming IDs start from 0
                results = await asyncio.gather(*tasks)
                successful_updates = sum(1 for r in results if r is True)
                logger.info(f"Initial cache population complete. Successfully cached/updated {successful_updates}/{session_count} sessions.")
            else:
                logger.info("No existing sessions found to populate.")
        except Exception as e:
            logger.error(f"Error during initial cache population: {e}", exc_info=True)

    async def _handle_event(self, event):
        """Generic event handler callback."""
        event_name = event.get('event')
        args = event.get('args')
        log_index = event.get('logIndex')
        tx_hash = event.get('transactionHash', b'').hex()
        logger.info(f"Received event: {event_name} (LogIndex: {log_index}, Tx: {tx_hash}) Args: {args}")

        try:
            if event_name == 'SessionPairDeployed' and args:
                # Update session cache AND trigger initial participant fetch for the new session
                if await self.update_session_cache(args.sessionId):
                     # Optionally fetch participants immediately for the new session
                     logger.info(f"New session {args.sessionId} detected, initiating participant fetch.")
                     await self.poll_participants_for_session(args.sessionId)
            
            # TODO: Add more specific event handlers if polling proves insufficient
            # e.g., handle HolderRegistered directly?

        except Exception as e:
            logger.error(f"Error processing event {event_name} (Tx: {tx_hash}): {e}", exc_info=True)

    async def listen_for_events(self):
        """Listens to factory events and triggers cache updates."""
        logger.info("Starting event listener for SessionPairDeployed...")
        factory_contract = self.blockchain_service.factory_contract
        if not factory_contract:
            logger.error("Factory contract instance not available in BlockchainService.")
            return
        session_deployed_filter = factory_contract.events.SessionPairDeployed.create_filter(from_block='latest')
        logger.info("Event filter created. Polling for new events...")
        while not self._stop_event.is_set():
            try:
                for event in session_deployed_filter.get_new_entries():
                    await self._handle_event(event)
                await asyncio.sleep(EVENT_POLL_INTERVAL)
            except asyncio.CancelledError:
                logger.info("Event listener task cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in event listener loop: {e}", exc_info=True)
                await asyncio.sleep(60)
        logger.info("Event listener stopped.")

    async def poll_session_statuses(self):
        """Periodically polls the status of cached sessions and updates the cache."""
        logger.info("Starting periodic session status poller...")
        await asyncio.sleep(15) # Initial delay
        while not self._stop_event.is_set():
            try:
                logger.debug("Polling session statuses...")
                cached_sessions_cursor = self.db.sessions.find({}, projection={"session_id": 1, "_id": 0})
                session_ids = [doc['session_id'] async for doc in cached_sessions_cursor]
                if not session_ids:
                    logger.debug("No sessions found in cache to poll status for.")
                else:
                    logger.info(f"Polling status for {len(session_ids)} cached sessions.")
                    tasks = [self.update_session_cache(sid) for sid in session_ids]
                    await asyncio.gather(*tasks)
                    logger.debug("Finished status poll update tasks.")
                await asyncio.sleep(STATUS_POLL_INTERVAL)
            except asyncio.CancelledError:
                logger.info("Status poller task cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in status poller loop: {e}", exc_info=True)
                await asyncio.sleep(STATUS_POLL_INTERVAL * 2)
        logger.info("Status poller stopped.")

    async def poll_participants_for_session(self, session_id: int):
        """Fetches all known participants for a single session and updates their cache."""
        logger.debug(f"Polling participants for session {session_id}...")
        try:
            # Need the registry address for this session
            session_doc = await self.db.sessions.find_one({"session_id": session_id}, projection={"participant_registry_address": 1})
            registry_addr = session_doc.get('participant_registry_address') if session_doc else None
            if not registry_addr:
                 # Try fetching from factory if not in cache yet
                 _, registry_addr = await self.blockchain_service.get_session_addresses(session_id)
            
            if not registry_addr:
                 logger.warning(f"Cannot poll participants for session {session_id}: Registry address unknown.")
                 return
                 
            registry_contract = self.blockchain_service.get_registry_contract(registry_addr)
            
            # Get list of active holders (primary participants)
            # Note: If non-holder voters exist and need caching, logic needs adjustment
            # Pass session_id as required by the contract ABI
            active_holders = await self.blockchain_service.call_contract_function(registry_contract, "getActiveHolders", session_id)
            
            logger.info(f"Found {len(active_holders)} active holders for session {session_id}. Updating cache...")
            
            # Update cache for each holder
            tasks = [self.update_participant_cache(session_id, holder_addr) for holder_addr in active_holders]
            await asyncio.gather(*tasks)
            logger.debug(f"Finished participant cache update tasks for session {session_id}.")
            
            # TODO: Add logic to find/update non-holder registered voters if needed
            # TODO: Add logic to detect/remove participants from cache if they unregister (if possible)
            
        except Exception as e:
             logger.error(f"Error polling participants for session {session_id}: {e}", exc_info=True)

    async def poll_all_participant_data(self):
        """Periodically polls participant data for all known sessions."""
        logger.info("Starting periodic participant data poller...")
        await asyncio.sleep(30) # Initial delay

        while not self._stop_event.is_set():
            try:
                logger.debug("Polling all participant data...")
                # Find all cached session IDs
                cached_sessions_cursor = self.db.sessions.find({}, projection={"session_id": 1, "_id": 0})
                session_ids = [doc['session_id'] async for doc in cached_sessions_cursor]

                if not session_ids:
                    logger.debug("No sessions found in cache to poll participants for.")
                else:
                    logger.info(f"Polling participant data for {len(session_ids)} cached sessions.")
                    # Poll participants for each session sequentially to avoid overwhelming node/DB?
                    # Or use asyncio.gather with controlled concurrency?
                    # Let's do sequentially for now.
                    for sid in session_ids:
                        await self.poll_participants_for_session(sid)
                        # Small delay between sessions? 
                        await asyncio.sleep(0.5) 
                
                # Wait for the next polling interval
                await asyncio.sleep(PARTICIPANT_POLL_INTERVAL)

            except asyncio.CancelledError:
                logger.info("Participant poller task cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in participant poller loop: {e}", exc_info=True)
                await asyncio.sleep(PARTICIPANT_POLL_INTERVAL * 2)
                
        logger.info("Participant poller stopped.")

    async def start(self):
        """Starts the background tasks for listening and polling."""
        if self._listener_task is None or self._listener_task.done():
             self._listener_task = asyncio.create_task(self.listen_for_events())
             logger.info("CacheService event listener task created.")
        else:
             logger.warning("Event listener task already running.")
             
        if self._status_poller_task is None or self._status_poller_task.done():
             self._status_poller_task = asyncio.create_task(self.poll_session_statuses())
             logger.info("CacheService status poller task created.")
        else:
             logger.warning("Status poller task already running.")
             
        # Start participant poller
        if self._participant_poller_task is None or self._participant_poller_task.done():
             self._participant_poller_task = asyncio.create_task(self.poll_all_participant_data())
             logger.info("CacheService participant poller task created.")
        else:
             logger.warning("Participant poller task already running.")

    def stop(self):
        """Signals the background tasks to stop."""
        logger.info("Requesting CacheService background tasks to stop...")
        self._stop_event.set()
        # Optionally wait for tasks to finish here if needed, 
        # but cancellation is usually handled by main app shutdown

# --- Update startup function --- 

async def startup_cache_service(blockchain_service: BlockchainService, db: AsyncIOMotorDatabase) -> CacheService:
    """Creates CacheService instance, populates initial cache, and starts background tasks."""
    cache_service = CacheService(blockchain_service, db)
    await cache_service.populate_initial_cache() # Populate cache first
    await cache_service.start() # Start listener and poller tasks
    return cache_service 
# Backend Rewrite & Clean-up Task List

### General Development Rules

*   **Always Read First:** Before creating or modifying any file, always read its existing content (if any) to understand the current state. Do not make assumptions about file existence or content.
*   **Verify and Confirm:** Explicitly verify existing structures and confirm requirements before implementing changes.
*   **Keep Tasks Updated:** Regularly update this document (`BACKEND_REWRITE_TASKS.md`) by marking tasks as completed (e.g., checking off `[ ]` to `[X]`) as they are finished.
*   **Refactor Large Files:** Prioritize refactoring for any service or utility file exceeding approximately 500 lines of code to maintain readability and manageability.
*   **Modularity & Single Responsibility:** Strive for modular code. Each function, class, and service should ideally have a single, well-defined responsibility.
*   **Clarity & Readability:** Write clear, concise, and readable code. Use meaningful names for variables, functions, and classes.
*   **DRY (Don't Repeat Yourself):** Avoid code duplication. Abstract common logic into reusable functions or utilities.
*   **Consistent Error Handling:** Aim for consistent error handling patterns, making it clear how errors are propagated.
*   **Immutability (where practical):** Prefer immutable data structures and pure functions when appropriate to reduce side effects and improve predictability.

## Phase 1: Core Cleanup & Read Foundation

*   [x] **1.1. Remove Cryptographic Functions & Related Code**
    *   [x] Remove/Overhaul `app/services/crypto.py` (File not found, assumed already removed or integrated elsewhere if minimal).
    *   [x] Identify and remove all code related to vote encryption, decryption, and cryptographic share generation/submission from other backend services and routers (Primarily by commenting out private key usage, `send_transaction`, and `create_vote_session` in `blockchain.py`).
*   [x] **1.2. Remove Obsolete API Endpoints**
    *   [x] Remove `POST /api/messages` endpoint (or equivalents for submitting votes/shares) (No direct equivalent found; `POST /vote-sessions/create` commented out).
    *   [x] Analyze and remove/replace endpoints related to "Agents" if they are fully covered by the new participant model (No specific "Agent" endpoints found for removal; existing holder/participant endpoints are read/validation focused).
    *   [x] Commented out `POST /vote-sessions/trigger-reward-distribution` as it implies a write operation.
*   [x] **1.3. Refactor Blockchain Service for Read Operations**
    *   [x] Modify `app/services/blockchain.py` to remove or comment out write operations.
    *   [x] Confirmed existing read capabilities in `app/services/blockchain.py` will serve as a basis for new APIs.
    *   [x] Confirmed ABIs are loaded from files.
*   [x] **1.4. Update Configuration**
    *   [x] Review and update `api.ini`.
    *   [x] `VOTE_SESSION_FACTORY_ADDRESS` is primary; old `CONTRACT_ADDRESS` (for single session) is not used.
    *   [x] Commented out `WALLET_ADDRESS` and `PRIVATE_KEY` in `api.ini` as backend moves to read-only for core functions.

## Phase 2: Session Information API & Caching

*   [x] **2.1. Design & Implement New Database Schema (Sessions - MongoDB)**
    *   [x] Define document structure for `sessions` collection in MongoDB (fields: `session_id` (acting as `_id`), `vote_session_address`, `participant_registry_address`, `title`, `description`, `start_date_ts` (timestamp), `end_date_ts` (timestamp), `shares_collection_end_date_ts` (timestamp), `options`, `metadata_contract`, `required_deposit_wei`, `min_share_threshold`, `actual_min_share_threshold`, `current_status_str`, `decryption_threshold`, `alphas`, `last_synced_ts` (timestamp)).
    *   [x] Define Pydantic models (`SessionCacheModel`, API response schemas) in `app/schemas/session.py`.
    *   [x] Created MongoDB connection utility `app/db/mongodb_utils.py`.
    *   [x] Integrated MongoDB connection into `main.py` lifecycle.
    *   [x] Confirmed `motor` dependency in `requirements.txt`.
*   [x] **2.2. Implement Session API Endpoints**
    *   [x] Implement `GET /api/sessions` endpoint (fetching from MongoDB cache in `vote_session_router.py`).
    *   [x] Implement `GET /api/sessions/{sessionId}` endpoint (fetching from MongoDB cache in `vote_session_router.py`).
    *   [x] Implement `GET /api/sessions/{sessionId}/status` endpoint (fetching from MongoDB cache in `vote_session_router.py`).
    *   [x] Created corresponding Pydantic schemas for API responses.
*   [x] **2.3. Implement Initial Caching for Session Data (MongoDB)**
    *   [x] Created `CacheService` (`app/services/cache_service.py`) with logic to populate/update MongoDB `sessions` collection.
    *   [x] Implemented event listening (`SessionPairDeployed`) and periodic status polling.
    *   [x] Integrated `CacheService` startup/shutdown into `main.py` lifecycle.
*   [ ] **2.4. Testing (Phase 2)**
    *   [ ] Write unit tests for new Pydantic response schemas and any data transformation logic.
    *   [ ] Write integration tests for the new session API endpoints, mocking the service/database layer or using a test MongoDB instance.
    *   [ ] Write integration tests for the caching mechanism (blockchain interaction to MongoDB update).

## Phase 3: Participant & Vote/Share Data API & Caching

*   [x] **3.1. Design & Implement New Database Schema (Participants - MongoDB)**
    *   [x] Define document structure for `session_participants` collection in MongoDB.
    *   [x] Define Pydantic models (`ParticipantCacheModel`, `ParticipantListItem`, `ParticipantDetail`) in `app/schemas/participant.py`.
*   [x] **3.2. Implement Participant API Endpoints**
    *   [x] Implement `GET /api/sessions/{sessionId}/participants` endpoint (fetching from MongoDB cache in `holder_router.py`).
    *   [x] Implement `GET /api/sessions/{sessionId}/participants/{participantAddress}` endpoint (fetching from MongoDB cache in `holder_router.py`).
    *   [x] Created corresponding Pydantic schemas.
*   [x] **3.3. Implement Vote & Share Data API Endpoints (Read-Only from Blockchain)**
    *   [x] Review existing `GET /encrypted-votes/info/{vote_session_id}` and `GET /shares/get-shares/{vote_session_id}`. Confirmed they fetch directly from blockchain.
    *   [x] Decided to defer caching for vote/share data for now.
    *   [x] Confirmed existing schemas/responses are acceptable for now.
*   [x] **3.4. Extend Caching for Participant Data (MongoDB)**
    *   [x] Update `CacheService` to populate/update the `session_participants` collection in MongoDB (`update_participant_cache`).
    *   [x] Implement periodic polling for participant data (`poll_all_participant_data`, `poll_participants_for_session`).
*   [ ] **3.5. Testing (Phase 3)**
    *   [ ] Write unit tests for new schemas and participant data logic.
    *   [ ] Write integration tests for new participant and vote/share data API endpoints.
    *   [ ] Test caching for participant data.

## Phase 4: Admin, Finalization & Documentation

*   [x] **4.1. Implement Administrative APIs (If Necessary)**
    *   [x] Created `admin_router.py`.
    *   [x] Implemented `POST /api/admin/cache/refresh` endpoint to trigger full cache refresh.
    *   [x] Decided against single-session refresh endpoint for now.
*   [x] **4.2. Refine Authentication & Authorization**
    *   [x] Created `app/core/security.py` and consolidated logic.
    *   [x] Refactored `auth_router.py`.
    *   [x] Created and applied `get_current_admin_user` dependency to `admin_router.py`.
    *   [x] Verified public data endpoints remain public.
*   [ ] **4.3. Database Cleanup (MongoDB) - MANUAL**
    *   [ ] Manually check MongoDB instance for obsolete collections (e.g., `messages`, `agents` from old design) and remove/migrate them.
    *   [ ] Ensure remaining collections (`users`, `sessions`, `session_participants`, `election_metadata`) align with current schemas.
*   [ ] **4.4. Comprehensive Testing - MANUAL**
    *   [ ] Conduct end-to-end testing of all API endpoints.
    *   [ ] Verify data consistency between blockchain (mocked/Hardhat) and API responses via MongoDB cache.
    *   [ ] Test error handling and edge cases.
*   [ ] **4.5. Update Backend Documentation - MANUAL**
    *   [ ] Manually update `backend/README.md` with the provided content reflecting the new architecture, API endpoints, MongoDB schema, caching strategy, and setup instructions.
*   [ ] **4.6. Code Review & Refinement - MANUAL**
    *   [ ] Conduct a full code review of the rewritten backend.
    *   [ ] Refactor and optimize as needed.

## General/Ongoing Tasks

*   [ ] **Resolve Open Questions:**
    *   [x] Clarify the role of "Agents" and confirm if they map to "Participants/Holders" (Considered mapped for now, no separate Agent logic found for removal).
    *   [x] Confirm if any backend administrative *on-chain* transactions are required (Assumed none for now, `PRIVATE_KEY` removed from active use).
    *   [x] Confirm the definitive database technology (MongoDB confirmed).
*   [ ] **Maintain Test Coverage:** Ensure new code is accompanied by relevant unit and integration tests.
*   [ ] **Dependency Management:** Update `requirements.txt` as dependencies change (e.g., add MongoDB client like Motor).
*   [ ] **Configuration Management:** Ensure `api.ini` (or equivalent) is kept up-to-date and secure.

This task list should help guide the backend rewrite process. Remember to mark items as complete as you progress! 
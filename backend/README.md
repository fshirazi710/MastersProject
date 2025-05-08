# Timed Release Crypto System Backend (Rewritten)

## Overview

This backend service provides the API for the Timed Release Crypto System. It has been rewritten to primarily serve read-only data fetched from the blockchain and cached in a MongoDB database. The frontend application is now responsible for handling most user interactions that require blockchain transactions (e.g., creating sessions, registering, voting, submitting shares).

The core responsibilities of this backend include:

*   Providing comprehensive information about vote sessions and participants via a RESTful API.
*   Caching blockchain data (sessions, participants) in MongoDB for performance and reduced blockchain load.
*   Keeping the cache updated via event listening and periodic polling.
*   Handling user registration and authentication (JWT-based).
*   Providing endpoints for validating data (e.g., BLS keys) and reading raw data like encrypted votes and decryption shares directly from the blockchain.

## Architecture & Key Components

The backend is built using FastAPI and follows a standard structure:

*   **`main.py`**: FastAPI application entry point, manages application lifecycle (startup/shutdown), includes routers, and sets up middleware (CORS). Handles startup/shutdown of database connections and the caching service.
*   **`api.ini` / `app/core/config.py`**: Configuration loading (database URL, web3 provider, JWT secrets, factory address, etc.). Uses Pydantic Settings.
*   **`app/routers/`**: Defines API endpoints.
    *   `vote_session_router.py`: Endpoints related to vote sessions (`/api/sessions`, `/api/sessions/{id}`, `/api/sessions/{id}/status`, `/api/sessions/{id}/metadata`). Serves data primarily from the MongoDB cache.
    *   `holder_router.py`: Endpoints related to participants (`/api/sessions/{id}/participants`, `/api/sessions/{id}/participants/{addr}`). Serves data primarily from the MongoDB cache.
    *   `encrypted_vote_router.py`: Endpoints for encrypted votes (`/api/encrypted-votes/info/{id}`) reading directly from the blockchain, and BLS key validation.
    *   `share_router.py`: Endpoints for decryption shares (`/api/shares/get-shares/{id}`) reading directly from the blockchain, and share validation.
    *   `auth_router.py`: Handles user registration (`/api/auth/register`) and login (`/api/auth/login`).
    *   `admin_router.py`: Administrative endpoints (`/api/admin/cache/refresh`) requiring admin authentication.
*   **`app/services/`**: Contains core business logic.
    *   `blockchain_service.py`: Handles all interactions with the Ethereum blockchain using `web3.py`. Loads contract ABIs and provides methods to call contract functions (primarily read-only now).
    *   `cache_service.py`: Manages the MongoDB cache. Listens for `SessionPairDeployed` events, periodically polls session statuses and participant details, and updates the MongoDB collections (`sessions`, `session_participants`).
*   **`app/schemas/`**: Pydantic models defining data structures for API requests, responses, and database documents.
    *   `session.py`: `SessionCacheModel`, `SessionApiResponseItem`, `SessionDetailApiResponse`, etc.
    *   `participant.py`: `ParticipantCacheModel`, `ParticipantListItem`, `ParticipantDetail`.
    *   Others for auth, basic responses, etc.
*   **`app/db/`**: Database related utilities.
    *   `mongodb_utils.py`: Handles MongoDB connection using `motor`, provides FastAPI dependency (`get_mongo_db`).
*   **`app/core/`**: Core utilities.
    *   `config.py`: Pydantic settings model.
    *   `security.py`: Password hashing, JWT token creation/verification, user/admin retrieval dependencies.
    *   `dependencies.py`: Common FastAPI dependencies (e.g., `get_blockchain_service`).
    *   `error_handling.py`: Utility functions for consistent error responses.
*   **`app/models/`**: Data models (e.g., `user_model.py` potentially used with auth).

## MongoDB Schema

The backend utilizes MongoDB for caching and user data:

1.  **`sessions`**: Caches core session information.
    *   Structure defined by `app.schemas.session.SessionCacheModel`.
    *   Key fields: `session_id` (used as `_id`), `vote_session_address`, `participant_registry_address`, `title`, status fields, timestamps, contract parameters (`required_deposit_wei`, `min_share_threshold`, etc.), `last_synced_ts`.
2.  **`session_participants`**: Caches participant details for each session.
    *   Structure defined by `app.schemas.participant.ParticipantCacheModel`.
    *   Key fields: `session_id`, `participant_address`, `is_holder`, `is_registered`, status booleans (`has_submitted_shares`, `has_submitted_decryption_value`, `has_voted`), `bls_public_key_hex`, `deposit_amount_wei`, `last_synced_ts`.
    *   Recommended index: Compound index on `{ session_id: 1, participant_address: 1 }`.
3.  **`users`**: Stores user authentication data.
    *   Key fields: `email`, `name`, `role`, `password` (hashed), `created_at`.
4.  **`election_metadata`**: Stores frontend-specific display metadata.
    *   Key fields: `vote_session_id`, `displayHint`, `sliderConfig`.

## Caching Strategy (`CacheService`)

The `app.services.cache_service.CacheService` is responsible for keeping the MongoDB cache (`sessions`, `session_participants`) synchronized with the blockchain state:

1.  **Initial Population**: On application startup, it fetches the total number of deployed sessions from the `VoteSessionFactory` contract and populates the `sessions` collection in MongoDB with details for each existing session.
2.  **New Session Detection**: It listens for `SessionPairDeployed` events emitted by the `VoteSessionFactory` contract. When a new session is detected, it fetches its details and adds it to the `sessions` cache. It also triggers an initial fetch of participants for that new session.
3.  **Session Status Polling**: It periodically polls all sessions stored in the cache, fetches their latest details (including status, actual thresholds, decryption parameters) from the blockchain using `BlockchainService`, and updates the `sessions` collection.
4.  **Participant Data Polling**: It periodically polls participant data. For each session in the cache, it fetches the list of active holders from the corresponding `ParticipantRegistry` contract. For each participant, it fetches their latest details (from the Registry) and status flags (vote status, decryption value submission status from the `VoteSession` contract) and updates the `session_participants` collection.

This combination of event listening and polling aims to provide reasonably up-to-date information via the API while minimizing direct blockchain calls for frequent data requests. Vote and Share data itself is *not* cached currently and is read directly from the blockchain via dedicated API endpoints.

## Setup & Development

### Prerequisites

*   Python 3.10+
*   MongoDB instance
*   Access to an Ethereum node (e.g., local Hardhat/Anvil node, Infura, Alchemy)

### Configuration

Configuration is managed via `api.ini`. Key settings include:

*   `[DATABASE]`:
    *   `DATABASE_URL`: Your MongoDB connection string (e.g., `mongodb://user:pass@host:port/timedReleaseCryptoDB`).
*   `[BLOCKCHAIN]`:
    *   `WEB3_PROVIDER_URL`: HTTP URL for your Ethereum node.
    *   `VOTE_SESSION_FACTORY_ADDRESS`: Deployed address of the `VoteSessionFactory` contract.
*   `[SECURITY]`:
    *   `SECRET_KEY`: Secret key for JWT token generation (generate a strong random key).
*   `[JWT]`:
    *   `ALGORITHM`: JWT algorithm (e.g., `HS256`).
    *   `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time.
*   `[CORS]`:
    *   `CORS_ALLOWED_ORIGINS`: List of allowed frontend origins (e.g., `["http://localhost:3000"]`).

*Note: Consider using environment variables alongside or instead of `api.ini` for sensitive data like database credentials and secret keys, potentially using `python-dotenv` and adapting `app/core/config.py`.*

### Installation

1.  Clone the repository.
2.  Navigate to the `backend` directory.
3.  Create a virtual environment (recommended):
```bash
python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\\activate`
    ```
4.  Install dependencies:
    ```bash
pip install -r requirements.txt
```
5.  Configure `api.ini` with your settings.

### Running the Application

Use Uvicorn to run the FastAPI application:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

*   `--reload`: Enables auto-reload on code changes (for development).
*   `--host 0.0.0.0`: Makes the server accessible on your network.
*   `--port 8000`: Specifies the port (adjust if needed).

The API documentation (Swagger UI) will be available at `http://localhost:8000/docs`.

## API Endpoints

Refer to the auto-generated documentation at `/docs` for a full list of endpoints, request/response models, and testing capabilities. Key public endpoints include:

*   `GET /api/sessions`: List all vote sessions (summary).
*   `GET /api/sessions/{session_id}`: Get details for a specific session.
*   `GET /api/sessions/{session_id}/participants`: List participants for a session.
*   `GET /api/sessions/{session_id}/participants/{participant_address}`: Get details for a specific participant.
*   `GET /api/encrypted-votes/info/{vote_session_id}`: Get encrypted vote data.
*   `GET /api/shares/get-shares/{vote_session_id}`: Get decryption share data.
*   `POST /api/auth/register`: Register a new user.
*   `POST /api/auth/login`: Log in and get a JWT token.

Admin endpoints (require authentication):

*   `POST /api/admin/cache/refresh`: Trigger a full cache refresh.

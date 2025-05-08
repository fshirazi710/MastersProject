# Backend API Endpoint Documentation

This document outlines the available API endpoints for the frontend.

## General Notes

*   All API responses are wrapped in a `StandardResponse` object, which has the following structure:
    ```json
    {
        "success": true,
        "message": "Descriptive message",
        "data": { ... } // Actual data payload, type varies by endpoint
    }
    ```
    or in case of an error (e.g., HTTP 4xx, 5xx), the response will be a standard FastAPI error JSON.
*   Timestamps in responses are generally ISO 8601 strings (e.g., `"2023-10-27T10:30:00Z"`) or Unix timestamps (integers) where specified (suffixed with `Ts`).
*   Monetary amounts (like deposits, rewards) are generally returned as strings in Ether.

## Vote Session API

Base Path: `/api/vote-sessions`

Router: `backend/app/routers/vote_session_router.py`

These endpoints manage vote session data, primarily read from the MongoDB cache.

---

### 1. Get All Vote Sessions

*   **Endpoint:** `GET /all`
*   **Full Path:** `/api/vote-sessions/all`
*   **Description:** Retrieves summary information for all deployed vote sessions from the cache.
*   **Response Data (`data` field):** `List[SessionApiResponseItem]`
    *   **`SessionApiResponseItem` Schema:**
        *   `id: int` - The session ID.
        *   `title: Optional[str]` - Title of the vote session.
        *   `status: Optional[str]` - Current status string (e.g., "Pending", "VotingOpen", "VotingClosed", "Tallying", "Complete").
        *   `startDate: Optional[str]` - ISO 8601 timestamp for the start date.
        *   `endDate: Optional[str]` - ISO 8601 timestamp for the end date.
        *   `vote_session_address: Optional[str]` - Contract address of the vote session.
        *   `participant_registry_address: Optional[str]` - Contract address of the participant registry.

---

### 2. Get Vote Session Details

*   **Endpoint:** `GET /session/{vote_session_id}`
*   **Full Path:** `/api/vote-sessions/session/{vote_session_id}`
*   **Description:** Retrieves detailed information for a specific vote session from the cache.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Response Data (`data` field):** `SessionDetailApiResponse`
    *   **`SessionDetailApiResponse` Schema:**
        *   `id: int` - The session ID.
        *   `title: Optional[str]`
        *   `description: Optional[str]`
        *   `startDate: Optional[str]` - ISO 8601 timestamp.
        *   `endDate: Optional[str]` - ISO 8601 timestamp.
        *   `sharesEndDate: Optional[str]` - ISO 8601 timestamp for when share collection ends.
        *   `status: Optional[str]` - Current status string.
        *   `options: Optional[List[str]]` - List of voting options.
        *   `metadata_contract: Optional[str]` - Metadata string from the contract.
        *   `required_deposit_eth: Optional[str]` - Required deposit in Ether (string).
        *   `min_share_threshold: Optional[int]` - Minimum shares required from contract parameters.
        *   `vote_session_address: Optional[str]`
        *   `participant_registry_address: Optional[str]`
        *   `actual_min_share_threshold: Optional[int]` - Actual minimum share threshold after considering registered participants.
        *   `participant_count: Optional[int]` - (Placeholder, needs count from participant cache/collection)
        *   `secret_holder_count: Optional[int]` - (Placeholder, needs count from participant cache/collection)
        *   `reward_pool: Optional[str]` - (Placeholder, in Ether, needs calculation/retrieval)
        *   `released_keys: Optional[int]` - (Placeholder, count of submitted shares)
        *   `displayHint: Optional[str]` - UI display hint from metadata.
        *   `sliderConfig: Optional[Dict[str, Any]]` - Slider configuration from metadata.

---

### 3. Get Vote Session Status

*   **Endpoint:** `GET /session/{vote_session_id}/status`
*   **Full Path:** `/api/vote-sessions/session/{vote_session_id}/status`
*   **Description:** Retrieves the current status and key timestamps for a specific vote session from the cache.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Response Data (`data` field):** `SessionStatusApiResponse`
    *   **`SessionStatusApiResponse` Schema:**
        *   `status: str` - Current status string.
        *   `startDateTs: Optional[int]` - Unix timestamp for the start date.
        *   `endDateTs: Optional[int]` - Unix timestamp for the end date.
        *   `sharesEndDateTs: Optional[int]` - Unix timestamp for shares collection end date.

---

### 4. Get Vote Session Frontend Metadata

*   **Endpoint:** `GET /session/{vote_session_id}/metadata`
*   **Full Path:** `/api/vote-sessions/session/{vote_session_id}/metadata`
*   **Description:** Retrieves display hint and slider configuration metadata for a specific vote session (reads from `election_metadata` DB collection).
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Response Data (`data` field):** `VoteSessionMetadata`
    *   **`VoteSessionMetadata` Schema:**
        *   `vote_session_id: int`
        *   `displayHint: Optional[str]`
        *   `sliderConfig: Optional[Dict[str, Any]]`

---

## Participant API (Holders)

Base Path: `/api/sessions/{vote_session_id}/participants`

Router: `backend/app/routers/holder_router.py`

These endpoints manage participant (secret holder) data for a specific session, read from the MongoDB cache.

---

### 1. Get All Participants for a Session

*   **Endpoint:** `GET /`
*   **Full Path:** `/api/sessions/{vote_session_id}/participants/`
*   **Description:** Retrieves a list of all participants (holders) for a specific vote session from the cache.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Response Data (`data` field):** `List[ParticipantListItem]`
    *   **`ParticipantListItem` Schema:**
        *   `session_id: int`
        *   `participant_address: str` - Ethereum address of the participant.
        *   `is_registered: Optional[bool]` - Whether the participant is registered.
        *   `has_submitted_shares: Optional[bool]` - Whether the participant has submitted their shares.

---

### 2. Get Participant Details

*   **Endpoint:** `GET /{participant_address}`
*   **Full Path:** `/api/sessions/{vote_session_id}/participants/{participant_address}`
*   **Description:** Retrieves detailed information for a specific participant in a vote session from the cache.
*   **Path Parameters:**
    *   `vote_session_id: int` - The ID of the vote session.
    *   `participant_address: str` - Ethereum address of the participant.
*   **Response Data (`data` field):** `ParticipantDetail`
    *   **`ParticipantDetail` Schema:**
        *   `session_id: int`
        *   `participant_address: str`
        *   `is_registered: Optional[bool]`
        *   `has_submitted_shares: Optional[bool]`
        *   `has_voted: Optional[bool]` - (Likely always `false` as voting is frontend-driven).
        *   `deposit_amount_eth: Optional[str]` - Deposit amount in Ether (string).

---

## Encrypted Vote API

Base Path: `/api/encrypted-votes`

Router: `backend/app/routers/encrypted_vote_router.py`

These endpoints handle operations related to encrypted votes. Data is currently read directly from the blockchain.

---

### 1. Validate Public Key Format

*   **Endpoint:** `POST /validate-public-key`
*   **Full Path:** `/api/encrypted-votes/validate-public-key`
*   **Description:** Validates the format of a provided BLS public key.
*   **Request Body:** `PublicKeyValidateRequest`
    ```json
    {
        "public_key": "0x..." 
    }
    ```
*   **Response Data (`data` field):** `bool` - `true` if format is valid, `false` otherwise.

---

### 2. Get Encrypted Vote Information for a Session

*   **Endpoint:** `POST /info/{vote_session_id}`
*   **Full Path:** `/api/encrypted-votes/info/{vote_session_id}`
*   **Description:** Retrieves all submitted encrypted vote data for a specific vote session directly from the blockchain.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Request Body:** (Empty)
*   **Response Data (`data` field):** `List[Dict[str, Any]]`
    *   Each dictionary represents an encrypted vote:
        *   `id: int` - The session ID.
        *   `vote_index: int` - Index of the vote within the session's vote array.
        *   `ciphertext: Optional[str]` - Ciphertext as a hex string.
        *   `g1r: Optional[str]` - g1r component as a hex string.
        *   `g2r: Optional[str]` - g2r component as a hex string.
        *   `alphas: List[str]` - List of alpha components, each as a hex string.
        *   `voter: str` - Ethereum address of the voter.
        *   `threshold: int` - Threshold associated with the vote.

---

### 3. Check Vote Eligibility

*   **Endpoint:** `POST /eligibility/{vote_session_id}`
*   **Full Path:** `/api/encrypted-votes/eligibility/{vote_session_id}`
*   **Description:** Checks if a voter is eligible to submit an encrypted vote by querying blockchain state (session status, registration, if already voted). This endpoint does NOT submit the vote.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Request Body:** `dict`
    ```json
    {
        "voter_address": "0x..." 
    }
    ```
*   **Response Data (`data` field):** None. The `message` field in `StandardResponse` will indicate eligibility. `success` will be `true` if eligible. HTTP errors (403, 404, 409) indicate ineligibility or issues.

---

## Share API

Base Path: `/api/shares`

Router: `backend/app/routers/share_router.py`

These endpoints handle decryption share submission verification and retrieval. Data is currently read directly from the blockchain.

---

### 1. Verify Share Submission Signature

*   **Endpoint:** `POST /submit-share/{vote_session_id}`
*   **Full Path:** `/api/shares/submit-share/{vote_session_id}`
*   **Description:** Verifies a signed share submission request from a holder. The actual share submission transaction is expected to be sent by the frontend. Checks signature and on-chain status (registration, prior submission).
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Request Body:** `ShareListSubmitRequest`
    ```json
    {
        "public_key": "0x...", // Holder's Ethereum address
        "shares": [
            { "vote_id": 0, "share": "0x..." }, // vote_id is the index of the encrypted vote
            { "vote_id": 1, "share": "0x..." }
        ],
        "signature": "0x..." // Signature of the message constructed from session_id, sorted shares, and public_key
    }
    ```
*   **Response Data (`data` field):** None. The `message` field in `StandardResponse` indicates verification success. `success` will be `true` if verified.

---

### 2. Get Submitted Shares for a Session

*   **Endpoint:** `GET /get-shares/{vote_session_id}`
*   **Full Path:** `/api/shares/get-shares/{vote_session_id}`
*   **Description:** Retrieves all submitted decryption shares for a specific vote session directly from the blockchain, grouped by the original encrypted vote's index.
*   **Path Parameter:**
    *   `vote_session_id: int` - The ID of the vote session.
*   **Response Data (`data` field):** `List[Dict[str, Any]]`
    *   Each dictionary corresponds to an original encrypted vote's index (`vote_index`):
        *   `vote_index: int`
        *   `submitted_shares: List[Dict[str, Any]]`
            *   Each share dictionary:
                *   `holder_address: str` - Address of the holder who submitted this share.
                *   `share_index: int` - The index of this share (from the contract, e.g., for threshold schemes).
                *   `share_value: Optional[str]` - The decryption share value as a hex string.
        *   `count: int` - Number of submitted shares for this `vote_index`.

---

## Admin API

Base Path: `/api/admin`

Router: `backend/app/routers/admin_router.py`

These endpoints are for administrative tasks and require admin authentication (JWT).

---

### 1. Trigger Full Cache Refresh

*   **Endpoint:** `POST /cache/refresh`
*   **Full Path:** `/api/admin/cache/refresh`
*   **Description:** Triggers a full refresh of the MongoDB cache. This involves re-populating all session data from the blockchain and then re-populating all participant data for those sessions.
*   **Authentication:** Requires admin user (JWT in Authorization header: `Bearer <token>`).
*   **Request Body:** (Empty)
*   **Response Data (`data` field):** None. The `message` field in `StandardResponse` indicates success/failure of initiating the refresh.

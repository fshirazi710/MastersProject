# Frontend Refactoring Plan

This document outlines the plan for refactoring the frontend of the MastersProject, focusing on aligning pages and components with the new `frontend/services` architecture, improving code quality, and ensuring UI/UX consistency.

## Overall Goals & Principles

-   **Service-Oriented Architecture:** All blockchain interactions and complex client-side logic should be handled by the services defined in `frontend/services/`. Vue components should primarily consume these services.
-   **Modularity & Reusability:** Break down complex components into smaller, reusable units.
-   **Clarity & Maintainability:** Improve code readability, add necessary comments where logic is non-trivial, and ensure a consistent coding style.
-   **State Management:** Review and standardize state management. Use Pinia stores for global/shared state if not already consistently applied. Local component state should be used where appropriate.
-   **Error Handling:** Ensure robust error handling in components, utilizing error information propagated from services. Display user-friendly error messages.
-   **UI/UX Consistency:** Apply consistent styling, layout, and user experience patterns across all pages and components. Leverage `_variables.scss` and `_mixins.scss`.
-   **Security:** Ensure that user inputs are validated and sanitized appropriately, especially when dealing with cryptographic operations or data passed to services.

## Completed Tasks

- [ ] (No tasks completed yet)
- [x] **Update `frontend/services/api.js`:**
    - [x] Review and update all functions in `frontend/services/api.js` (e.g., `authApi`, `voteSessionApi`, `encryptedVoteApi`, `holderApi`, `shareApi`).
    - [x] Ensure all endpoints, request methods (GET/POST), path parameters, query parameters, and request/response bodies align precisely with the `Backend API Endpoint Documentation.md`.
    - [x] Verify that data transformations (if any) before sending requests or after receiving responses are correct.
    - [x] Standardize error handling for API calls within this service.

## In Progress Tasks

- [ ] Define overall refactoring strategy and create this plan.

## Future Tasks

### I. Global Tasks
- [ ] **Project Setup & Linting:**
    - [ ] Ensure ESLint, Prettier, and Stylelint are configured and consistently used across the project.
    - [ ] Run linters and auto-formatters on all existing `.vue` and `.scss` files.
- [ ] **State Management Review (Pinia):**
    - [ ] Identify all shared state across components/pages.
    - [ ] Refactor to use Pinia stores for managing shared application state (e.g., user connection status, current session ID, global loading states).
    - [ ] Ensure Pinia stores are well-structured and modular.
- [ ] **Notification System:**
    - [ ] Implement/standardize a global notification system (e.g., using a library like `vue-toastification`) for displaying success messages, errors, and warnings originating from service calls or component logic.
- [ ] **Loading State Management:**
    - [ ] Implement a consistent strategy for displaying loading indicators during asynchronous operations (service calls, contract interactions). This could involve a global loading store/component or local loading states within components.
- [ ] **Internationalization (i18n) - Placeholder:**
    - [ ] (Optional, if planned) Review text strings and plan for i18n integration if necessary for future scalability.
- [ ] **Accessibility (a11y) Review:**
    - [ ] Perform a basic accessibility audit and make improvements (e.g., ARIA attributes, keyboard navigation, color contrast).

### II. Page-Specific Refactoring (`frontend/pages`)

**General Approach for each page:**
1.  Identify the core purpose and user flows of the page.
2.  Map existing functionality to the available frontend services (`blockchainProviderService`, `factoryService`, `registryParticipantService`, `registryFundService`, `registryAdminService`, `voteSessionAdminService`, `voteSessionVotingService`, `voteSessionViewService`, and utility services).
3.  Refactor data fetching, state management, and user interactions to use these services.
4.  Clean up component logic, remove redundant code, and improve readability.
5.  Ensure consistent error handling and display of loading states.
6.  Update styling to align with global style guidelines and page-specific SCSS.

---
**1. `create-vote-session.vue` (19KB, 562 lines)**
    - [x] **Purpose:** Allows users to create new vote sessions. (Marking as Complete)
    - [x] **Refactoring Tasks:**
        - [x] **Form Handling:**
            - [x] Review and refactor form input validation (dates, title, description, options, deposit, threshold).
            - [x] Ensure all parameters for `factoryService.createVoteSession` are correctly gathered and validated.
            - [x] Implement reactive error state for individual fields (`formErrors`).
            - [x] Display validation errors inline next to respective form fields.
            - [x] Add real-time validation on input blur.
        - [x] **Service Integration:**
            - [x] Use `factoryService.createVoteSession` for submitting the form data.
            - [x] Ensure `startDate`, `endDate`, `sharesEndDate` are correctly converted to Unix timestamps.
            - [x] Ensure `requiredDeposit` is converted to Wei (BigInt) and `minShareThreshold` is a number/string.
            - [x] Ensure metadata (for options or slider) is correctly constructed and stringified.
            - [x] Decision: Funding of reward pool to be handled on the `session/[id].vue` page post-creation, not in this form. This is now a task for `session/[id].vue`.
        - [x] **Styling:**
            - [x] Create `frontend/assets/styles/pages/_create-vote.scss`.
            - [x] Move styles from `create-vote-session.vue` to `_create-vote.scss`.
            - [x] Refactor SCSS in `_create-vote.scss` to use global variables (`_variables.scss`) and mixins (`_mixins.scss`).
            - [x] Import `_create-vote.scss` in `create-vote-session.vue`.

---
**2. `all-vote-sessions.vue` (10KB, 317 lines)**
    - [x] **Purpose:** Displays a list of all available vote sessions. (Marking as Complete)
    - [x] **Refactoring Tasks:** 
        - [x] **Data Fetching:**
            - [x] Use `voteSessionApi.getAllVoteSessions()` (from the updated `frontend/services/api.js` which wraps `/api/vote-sessions/all`).
            - [x] ~~If direct contract interaction is preferred for some summary data, use `factoryService.getDeployedSessionCount()` and iterate with `factoryService.getVoteSessionAddressByIndex()` followed by calls to `voteSessionViewService.getSessionInfo()` for each. *Backend API is likely more efficient here.*~~ (Decided to use API)
            - [x] Removed N+1 calls for `participantCount` and `secretHolderCount`.
            - [x] Ensured data transformation aligns with `SessionApiResponseItem` fields.
            - [x] **Note:** `participantCount` and `secretHolderCount` have been removed from the summary card display as they are not available in the `/api/vote-sessions/all` endpoint response. These details are more suitable for the individual session view (`pages/session/[id].vue`).
            - [x] **Action Required:** The `relevantStatuses` array in the component needs to be populated with actual status strings and labels from the backend API for correct section display and filtering. (Marked as done based on user accepting previous changes)
        - [x] **Display Logic:**
            - [x] Refactored how session data is displayed (card view, sections by status).
            - [x] Ensure all relevant information from `SessionApiResponseItem` is shown (ID, title, status, dates, addresses).
            - [x] Implement pagination or infinite scrolling if the number of sessions can be large. (Client-side pagination implemented)
        - [x] **Navigation:**
            - [x] Ensure clicking on a session navigates to its detailed view (e.g., `/session/{session.id}`). (Button text changed to "View Details")
        - [x] **Error Handling & Loading:**
            - [x] Display loading state while fetching sessions.
            - [x] Show appropriate messages if no sessions are found or if an error occurs during fetching.
        - [x] **Styling:**
            - [x] Review and align styling with global styles and potentially a shared "list" or "card" style. (Applied variables/mixins)

---
**3. `index.vue` (2.4KB, 75 lines) - Homepage**
    - [ ] **Purpose:** Main landing page of the application.
    - [ ] **Refactoring Tasks:**
        - [ ] **Content Review:**
            - [ ] Update content to accurately reflect the application's features.
            - [ ] Ensure clear calls to action (e.g., "View Vote Sessions", "Create a Session", "Login/Register").
        - [ ] **Service Integration (if any):**
            - [ ] May not require direct service integration if it's mostly static content or links.
            - [ ] If it shows summary stats (e.g., total active sessions), use appropriate API/service calls.
        - [ ] **Styling:**
            - [ ] Ensure styling aligns with `_home.scss` and global styles.

---
**4. `login.vue` (2.4KB, 94 lines)**
    - [ ] **Purpose:** User login.
    - [ ] **Refactoring Tasks:**
        - [ ] **Authentication Logic:**
            - [ ] This likely involves wallet connection. Use `blockchainProviderService.init()` to connect wallet.
            - [ ] Store connection status, account, chainId in Pinia store.
            - [ ] If there's a backend JWT authentication flow post-wallet connection, integrate with the relevant API endpoint.
        - [ ] **Form Handling:**
            - [ ] If any form fields beyond wallet connection (e.g. for a traditional backend auth), validate inputs.
        - [ ] **User Feedback & Redirection:**
            - [ ] Provide feedback on login success/failure.
            - [ ] Redirect to an appropriate page upon successful login (e.g., dashboard or previous page).
        - [ ] **Styling:**
            - [ ] Ensure styling aligns with `_login.scss` and global styles.

---
**5. `register.vue` (4.8KB, 187 lines)**
    - [ ] **Purpose:** User registration.
    - [ ] **Refactoring Tasks:**
        - [ ] **Authentication/Wallet Logic:**
            - [ ] Similar to login, primarily involves wallet connection using `blockchainProviderService.init()`.
            - [ ] If registration involves more than just connecting a wallet (e.g., creating a profile on a backend), integrate with relevant API endpoints.
        - [ ] **Form Handling:**
            - [ ] Validate any registration-specific form fields.
        - [ ] **User Feedback & Redirection:**
            - [ ] Provide feedback on registration success/failure.
            - [ ] Redirect to an appropriate page upon successful registration.
        - [ ] **Styling:**
            - [ ] Ensure styling aligns with `_register.scss` and global styles.

---
**6. `faq.vue` (1.7KB, 49 lines)**
    - [ ] **Purpose:** Displays frequently asked questions.
    - [ ] **Refactoring Tasks:**
        - [ ] **Content Management:**
            - [ ] Review and update FAQ content.
            - [ ] Consider if FAQ data should be hardcoded, fetched from a static JSON, or a simple CMS. For now, assume hardcoded or simple JSON.
        - [ ] **Display Logic:**
            - [ ] Ensure questions and answers are displayed clearly (e.g., using accordions).
        - [ ] **Styling:**
            - [ ] Ensure styling aligns with `_faq.scss` and global styles.

---
**7. `frontend/pages/session/[id].vue` (Assumed file for session details, needs creation or check if `create-vote-session.vue` doubles for view/edit)**
    - [ ] **Purpose:** Display detailed information and actions for a specific vote session. This is a crucial page.
    - [ ] **Refactoring Tasks (assuming this page is the main interaction hub for a session):**
        - [ ] **Data Fetching:**
            - [ ] On load, get `sessionId` from route params.
            - [ ] Fetch session details using `voteSessionApi.getVoteSessionById(sessionId)` (from `frontend/services/api.js`).
            - [ ] Fetch session status using an appropriate function from `frontend/services/api.js` that calls `/api/vote-sessions/session/{vote_session_id}/status`.
            - [ ] Fetch participant list for the session using an appropriate function from `frontend/services/api.js` that calls `/api/sessions/{vote_session_id}/participants/`.
            - [ ] Fetch current user's participation status using `registryParticipantService.getParticipantInfo(sessionId, currentUserAddress)`.
        - [ ] **Displaying Session Information:**
            - [ ] Display title, description, dates, status, options, deposit, threshold, participant count, etc.
            - [ ] Dynamically show/hide sections based on session status and user's role/actions.
        - [ ] **Conditional Rendering of Components:**
            - [ ] Based on session status (`voteSessionViewService.getStatus` or API status) and user's status (`registryParticipantService.getParticipantInfo`), conditionally render components like:
                - `RegisterToVote.vue` (if registration open and user not registered)
                - `CastYourVote.vue` (if voting open, user registered, and not voted)
                - `SubmitSecretShare.vue` (if shares collection open, user is holder and hasn't submitted)
                - `HolderStatusAndClaim.vue` (for holders to see status and claim rewards/deposits)
                - `VoteResults.vue` or `ResultsDisplay.vue` (if tallying complete/session complete)
                - `DecryptionFailed.vue` / `ResultsPending.vue` as appropriate.
        - [ ] **State Management:**
            - [ ] Manage the current session's data, status, and user-specific data within the page's local state or a dedicated Pinia store if complex.
        - [ ] **Component Structure Review:**
            - [ ] Review the organization of components within `frontend/components/vote/` that are utilized by this page. Ensure logical structure, clear props, and maintainability. Consider if any components should be further broken down or if their responsibilities are well-defined.
        - [ ] **Error Handling & Loading:**
            - [ ] Comprehensive loading states for all data fetching.
            - [ ] Robust error handling for API and service calls.
        - [ ] **Styling:**
            - [ ] Align with `_vote-details.scss` and global styles.
        - [ ] **Implement Reward Funding UI/Logic:**
            - [ ] Add a section/button visible only to the session owner (check ownership via `voteSessionViewService.getSessionOwner`).
            - [ ] Include an input field for the ETH amount to add as rewards.
            - [ ] On submission, call `registryFundService.addRewardFunding(sessionId, amountInWei)` after converting input ETH to Wei.
            - [ ] Provide loading state and success/error feedback (use notification system).
        - [ ] **Implement Secret Holder Key Management:**
            - [ ] **Key Generation/Import (during Holder Registration - likely in `RegisterToVote.vue` context):**
                - [ ] Implement UI for user to choose between generating a new BLS key pair or importing an existing private key.
                - [ ] If generating: Use `blsCryptoUtils.generateBLSKeyPair()`.
                - [ ] If importing: Validate the format of the imported private key string.
            - [ ] **Secure Private Key Storage (Client-Side):**
                - [ ] Prompt user for a strong password specifically for key encryption.
                - [ ] Encrypt the BLS private key using the password (e.g., via `aesUtils.encryptWithPassword`).
                - [ ] Offer secure storage options:
                    - [ ] Store encrypted key payload in browser Local Storage, clearly associated with the session/user.
                    - [ ] Allow user to download the encrypted key payload as a file (e.g., `session-{id}-secret-key.json`).
            - [ ] **Key Retrieval/Usage (during Share Submission - likely in `SubmitSecretShare.vue` context):**
                - [ ] Determine if encrypted key is in Local Storage or needs file upload.
                - [ ] Prompt user for their password.
                - [ ] Decrypt the private key in memory using the password (e.g., via `aesUtils.decryptWithPassword`).
                - [ ] Use the in-memory private key *only* for calculating shares (`blsCryptoUtils.calculateDecryptionShareForSubmission`).
                - [ ] Clear the decrypted private key from memory immediately after use.
            - [ ] **Key Management UI (on session page for registered holders):**
                - [ ] Display indication that the user is a registered holder.
                - [ ] Provide UI options (e.g., a 'Manage Key' section/button) to:
                    - [ ] Re-download/backup the encrypted key file.
                    - [ ] Remove the encrypted key from Local Storage.
                    - [ ] (Optional) Import/replace key from an encrypted backup file.
            - [ ] **User Feedback & Security Notes:**
                - [ ] Provide clear instructions and warnings about password importance and backup responsibility.

### III. Component-Specific Refactoring (`frontend/components/vote`)

**General Approach for each component:**
1.  Confirm its specific role within a vote session's lifecycle.
2.  Ensure it receives necessary props (e.g., `sessionId`, `voteSessionAddress`, `participantRegistryAddress`).
3.  Integrate strictly with the relevant frontend services for its actions and data needs.
4.  Emit events or use a Pinia store to communicate status changes or results to the parent page.
5.  Handle user inputs, validation, loading states, and error feedback.

---
**1. `RegisterToVote.vue` (13KB, 360 lines)**
    - [ ] **Purpose:** Allows users to register as a holder or voter for a session.
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`.
        - [ ] **Service Integration:**
            - [ ] Check if registration is open: `voteSessionViewService.isRegistrationOpen(voteSessionAddress)`. (Requires resolving `voteSessionAddress` via `factoryService.getSessionAddresses(sessionId)` or passed as prop).
            - [ ] Get required deposit: `voteSessionViewService.getRequiredDeposit(voteSessionAddress)`.
            - [ ] Register as holder: `registryParticipantService.registerAsHolder(sessionId, blsPublicKeyHex)`. This implies the component needs to handle BLS key input/generation or retrieval.
                - The BLS Public Key (`blsPublicKeyHex`) likely needs to be generated client-side or fetched if previously stored/associated with the user. `cryptographyUtils.js` or similar might be involved if generation is needed.
            - [ ] Register as voter: `registryParticipantService.registerAsVoter(sessionId)`.
        - [ ] **Input Handling:** BLS Public Key input if registering as a holder.
        - [ ] **User Feedback:** Clear messages for success/failure, loading states.
        - [ ] **Styling:** Review and ensure consistency.

---
**2. `CastYourVote.vue` (14KB, 390 lines)**
    - [ ] **Purpose:** Allows registered participants to cast their encrypted vote.
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`, `voteSessionAddress`, `options` (list of vote options).
        - [ ] **Service Integration:**
            - [ ] Check if voting is open: `voteSessionViewService.getStatus(voteSessionAddress)` should be `VotingOpen` (after `voteSessionAdminService.updateSessionStatus` if status is dynamic).
            - [ ] Check if user has already voted: `voteSessionViewService.hasVoted(voteSessionAddress, currentUserAddress)`.
            - [ ] Get active holder BLS keys: `registryParticipantService.getHolderBlsKeys(sessionId)` (needed for `encryptVoteData`).
            - [ ] Get `actualMinShareThreshold` from `voteSessionViewService.getActualMinShareThreshold(voteSessionAddress)` or `minShareThreshold` from `voteSessionViewService.getSessionInfo(voteSessionAddress)` to use as `voteEncryptionThreshold`.
            - [ ] **Vote Encryption:**
                - User selects an option.
                - [ ] **AES Key Management:** Finalize and implement the strategy for managing the ephemeral `aesKey` passed to `voteCryptoUtils.encryptVoteData`. Consider secure local/session storage or user-managed input, prioritizing security and UX.
                - Generate/retrieve an AES key for this vote. `shamirUtils.getKAndSecretShares` might be used if the AES key itself needs to be sharded, or `aesUtils.importBigIntAsCryptoKey` if `k` is directly used to derive an AES key. The `FRONTEND_SERVICES_DOCUMENTATION.md` mentions `encryptVoteData` in `cryptographyUtils.js` (and `voteCryptoUtils.js`) which takes an `aesKey`. This key needs a defined origin/management strategy.
                - Use `voteCryptoUtils.encryptVoteData(selectedOption, aesKey, activeHolderBlsPublicKeys, voteEncryptionThreshold)` to prepare vote parameters.
            - [ ] Cast vote: `voteSessionVotingService.castEncryptedVote(voteSessionAddress, ciphertext, g1r, g2r, alpha, threshold)`.
        - [ ] **User Feedback:** Loading, success/error messages.
        - [ ] **Styling:** Review and ensure consistency.

---
**3. `SubmitSecretShare.vue` (14KB, 359 lines)**
    - [ ] **Purpose:** Allows holders to submit their decryption shares.
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`, `voteSessionAddress`.
        - [ ] **Service Integration:**
            - [ ] Check if shares collection is open: `voteSessionViewService.getStatus(voteSessionAddress)` should be `SharesCollectionOpen`.
            - [ ] Get user's participant info: `registryParticipantService.getParticipantInfo(sessionId, currentUserAddress)` to confirm they are a holder and haven't submitted shares.
            - [ ] **Share Calculation:**
                - The component needs to iterate through all encrypted votes for the session. Fetch votes via `encryptedVoteApi.getEncryptedVoteInfo(sessionId)` (from `frontend/services/api.js`).
                - For each vote (`vote_index`, `g1r`), the holder needs their BLS private key. This is a critical security concern. The private key might be derived from a password + stored encrypted payload using `cryptographyUtils.calculateDecryptionValue` (which uses `aesUtils.decryptWithPassword`).
                - Calculate share: `blsCryptoUtils.calculateDecryptionShareForSubmission(blsPrivateKey, g1r_hex_from_vote)`.
            - [ ] Get participant index: `registryParticipantService.getParticipantIndex(sessionId, currentUserAddress)`. This is `_shareIndex` for `submitDecryptionShare`.
            - [ ] **Submit Shares (Two-Step Process):**
                - [ ] **1. Verification via Backend API:** For the list of calculated shares, construct the `ShareListSubmitRequest` payload (including signature). Call `shareApi.submitShare(sessionId, payload)` (from `frontend/services/api.js`) to verify the shares with the backend.
                - [ ] **2. Contract Interaction via Frontend Service:** If backend verification is successful, proceed to call `voteSessionVotingService.submitDecryptionShare(voteSessionAddress, voteIndex, shareData, shareIndex)` for each share to submit it to the smart contract. (This may require iterating if the service handles one share at a time).
        - [ ] **User Feedback:** Progress, success/error messages.
        - [ ] **BLS Private Key Handling:** Securely manage/derive the user's BLS private key.
        - [ ] **Styling:** Review.

---
**4. `HolderStatusAndClaim.vue` (9.5KB, 275 lines)**
    - [ ] **Purpose:** For holders to view their status (submitted shares, rewards owed) and claim deposits/rewards.
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`, `participantRegistryAddress`.
        - [ ] **Data Fetching:**
            - [ ] Get participant info: `registryParticipantService.getParticipantInfo(sessionId, currentUserAddress)`.
            - [ ] Get rewards owed: `registryFundService.getRewardsOwed(sessionId, currentUserAddress)`.
            - [ ] Check if deposit claimed: `registryParticipantService.hasClaimedDeposit(sessionId, currentUserAddress)`.
            - [ ] Check if reward claimed: `registryFundService.hasClaimedReward(sessionId, currentUserAddress)`.
        - [ ] **Service Integration (Actions):**
            - [ ] Check deposit claim period: `voteSessionViewService.isDepositClaimPeriodActive(voteSessionAddress)`.
            - [ ] Claim deposit: `registryParticipantService.claimDeposit(sessionId)`.
            - [ ] Claim reward: `registryFundService.claimReward(sessionId)`. (Assumes reward calculation is done).
        - [ ] **Display Logic:** Conditionally show claim buttons based on status and eligibility.
        - [ ] **User Feedback:** Loading, success/error for claims.
        - [ ] **Styling:** Review.

---
**5. `VoteResults.vue` (8.9KB, 271 lines)**
    - [ ] **Purpose:** Displays the results of the vote after tallying.
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`.
        - [ ] **Data Fetching:**
            - [ ] Fetch submitted shares: `shareApi.getShares(sessionId)` (from `frontend/services/api.js`). This provides shares grouped by `vote_index`.
            - [ ] Fetch encrypted votes: `encryptedVoteApi.getEncryptedVoteInfo(sessionId)` (from `frontend/services/api.js`). This provides `ciphertext` for each vote.
            - [ ] **Decryption Logic (Client-Side Tallying):**
                - For each `vote_index`:
                    - Get the list of `submitted_shares` and the original `ciphertext`.
                    - Reconstruct the AES key: This involves `shamirUtils.recomputeKey` using the collected shares (`share_value` from API). The `participantShares` for `recomputeKey` needs `index` (holder's original registration index, obtainable from `registryParticipantService.getParticipantIndex`) and `value` (the share).
                    - Decrypt the vote: `voteCryptoUtils.decryptVote(ciphertext, reconstructedAesKey)`.
                - Aggregate decrypted votes to show final tally per option.
        - [ ] **Display Logic:** Show vote counts for each option, potentially charts.
        - [ ] **Error Handling:** Handle cases where decryption fails for some votes (e.g., insufficient shares submitted).
        - [ ] **Styling:** Review.

---
**6. `ResultsDisplay.vue` (9.3KB, 324 lines)**
    - [ ] **Purpose:** Alternative or enhanced display for vote results. Possibly includes more detailed views or visualizations.
    - [ ] **Refactoring Tasks:**
        - [ ] Similar to `VoteResults.vue` regarding data fetching and decryption logic.
        - [ ] Differentiate its purpose from `VoteResults.vue`. If it's a more detailed view, ensure it leverages the decrypted data appropriately.
        - [ ] **Visualization:** Implement charts or other visual aids for results.
        - [ ] **Styling:** Review.

---
**7. `DecryptionFailed.vue` (4.3KB, 167 lines)**
    - [ ] **Purpose:** Displays a message when decryption of results cannot proceed (e.g., insufficient shares).
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`, potentially error messages or reasons.
        - [ ] **Display Logic:** Clearly explain why decryption failed.
        - [ ] **Possible Actions:** Suggest next steps if any (e.g., "Contact admin", "Wait for more shares").
        - [ ] **Styling:** Review.

---
**8. `ResultsPending.vue` (5.0KB, 186 lines)**
    - [ ] **Purpose:** Displays a message when results are not yet available (e.g., voting period not ended, tallying in progress).
    - [ ] **Refactoring Tasks:**
        - [ ] **Props:** `sessionId`, current session status.
        - [ ] **Display Logic:** Explain that results are pending and why. Possibly show expected availability time.
        - [ ] **Auto-Refresh (Optional):** Consider adding a mechanism to periodically check for results.
        - [ ] **Styling:** Review.

### IV. Styling Refactoring (`frontend/assets/styles`)

**General Approach for styles:**
1.  Consolidate common styles into `_variables.scss` and `_mixins.scss`.
2.  Ensure a BEM-like methodology or a consistent naming convention for CSS classes.
3.  Remove unused or redundant styles.
4.  Ensure responsiveness and cross-browser compatibility.
5.  Improve organization of page-specific SCSS files.

---
**1. `main.scss` (1.2KB, 53 lines)**
    - [ ] **Review:** Check for global styles, imports of variables/mixins, and base element styling.
    - [ ] **Tasks:**
        - [ ] Ensure it correctly imports `_variables.scss`, `_mixins.scss`, and potentially a reset/normalize CSS.
        - [ ] Define sensible global styles for typography, layout basics, etc.

---
**2. `_variables.scss` (1019B, 28 lines)**
    - [ ] **Review:** Check for color palette, typography settings, spacing units, breakpoints.
    - [ ] **Tasks:**
        - [ ] Standardize variable naming (e.g., `$primary-color`, `$font-size-large`).
        - [ ] Ensure all frequently used and theme-related values are defined as variables.
        - [ ] Add comments to explain variable groups or complex variables.

---
**3. `_mixins.scss` (558B, 34 lines)**
    - [ ] **Review:** Check for reusable style patterns (e.g., flexbox helpers, media query mixins, button styles).
    - [ ] **Tasks:**
        - [ ] Identify common style patterns across components/pages and convert them into mixins.
        - [ ] Ensure mixins are well-documented and parameterized for flexibility.

---
**4. Page-Specific Styles (`frontend/assets/styles/pages`)**
    - Files: `_vote-details.scss`, `_register.scss`, `_login.scss`, `_become-holder.scss`, `_create-vote.scss`, `_faq.scss`, `_home.scss`.
    - [ ] **For each file:**
        - [ ] **Review:** Ensure styles are scoped to the respective page or its components.
        - [ ] **Tasks:**
            - [ ] Remove any styles that can be achieved using global styles, variables, or mixins.
            - [ ] Refactor class names for consistency (e.g., BEM).
            - [ ] Ensure styles are modular and do not overly rely on deep nesting.
            - [ ] Check for overrides of global styles and minimize them. If `_become-holder.scss` is for a specific component/page not listed above, identify its target.
            - [ ] **Verify `_become-holder.scss`:** Check if `_become-holder.scss` is still relevant. If styling an old/removed feature, delete the file. Otherwise, ensure its styles are correctly applied and scoped to its target page/component.

### V. Other Components (`frontend/components`)

---
**1. `AppLayout.vue` (2.5KB, 124 lines)**
    - [ ] **Purpose:** Main application layout (header, footer, navigation, content slot).
    - [ ] **Refactoring Tasks:**
        - [ ] **Wallet Connection Display:** Use `blockchainProviderService` and Pinia store to display wallet connection status, current account, and network.
        - [ ] **Navigation:** Ensure navigation links are correct and update based on user auth status.
        - [ ] **Responsiveness:** Verify layout is responsive.
        - [ ] **Styling:** Ensure consistent application of global styles.

---
**2. Shared Components (`frontend/components/shared`)**
    - [ ] **Identify and Review:** List any generic, reusable components in this directory (e.g., buttons, modals, form inputs, cards).
    - [ ] **Refactoring Tasks (for each shared component):**
        - [ ] Ensure they are truly generic and customizable via props.
        - [ ] Ensure they use global styles, variables, and mixins effectively.
        - [ ] Add Storybook stories or examples if not already present, to facilitate development and testing.
        - [ ] Standardize event emitting.

## Implementation Plan

The refactoring will be carried out iteratively, focusing on one page or major component at a time.
1.  **Global Tasks First:** Address project setup, linting, and establish Pinia stores for core functionalities like wallet connection.
2.  **Core Pages:** Refactor `login.vue`, `register.vue`, then `all-vote-sessions.vue` and the session detail page (`/session/[id].vue`).
3.  **Session Interaction Components:** Refactor components like `RegisterToVote.vue`, `CastYourVote.vue`, `SubmitSecretShare.vue` in conjunction with the session detail page.
4.  **Results Components:** Refactor `VoteResults.vue`, `ResultsDisplay.vue`, and related status components.
5.  **Static Pages:** Refactor `index.vue`, `faq.vue`.
6.  **Styling:** Perform a global styling pass after major component refactoring, then fine-tune page-specific and component-specific styles.
7.  **Testing:** Unit tests for services are assumed to be in place. Add/update component tests as refactoring progresses, focusing on user interactions and props/events. End-to-end tests for key user flows should be considered.

## Relevant Files

(This section will be populated as refactoring progresses, listing each file touched, its purpose, dependencies, and provided functionalities, as per the `task-list` rule format. Initially, it will list the target files for refactoring.)

### Pages:
-   `frontend/pages/create-vote-session.vue`
    -   **Purpose:** UI for creating new vote sessions.
    -   **Provides:** Form for vote session parameters.
    -   **Depends on:** `factoryService`, (Potentially Pinia store for user state), `_create-vote.scss`.
    -   **Status:** To be refactored.
-   `frontend/pages/all-vote-sessions.vue`
    -   **Purpose:** Displays a list of all vote sessions.
    -   **Provides:** Overview of available vote sessions.
    -   **Depends on:** API service (for `/api/vote-sessions/all`), (Potentially `factoryService`, `voteSessionViewService` if fetching details individually).
    -   **Status:** To be refactored.
-   `frontend/pages/index.vue`
    -   **Purpose:** Application landing page.
    -   **Provides:** General information and navigation.
    -   **Depends on:** `_home.scss`.
    -   **Status:** To be refactored.
-   `frontend/pages/login.vue`
    -   **Purpose:** User login via wallet connection.
    -   **Provides:** Wallet connection interface.
    -   **Depends on:** `blockchainProviderService`, Pinia store (for user auth state), `_login.scss`.
    -   **Status:** To be refactored.
-   `frontend/pages/register.vue`
    -   **Purpose:** User registration (primarily wallet connection).
    -   **Provides:** Wallet connection interface for new users.
    -   **Depends on:** `blockchainProviderService`, Pinia store, `_register.scss`.
    -   **Status:** To be refactored.
-   `frontend/pages/faq.vue`
    -   **Purpose:** Displays frequently asked questions.
    -   **Provides:** Informational content.
    -   **Depends on:** `_faq.scss`.
    -   **Status:** To be refactored.
-   `frontend/pages/session/[id].vue` (Conceptual - needs creation or verification if another file serves this)
    -   **Purpose:** Detailed view and interaction hub for a single vote session.
    -   **Provides:** Comprehensive UI for vote lifecycle stages (registration, voting, share submission, results).
    -   **Depends on:** API services (for session details, status, participants), `voteSessionViewService`, `registryParticipantService`, various components from `frontend/components/vote/`, Pinia store, `_vote-details.scss`.
    -   **Status:** To be refactored/created.

### Components (`frontend/components/vote/`):
-   `frontend/components/vote/RegisterToVote.vue`
    -   **Purpose:** UI for users to register as a voter or holder.
    -   **Provides:** Registration form/actions.
    -   **Depends on:** `voteSessionViewService`, `registryParticipantService`, (Potentially `cryptographyUtils` for BLS key handling).
    -   **Status:** To be refactored.
-   `frontend/components/vote/CastYourVote.vue`
    -   **Purpose:** UI for casting an encrypted vote.
    -   **Provides:** Vote casting interface.
    -   **Depends on:** `voteSessionViewService`, `registryParticipantService`, `voteCryptoUtils`, `aesUtils`, `blsPointUtils`, `voteSessionVotingService`.
    -   **Status:** To be refactored.
-   `frontend/components/vote/SubmitSecretShare.vue`
    -   **Purpose:** UI for holders to submit their decryption shares.
    -   **Provides:** Share submission interface.
    -   **Depends on:** API service (for encrypted votes, submitting shares), `registryParticipantService`, `blsCryptoUtils`, (Potentially `aesUtils` for private key decryption), `voteSessionVotingService` (if submitting one by one via contract).
    -   **Status:** To be refactored.
-   `frontend/components/vote/HolderStatusAndClaim.vue`
    -   **Purpose:** UI for holders to see their status and claim rewards/deposits.
    -   **Provides:** Status display and claim actions.
    -   **Depends on:** `registryParticipantService`, `registryFundService`, `voteSessionViewService`.
    -   **Status:** To be refactored.
-   `frontend/components/vote/VoteResults.vue`
    -   **Purpose:** Displays tallied vote results.
    -   **Provides:** Vote results display.
    -   **Depends on:** API service (for shares, encrypted votes), `shamirUtils`, `voteCryptoUtils`, `aesUtils`.
    -   **Status:** To be refactored.
-   `frontend/components/vote/ResultsDisplay.vue`
    -   **Purpose:** Alternative/enhanced display for vote results.
    -   **Provides:** Detailed vote results visualization.
    -   **Depends on:** (Similar to `VoteResults.vue`).
    -   **Status:** To be refactored.
-   `frontend/components/vote/DecryptionFailed.vue`
    -   **Purpose:** Informs user that vote decryption failed.
    -   **Provides:** Error message display.
    -   **Depends on:** -
    -   **Status:** To be refactored.
-   `frontend/components/vote/ResultsPending.vue`
    -   **Purpose:** Informs user that vote results are pending.
    -   **Provides:** Status message display.
    -   **Depends on:** -
    -   **Status:** To be refactored.

### Components (General):
-   `frontend/components/AppLayout.vue`
    -   **Purpose:** Main application layout structure.
    -   **Provides:** Header, footer, navigation, main content area.
    -   **Depends on:** `blockchainProviderService`, Pinia store.
    -   **Status:** To be refactored.

### Styles (`frontend/assets/styles/`):
-   `frontend/assets/styles/main.scss`
    -   **Purpose:** Global styles and imports.
    -   **Provides:** Base application styling.
    -   **Depends on:** `_variables.scss`, `_mixins.scss`.
    -   **Status:** To be refactored.
-   `frontend/assets/styles/_variables.scss`
    -   **Purpose:** SCSS variables for theming and consistency.
    -   **Provides:** Design tokens (colors, fonts, spacing).
    -   **Depends on:** -
    -   **Status:** To be refactored.
-   `frontend/assets/styles/_mixins.scss`
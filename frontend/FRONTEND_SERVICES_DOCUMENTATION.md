# Frontend Services Documentation

This document provides a detailed overview of the frontend services, their functionalities, and how to use them. It is intended to guide the development of frontend pages that interact with these services.

## General Development Notes from INTEGRATION_TASKS.md

*   **ABI Loading:** Contract services load ABIs directly from `crypto-core/artifacts/contracts/CONTRACT_NAME.sol/CONTRACT_NAME.json`.
*   **Blockchain Interaction:** All contract services utilize `blockchainProvider.js` for contract interactions.
*   **Read vs. Write:** Clear separation between functions performing read operations (view/pure) and write operations (transactions).
*   **Data Conversion:** Necessary data type conversions (e.g., JavaScript numbers/strings to BigNumber for contract calls, and vice-versa for results) are performed by the services.
*   **Error Handling:** Services implement comprehensive error handling, catching errors from `blockchainProvider.js` and providing context-specific error messages.
*   **JSDoc:** All public functions should have JSDoc comments.
*   **Function Documentation Standard:** Each public function in a service is documented with:
    *   **Call Signature:** (e.g., `functionName(param1: type, param2: type): Promise<ReturnType>`)
    *   **Input(s):** Detailed description of each parameter, its expected type, and purpose.
    *   **Output:** Detailed description of the return value, its type, and structure.
    *   **Action:** Brief description of what the function does, including the primary smart contract method it calls (if any) and whether it's a read or write operation.

---

## 1. Core Blockchain Interaction

### `frontend/services/blockchainProvider.js`

Handles core Web3 provider/signer logic, network connections, and basic contract interaction utilities. It is exported as a singleton instance named `blockchainProviderService`.

**Key Responsibilities:**
*   Initialize and manage ethers.js provider (default read-only JSON RPC provider and/or wallet's browser provider) and signer.
*   Handle network changes and account changes from the connected wallet.
*   Provide generic functions for contract interaction (read, write, instance creation, event handling).
*   Offer utility functions (signing, hashing, Wei/Ether conversion).
*   Centralized error parsing for Ethers.js and contract reverts.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes properties. Attempts to set up a default read-only `ethers.JsonRpcProvider` if `config.blockchain.providerUrl` is available. Logs connection status or warnings.
*   **`async init(): Promise<boolean>`**
    *   **Output:** `Promise<boolean>`: True if wallet connection and initialization were successful.
    *   **Action:** Initializes the wallet connection (e.g., MetaMask). Sets up the `ethers.BrowserProvider` using `window.ethereum`, requests accounts, gets the signer, current account address, balance, and network chain ID. Attaches listeners for `accountsChanged` and `chainChanged` events from the wallet.
    *   **Throws:** `Error` if `window.ethereum` is not found, if the user rejects the connection, or if any other part of the initialization fails.
*   **`async setSigner(newSigner: ethers.Signer | null)`**
    *   **Input(s):** `newSigner: ethers.Signer | null`: An Ethers.js Signer object, or `null` to clear the current signer and account.
    *   **Action:** Allows explicitly setting or clearing the signer. If a signer is provided, it updates the internal account, provider (if available from signer), chainId, and balance.
*   **`getProvider(): ethers.BrowserProvider | ethers.JsonRpcProvider | null`**
    *   **Output:** `ethers.BrowserProvider | ethers.JsonRpcProvider | null`: The current Ethers.js provider instance (either the wallet's browser provider or the default JsonRpcProvider). Returns `null` if no provider is initialized.
    *   **Action:** Returns the current provider. Attempts to re-initialize the default JsonRpcProvider if no provider is currently set and a provider URL is available in config.
*   **`getSigner(): ethers.Signer | null`**
    *   **Output:** `ethers.Signer | null`: The current Ethers.js signer instance.
    *   **Action:** Returns the current signer. Returns `null` if no signer is initialized (e.g., wallet not connected or `init()` not called).
*   **`getAccount(): string | null`**
    *   **Output:** `string | null`: The current connected Ethereum account address.
    *   **Action:** Returns the current account address. Returns `null` if no account is connected.
*   **`getChainId(): string | null`**
    *   **Output:** `string | null`: The chain ID of the current network.
    *   **Action:** Returns the current network's chain ID. Returns `null` if undetermined.
*   **`isConnected(): boolean`**
    *   **Output:** `boolean`: True if the service has an active provider, signer, and account; false otherwise.
    *   **Action:** Checks if the service is fully connected and operational with a wallet.
*   **`async getBalance(): Promise<string | null>`**
    *   **Output:** `Promise<string | null>`: The balance of the current account in ETH string format, or `null` if unavailable.
    *   **Action:** Returns the locally stored balance of the current account.
*   **`async updateBalance(): Promise<string | null>`**
    *   **Output:** `Promise<string | null>`: The updated balance in ETH string format, or `null` if an error occurs or provider/account is not initialized.
    *   **Action:** Fetches and updates the balance for the current account from the blockchain.
*   **`getContractInstance(contractAddress: string, contractAbi: any, withSigner: boolean = false): ethers.Contract | null`**
    *   **Input(s):**
        *   `contractAddress: string`: The address of the smart contract.
        *   `contractAbi: any`: The ABI (Application Binary Interface) of the smart contract.
        *   `withSigner: boolean` (optional, default: `false`): If `true`, connects the contract instance with the current signer (for sending transactions). If `false`, connects with the current provider (for read-only calls).
    *   **Output:** `ethers.Contract | null`: An Ethers.js `Contract` instance, or `null` if the provider/signer is not available or if `contractAddress` or `contractAbi` is missing.
    *   **Action:** Creates and returns an Ethers.js `Contract` instance.
*   **`async signMessage(message: string): Promise<string>`**
    *   **Input(s):** `message: string`: The message to sign.
    *   **Output:** `Promise<string>`: The cryptographic signature of the message.
    *   **Action:** Requests the connected account (via the signer) to sign the provided string message.
    *   **Throws:** `Error` if the wallet is not connected, the signer is unavailable, or if the user rejects the signing request.
*   **`async readContract(contractInstance: ethers.Contract, methodName: string, args: any[] = []): Promise<any>`**
    *   **Input(s):**
        *   `contractInstance: ethers.Contract`: An Ethers.js `Contract` instance (can be connected to a provider or signer).
        *   `methodName: string`: The name of the view/pure function to call.
        *   `args: any[]` (optional, default: `[]`): Arguments for the contract method.
    *   **Output:** `Promise<any>`: The result of the contract call.
    *   **Action:** Calls a read-only (view or pure) function on the specified contract instance. Includes error handling for reverts.
    *   **Throws:** `Error` if the contract instance is invalid, not properly connected, the method doesn't exist, or the read operation fails.
*   **`async sendTransaction(contractInstance: ethers.Contract, methodName: string, args: any[] = [], options: object = {}, confirmations: number = 1): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `contractInstance: ethers.Contract`: An Ethers.js `Contract` instance (must be connected to a signer).
        *   `methodName: string`: The name of the state-changing function to call.
        *   `args: any[]` (optional, default: `[]`): Arguments for the contract method.
        *   `options: object` (optional, default: `{}`): Transaction overrides (e.g., `{ value: ethers.parseEther("0.1"), gasLimit: 1000000 }`).
        *   `confirmations: number` (optional, default: `1`): Number of block confirmations to wait for after the transaction is mined.
    *   **Output:** `Promise<ethers.TransactionReceipt>`: The transaction receipt once it's confirmed.
    *   **Action:** Sends a transaction to a state-changing function on the specified contract instance. Handles transaction submission, waits for the specified number of confirmations, and returns the receipt. Includes robust error handling for user rejection, reverts, gas issues, etc.
    *   **Throws:** `Error` if the contract instance is invalid, not connected to a signer, the method doesn't exist, the transaction is rejected by the user, or if the transaction fails on-chain.
*   **`async subscribeToEvent(contractInstance: ethers.Contract, eventName: string, callback: (...args: any[]) => void)`**
    *   **Input(s):**
        *   `contractInstance: ethers.Contract`: The Ethers.js contract instance.
        *   `eventName: string`: The name of the event to subscribe to.
        *   `callback: (...args: any[]) => void`: The function to call when the event is emitted. The callback will receive event arguments as parameters, followed by the event object itself.
    *   **Action:** Subscribes to a specified event on the given contract instance.
*   **`async unsubscribeFromEvent(contractInstance: ethers.Contract, eventName: string, callback?: (...args: any[]) => void)`**
    *   **Input(s):**
        *   `contractInstance: ethers.Contract`: The Ethers.js contract instance.
        *   `eventName: string`: The name of the event to unsubscribe from.
        *   `callback?: (...args: any[]) => void` (optional): The specific callback function to remove. If not provided, all listeners for the specified event are removed.
    *   **Action:** Unsubscribes from a contract event.
*   **`hashMessage(message: string): string`**
    *   **Input(s):** `message: string`: The message to hash.
    *   **Output:** `string`: The Keccak256 hash of the message (same as `ethers.utils.id`).
    *   **Action:** Hashes a string message using `ethers.utils.id`.
*   **`formatEther(weiValue: BigNumberish)`**
    *   **Input(s):** `weiValue: BigNumberish`: The value in Wei.
    *   **Output:** `string`: The value formatted as Ether.
    *   **Action:** Converts Wei to Ether string.
*   **`parseEther(etherValue: string)`**
    *   **Input(s):** `etherValue: string`: The value in Ether.
    *   **Output:** `BigNumber`: The value parsed as Wei.
    *   **Action:** Converts Ether string to Wei BigNumber.

---

## 2. Contract Services (`frontend/services/contracts/`)

These services provide interfaces for interacting with specific smart contracts.

**General Requirements:**
*   Utilize `blockchainProvider.js` for all interactions.
*   Load ABIs from `crypto-core/artifacts/`.
*   Separate read and write operations.
*   Handle data type conversions.
*   Implement comprehensive error handling.
*   Each service is typically a class exporting a singleton instance.
*   For registry-related services (`RegistryParticipantService`, `RegistryFundService`, `RegistryAdminService`):
    *   Import and use `factoryService.getSessionAddresses(sessionId)` to resolve the `registryAddress`.

### 2.1. `factoryService.js`

Interacts with `VoteSessionFactory.sol`. It is exported as a singleton instance named `factoryService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service. Loads the `VoteSessionFactory.json` ABI and the `ParticipantRegistry.json` ABI. Sets the `factoryAddress` from the application config.
*   **`async createVoteSession(params: object): Promise<{ sessionId: number | string, voteSessionContract: string, participantRegistryContract: string, owner: string }>`**
    *   **Input(s):** `params: object` containing:
        *   `title: string`
        *   `description: string`
        *   `startDate: number` (Unix timestamp)
        *   `endDate: number` (Unix timestamp)
        *   `sharesEndDate: number` (Unix timestamp)
        *   `options: string[]`
        *   `metadata: string` (e.g., IPFS hash or JSON string, defaults to `""` if not provided in params)
        *   `requiredDeposit: string | bigint` (Amount in ETH as string, or Wei as BigInt)
        *   `minShareThreshold: number | string`
    *   **Output:** `Promise<object>`: `{ sessionId: number | string, voteSessionContract: string, participantRegistryContract: string, owner: string }`. `sessionId` is a number if it fits, otherwise string.
    *   **Action:** Calls `VoteSessionFactory.createSessionPair()`. Parses the `SessionPairDeployed` event from the transaction receipt to get contract addresses and session ID. Then, calls `ParticipantRegistry.setVoteSessionContract()` on the new registry instance to link it to the new vote session contract. All interactions via `blockchainProviderService`. Write transaction.
    *   **Throws:** `Error` if factory/registry ABI/address is missing, if `blockchainProviderService` fails to get a signer, or if any contract call or event parsing fails.
*   **`async getDeployedSessionCount(): Promise<number>`**
    *   **Output:** `Promise<number>`: The total number of session pairs deployed.
    *   **Action:** Calls `VoteSessionFactory.getDeployedSessionCount()` via `blockchainProviderService`. Read operation.
    *   **Throws:** `Error` if factory address/ABI is missing or the read operation fails.
*   **`async getVoteSessionAddressByIndex(index: number | string): Promise<string>`**
    *   **Input(s):** `index: number | string`.
    *   **Output:** `Promise<string>`: The address of the `VoteSession` proxy contract.
    *   **Action:** Calls `VoteSessionFactory.getVoteSessionAddressByIndex()` via `blockchainProviderService`. Read operation.
    *   **Throws:** `Error` if factory address/ABI is missing, or the read operation fails (e.g., index out of bounds).
*   **`async getSessionAddresses(sessionId: number | string): Promise<{ sessionAddress: string | null, registryAddress: string | null }>`**
    *   **Input(s):** `sessionId: number | string`.
    *   **Output:** `Promise<object>`: `{ sessionAddress: string | null, registryAddress: string | null }`. Returns `null` for an address if the factory returns the zero address for it.
    *   **Action:** Calls `VoteSessionFactory.getVoteSessionAddressById()` and `VoteSessionFactory.getRegistryAddressById()` via `blockchainProviderService`. Read operation.
    *   **Throws:** `Error` if factory address/ABI is missing or the read operations fail.
*   **`async getFactoryOwner(): Promise<string>`**
    *   **Output:** `Promise<string>`: The address of the factory owner.
    *   **Action:** Calls `VoteSessionFactory.owner()` via `blockchainProviderService`. Read operation.
    *   **Throws:** `Error` if factory address/ABI is missing or the read operation fails.
*   **`async transferFactoryOwnership(newOwner: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `newOwner: string`: The address of the new owner.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSessionFactory.transferOwnership()` via `blockchainProviderService`. Write transaction.
    *   **Throws:** `Error` if factory address/ABI is missing, signer is unavailable, or the transaction fails.

### 2.2. `registryParticipantService.js`

Handles participant registration and information aspects of `ParticipantRegistry.sol`. It is exported as a singleton instance named `registryParticipantService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service. Loads `ParticipantRegistry.json` ABI and `VoteSession.json` ABI (the latter for pre-condition checks like registration period).
*   **`async registerAsHolder(sessionId: string | number, blsPublicKeyHex: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `blsPublicKeyHex: string`: The participant's BLS public key in hex format.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `ParticipantRegistry.joinAsHolder(sessionId, blsPublicKeyHex)` on the specific registry for the session. Fetches `requiredDeposit` from the associated `VoteSession` contract (via `voteSessionViewService`) and sends it as `msg.value`. Requires a prior check that registration is open via `voteSessionViewService.isRegistrationOpen()`. Write transaction.
    *   **Throws:** `Error` if inputs are invalid, registry/session addresses cannot be resolved, registration is not open, or the transaction fails.
*   **`async registerAsVoter(sessionId: string | number): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `ParticipantRegistry.registerAsVoter(sessionId)` on the specific registry for the session. Requires a prior check that registration is open via `voteSessionViewService.isRegistrationOpen()`. Write transaction.
    *   **Throws:** `Error` if `sessionId` is invalid, registry/session addresses cannot be resolved, registration is not open, or the transaction fails.
*   **`async getParticipantInfo(sessionId: string | number, participantAddress: string): Promise<object | null>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `participantAddress: string`: The address of the participant.
    *   **Output:** `Promise<object | null>`: An object with participant details (`{ isRegistered, isHolder, depositAmount, blsPublicKeyHex, hasSubmittedShares }`) where `depositAmount` is formatted to Ether string, or `null` if the participant is not registered or an error occurs.
    *   **Action:** Calls `ParticipantRegistry.getParticipantInfo(sessionId, participantAddress)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` (but service code returns `null` on most errors here) if inputs are invalid or registry address cannot be resolved.
*   **`async getActiveHolders(sessionId: string | number): Promise<string[]>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<string[]>`: Array of active holder addresses (can be empty).
    *   **Action:** Calls `ParticipantRegistry.getActiveHolders(sessionId)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the read operation fails.
*   **`async getNumberOfActiveHolders(sessionId: string | number): Promise<number>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<number>`: Number of active holders.
    *   **Action:** Calls `ParticipantRegistry.getNumberOfActiveHolders(sessionId)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the read operation fails.
*   **`async getHolderBlsKeys(sessionId: string | number): Promise<{ addresses: string[], blsKeysHex: string[] }>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<object>`: `{ addresses: string[], blsKeysHex: string[] }`. Returns empty arrays if the contract result structure is unexpected.
    *   **Action:** Calls `ParticipantRegistry.getHolderBlsKeys(sessionId)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the read operation fails.
*   **`async getParticipantIndex(sessionId: string | number, participantAddress: string): Promise<number>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `participantAddress: string`: The address of the participant.
    *   **Output:** `Promise<number>`: The 1-based index of the participant (or 0 if not found/not a holder, as returned by contract and converted to Number).
    *   **Action:** Calls `ParticipantRegistry.getParticipantIndex(sessionId, participantAddress)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if inputs are invalid, registry address cannot be resolved, or the read operation fails.
*   **`async claimDeposit(sessionId: string | number): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `ParticipantRegistry.claimDeposit(sessionId)` on the specific registry for the session. Requires a prior check that the deposit claim period is active via `voteSessionViewService.isDepositClaimPeriodActive()`. Write transaction.
    *   **Throws:** `Error` if `sessionId` is invalid, registry/session addresses cannot be resolved, deposit claim period is not active, or the transaction fails.
*   **`async hasClaimedDeposit(sessionId: string | number, participantAddress: string): Promise<boolean>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `participantAddress: string`: The address of the participant.
    *   **Output:** `Promise<boolean>`: True if the participant has claimed their deposit, false otherwise.
    *   **Action:** Calls `ParticipantRegistry.depositClaimed(sessionId, participantAddress)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if inputs are invalid, registry address cannot be resolved, or the read operation fails.

### 2.2.2. `registryFundService.js`

Manages funding, claims, and financial queries for `ParticipantRegistry.sol`. It is exported as a singleton instance named `registryFundService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service, loads `ParticipantRegistry.json` ABI.
*   **`async addRewardFunding(sessionId: string | number, amountInWei: ethers.BigNumberish): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `amountInWei: ethers.BigNumberish`: The amount of Wei to add as reward funding.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `ParticipantRegistry.addRewardFunding(sessionId)` on the specific registry for the session, sending `amountInWei` as `msg.value`. Owner-only on contract. Write transaction.
    *   **Throws:** `Error` if inputs are invalid, registry address cannot be resolved, or the transaction fails.
*   **`async claimReward(sessionId: string | number): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `ParticipantRegistry.claimReward(sessionId)` on the specific registry for the session. Assumes the connected wallet in `blockchainProviderService` is the claimant. Write transaction.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the transaction fails.
*   **`async hasClaimedReward(sessionId: string | number, participantAddress: string): Promise<boolean>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `participantAddress: string`: The address of the participant.
    *   **Output:** `Promise<boolean>`: True if the participant has claimed their reward, false otherwise.
    *   **Action:** Calls `ParticipantRegistry.hasClaimedReward(sessionId, participantAddress)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if inputs are invalid, registry address cannot be resolved, or the read operation fails.
*   **`async getTotalRewardPool(sessionId: string | number): Promise<string>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<string>`: Total reward pool in Wei, as a string (or "0" if undefined from contract).
    *   **Action:** Calls `ParticipantRegistry.totalRewardPool(sessionId)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the read operation fails.
*   **`async getRewardsOwed(sessionId: string | number, participantAddress: string): Promise<string>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session.
        *   `participantAddress: string`: The address of the participant.
    *   **Output:** `Promise<string>`: Rewards owed to the participant in Wei, as a string (or "0" if undefined from contract).
    *   **Action:** Calls `ParticipantRegistry.rewardsOwed(sessionId, participantAddress)` on the specific registry for the session. Read operation.
    *   **Throws:** `Error` if inputs are invalid, registry address cannot be resolved, or the read operation fails.

### 2.2.3. `registryAdminService.js`

Handles administrative and owner-specific functions for `ParticipantRegistry.sol`. It is exported as a singleton instance named `registryAdminService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service. Loads the `ParticipantRegistry.json` ABI and the `VoteSession.json` ABI (the latter for potential pre-condition checks).
*   **`async setVoteSessionContract(sessionId: string | number, voteSessionContractAddress: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session (used to identify the correct `ParticipantRegistry` instance).
        *   `voteSessionContractAddress: string`: The address of the `VoteSession` contract to link.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Retrieves the specific `ParticipantRegistry` address using the `sessionId` via `factoryService`. Then calls `ParticipantRegistry.setVoteSessionContract(sessionId, voteSessionContractAddress)` on that registry instance. Owner-only. Write transaction.
    *   **Throws:** `Error` if `sessionId` or `voteSessionContractAddress` are invalid, if the registry address cannot be resolved, or if the transaction fails.
*   **`async calculateRewards(sessionId: string | number): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session for which to calculate rewards.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Retrieves the specific `ParticipantRegistry` address using the `sessionId`. Calls `ParticipantRegistry.calculateRewards(sessionId)` on that registry instance. Owner-only. Write transaction. (Note: The service code has a commented-out section to optionally check `VoteSession.isRewardCalculationPeriodActive()` before proceeding, which is a recommended practice.)
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the transaction fails.
*   **`async getRegistryOwner(sessionId: string | number): Promise<string>`**
    *   **Input(s):** `sessionId: string | number`: The ID of the session.
    *   **Output:** `Promise<string>`: The address of the registry owner.
    *   **Action:** Retrieves the specific `ParticipantRegistry` address using the `sessionId` via `factoryService`. Then calls `ParticipantRegistry.owner()` on that registry instance. Read operation.
    *   **Throws:** `Error` if `sessionId` is invalid, registry address cannot be resolved, or the read operation fails.
*   **`async transferRegistryOwnership(sessionId: string | number, newOwnerAddress: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `sessionId: string | number`: The ID of the session (to identify the correct `ParticipantRegistry`).
        *   `newOwnerAddress: string`: The address of the new owner.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Retrieves the specific `ParticipantRegistry` address using the `sessionId` via `factoryService`. Then calls `ParticipantRegistry.transferOwnership(newOwnerAddress)` on that registry instance. Owner-only. Write transaction.
    *   **Throws:** `Error` if `sessionId` or `newOwnerAddress` are invalid, registry address cannot be resolved, or the transaction fails.

### 2.3. Refactored `VoteSession` Services

The original `voteSessionService.js` has been refactored into three focused services.

**General Requirements for new VoteSession services:**
*   Each service is a class exporting a singleton instance.
*   Import and use `blockchainProviderService`.
*   Load and manage `VoteSession.json` ABI.
*   Align methods with `CONTRACT_API.md` for `VoteSession.sol`.
*   Implement JSDoc and error handling.
*   **Holder Submissions Note:** Services interacting with `submitDecryptionShare` and `submitDecryptionValue` must account for the `SharesCollectionOpen` period.

### 2.3.1. `voteSessionAdminService.js`

Handles admin/owner functions, status updates, and calculations for `VoteSession.sol`. It is exported as a singleton instance named `voteSessionAdminService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service, loads `VoteSession.json` ABI. (Internally defines a `_SessionStatusEnum` for mapping status codes to names, though not directly exposed).
*   **`async setDecryptionParameters(voteSessionAddress: string, alphas: string[], threshold: number | bigint): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `voteSessionAddress: string`: Address of the `VoteSession` contract.
        *   `alphas: string[]`: Array of alpha points (bytes32 hex strings).
        *   `threshold: number | bigint`: The decryption threshold (must be positive).
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.setDecryptionParameters(alphas, threshold)` on the contract. Owner-only. Write transaction.
    *   **Throws:** `Error` if inputs are invalid (address, alphas format, threshold value) or if the transaction fails.
*   **`async transferSessionOwnership(voteSessionAddress: string, newOwner: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `voteSessionAddress: string`: Address of the `VoteSession` contract.
        *   `newOwner: string`: The address of the new owner.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.transferOwnership(newOwner)` on the contract. Owner-only. Write transaction.
    *   **Throws:** `Error` if inputs are invalid (addresses) or if the transaction fails.
*   **`async updateSessionStatus(voteSessionAddress: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `voteSessionAddress: string`: Address of the `VoteSession` contract.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.updateSessionStatus()` on the contract. Anyone can call. Write transaction.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or if the transaction fails.
*   **`async triggerRewardCalculation(voteSessionAddress: string): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):** `voteSessionAddress: string`: Address of the `VoteSession` contract.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.triggerRewardCalculation()` on the contract. Typically called by admin after shares collection. Write transaction.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or if the transaction fails.

### 2.3.2. `voteSessionVotingService.js`

Handles casting votes, submitting shares/values for `VoteSession.sol`. It is exported as a singleton instance named `voteSessionVotingService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service, loads `VoteSession.json` ABI.
*   **`async castEncryptedVote(voteSessionAddress: string, ciphertext: ethers.BytesLike, g1r: ethers.BytesLike, g2r: ethers.BytesLike, alpha: ethers.BytesLike[], threshold: number | bigint): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `voteSessionAddress: string`: Address of the `VoteSession` contract.
        *   `ciphertext: ethers.BytesLike`: Encrypted vote data.
        *   `g1r: ethers.BytesLike`: g^r point component.
        *   `g2r: ethers.BytesLike`: (g2)^r point component.
        *   `alpha: ethers.BytesLike[]`: Array of bytes (e.g., public key shares or ZK proof components).
        *   `threshold: number | bigint`: Positive threshold associated with the vote/crypto setup.
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.castEncryptedVote(ciphertext, g1r, g2r, alpha, threshold)` on the contract. Write transaction.
    *   **Throws:** `Error` if inputs are invalid (address, bytes formats, threshold) or if the transaction fails.
*   **`async submitDecryptionShare(voteSessionAddress: string, voteIndex: number, share: ethers.BytesLike, shareIndex: number): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `voteSessionAddress: string`: Address of the `VoteSession` contract.
        *   `voteIndex: number`: Index of the vote the share corresponds to (non-negative).
        *   `share: ethers.BytesLike`: The decryption share data (bytes).
        *   `shareIndex: number`: The index of the holder submitting the share (non-negative).
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.submitDecryptionShare(voteIndex, share, shareIndex)` on the contract. This contract call typically also triggers `ParticipantRegistry.recordShareSubmission()`. Write transaction. Crucial step for holders during `SharesCollectionOpen` period.
    *   **Throws:** `Error` if inputs are invalid (address, indices, bytes format) or if the transaction fails.
*   **`async submitDecryptionValue(voteSessionAddress: string, value: ethers.BytesLike): Promise<ethers.TransactionReceipt>`**
    *   **Input(s):**
        *   `voteSessionAddress: string`: Address of the `VoteSession` contract.
        *   `value: ethers.BytesLike`: The decryption value (must be a 32-byte hex string).
    *   **Output:** `Promise<ethers.TransactionReceipt>`.
    *   **Action:** Calls `VoteSession.submitDecryptionValue(value)` on the contract. Requires prior successful share submission for the sender in `ParticipantRegistry`. Typically done during `SharesCollectionOpen` period. Write transaction.
    *   **Throws:** `Error` if inputs are invalid (address, value format) or if the transaction fails.

### 2.3.3. `voteSessionViewService.js`

Handles all read-only/getter functions for `VoteSession.sol`. It is exported as a singleton instance named `voteSessionViewService`.

**Public Functions:**

*   **`constructor()`**
    *   **Action:** Initializes the service, loads `VoteSession.json` ABI, stores a reference to `blockchainProviderService`, and defines an internal `_SessionStatusEnum` for mapping status codes.
*   **`async isRegistrationOpen(voteSessionAddress: string): Promise<boolean>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<boolean>`.
    *   **Action:** Calls `VoteSession.isRegistrationOpen()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid.
*   **`async getRequiredDeposit(voteSessionAddress: string): Promise<bigint>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<bigint>`: Required deposit in Wei.
    *   **Action:** Calls `VoteSession.getRequiredDeposit()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async isRewardCalculationPeriodActive(voteSessionAddress: string): Promise<boolean>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<boolean>`.
    *   **Action:** Calls `VoteSession.isRewardCalculationPeriodActive()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async isDepositClaimPeriodActive(voteSessionAddress: string): Promise<boolean>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<boolean>`.
    *   **Action:** Calls `VoteSession.isDepositClaimPeriodActive()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getSessionDetails(voteSessionAddress: string): Promise<object | null>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<object | null>`: Formatted object with session details (`{ id, status, title, startDate, endDate, sharesEndDate, deposit, threshold }`) or `null` if no details returned.
    *   **Action:** Calls `VoteSession.getSessionDetails()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getSessionInfo(voteSessionAddress: string): Promise<object | null>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<object | null>`: Parsed session information object based on the contract's `getSessionInfo()` tuple (`{ title, description, startDate, endDate, sharesCollectionEndDate, options, metadata, requiredDeposit, minShareThreshold, status }`), or `null` if no info returned.
    *   **Action:** Calls `VoteSession.getSessionInfo()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getStatus(voteSessionAddress: string): Promise<string>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string>`: Current status as a string (e.g., 'RegistrationOpen', 'VotingOpen', 'Unknown') based on the internal enum mapping.
    *   **Action:** Calls `VoteSession.currentStatus()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getEncryptedVote(voteSessionAddress: string, voteIndex: number): Promise<object | null>`**
    *   **Input(s):** `voteSessionAddress: string`, `voteIndex: number` (non-negative).
    *   **Output:** `Promise<object | null>`: Parsed encrypted vote data (`{ ciphertext, g1r, g2r, alpha, threshold }`) or `null` if no data returned.
    *   **Action:** Calls `VoteSession.getEncryptedVote(voteIndex)`. Read operation.
    *   **Throws:** `Error` if inputs are invalid or the read operation fails.
*   **`async getNumberOfVotes(voteSessionAddress: string): Promise<number>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<number>`: Total number of encrypted votes cast.
    *   **Action:** Calls `VoteSession.getNumberOfVotes()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getDecryptionShare(voteSessionAddress: string, shareLogIndex: number): Promise<object | null>`**
    *   **Input(s):** `voteSessionAddress: string`, `shareLogIndex: number` (non-negative).
    *   **Output:** `Promise<object | null>`: Parsed decryption share data (`{ submitter: string, voteIndex: number, shareIndex: number, share: string | null }`) or `null` if no data returned.
    *   **Action:** Calls `VoteSession.getDecryptionShare(shareLogIndex)`. Read operation.
    *   **Throws:** `Error` if inputs are invalid or the read operation fails.
*   **`async getNumberOfDecryptionShares(voteSessionAddress: string): Promise<number>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<number>`: Total number of decryption shares submitted.
    *   **Action:** Calls `VoteSession.getNumberOfDecryptionShares()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getDecryptionParameters(voteSessionAddress: string): Promise<{ alphas: string[], threshold: number } | null>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<object | null>`: `{ alphas: string[], threshold: number }` or `null` if parameters not set or parsing fails.
    *   **Action:** Calls `VoteSession.getDecryptionParameters()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getSubmittedValues(voteSessionAddress: string): Promise<{ submitters: string[], indexes: number[], values: string[] } | null>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<object | null>`: `{ submitters: string[], indexes: number[], values: string[] }` or `null` if threshold not met or data unavailable.
    *   **Action:** Calls `VoteSession.getSubmittedDecryptionValues()`. Read operation. (Note: Requires signer instance workaround in service code).
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails (excluding threshold-not-met errors which return `null`).
*   **`async getSessionOwner(voteSessionAddress: string): Promise<string>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string>`: Address of the session owner.
    *   **Action:** Calls `VoteSession.owner()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getSessionId(voteSessionAddress: string): Promise<string | undefined>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string | undefined>`: The session ID as a string, or `undefined` if unavailable.
    *   **Action:** Calls `VoteSession.sessionId()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getParticipantRegistryAddress(voteSessionAddress: string): Promise<string>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string>`: Address of the associated `ParticipantRegistry` contract.
    *   **Action:** Calls `VoteSession.participantRegistry()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getTitle(voteSessionAddress: string): Promise<string>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string>`: The session title.
    *   **Action:** Calls `VoteSession.title()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.
*   **`async getDescription(voteSessionAddress: string): Promise<string>`**
    *   **Input(s):** `voteSessionAddress: string`.
    *   **Output:** `Promise<string>`: The session description.
    *   **Action:** Calls `VoteSession.description()`. Read operation.
    *   **Throws:** `Error` if `voteSessionAddress` is invalid or the read operation fails.

---

## 3. Utility Services (`frontend/services/utils/`)

These services provide pure JavaScript functions for various operations, primarily cryptographic and data conversion, without direct blockchain interactions.

**General Requirements:**
*   Pure JavaScript functions.
*   Comprehensive JSDoc comments.
*   Thorough unit testing.

### 3.1. `cryptographyUtils.js`

Provides core cryptographic operations. Functions are exported individually. This file may depend on other utility modules like `aesUtils`, `conversionUtils`, `blsPointUtils`, and `constants` via dynamic or static imports.

**Key Functions:**

*   **`async calculateNullifier(privateKey: bigint, sessionId: string | number): Promise<string>`**
    *   **Input(s):**
        *   `privateKey: bigint`: User's private key as a BigInt.
        *   `sessionId: string | number`: A unique identifier for the vote session.
    *   **Output:** `Promise<string>`: The calculated nullifier hash (0x-prefixed hex string).
    *   **Action:** Derives `skHex` from `privateKey`, stringifies `sessionId`. Calculates `SHA256` of the string `"nullifier:" + skHex + ":" + sessionStr`. Uses dynamic import for `conversionUtils.bytesToHex`.
    *   **Throws:** `Error` if inputs are invalid or hashing fails.
*   **`async generateZkProof(inputs: object, wasmBufferOrPath: ArrayBuffer | string, provingKeyOrPath: ArrayBuffer | string): Promise<{ proof: object, publicSignals: string[] }>`**
    *   **Input(s):**
        *   `inputs: object`: Inputs required by the specific ZK circuit.
        *   `wasmBufferOrPath: ArrayBuffer | string`: Path/URL or buffer for the circuit WASM file.
        *   `provingKeyOrPath: ArrayBuffer | string`: Path/URL or buffer for the proving key (.zkey).
    *   **Output:** `Promise<object>`: `{ proof: object, publicSignals: string[] }` (Structure depends on the ZK proving system, e.g., snarkjs groth16).
    *   **Note:** Currently throws a "not implemented" error. Requires ZK circuit artifacts and integration with a proving library like `snarkjs`.
    *   **Throws:** `Error` (currently always throws "not implemented").
*   **`async encryptVoteData(voteData: string, aesKey: CryptoKey, activeHolderBlsPublicKeysHex: string[], voteEncryptionThreshold: number): Promise<{ ciphertext: string, g1r: string, g2r: string, alpha: Uint8Array[], threshold: number }>`**
    *   **Input(s):**
        *   `voteData: string`: The raw vote data string.
        *   `aesKey: CryptoKey`: AES-GCM key for encrypting `voteData`.
        *   `activeHolderBlsPublicKeysHex: string[]`: Array of 0x-prefixed hex strings of active holder BLS public keys.
        *   `voteEncryptionThreshold: number`: The positive integer threshold `t`.
    *   **Output:** `Promise<object>`: An object `{ ciphertext, g1r, g2r, alpha, threshold }` suitable for `VoteSessionVotingService.castEncryptedVote`.
        *   `ciphertext`: AES encrypted vote data (Format: "0x" + IV_HEX + CIPHERTEXT_HEX from `aesUtils.AESEncrypt`).
        *   `g1r`: Hex string of `G1.Base * r` (from `blsPointUtils.getG1R`).
        *   `g2r`: Hex string of `G2.Base * r` (from `blsPointUtils.getG2R`).
        *   `alpha`: Array of `Uint8Array` representing the bytes of the provided BLS public keys.
        *   `threshold`: The input `voteEncryptionThreshold`.
    *   **Action:** Encrypts `voteData` using `aesUtils.AESEncrypt`. Generates a random scalar `r` using `blsPointUtils.genR` and calculates `g1r` and `g2r` using `blsPointUtils`. Converts the input public key hex strings to `Uint8Array`s for the `alpha` array. Uses dynamic imports for `aesUtils` and `conversionUtils`.
    *   **Throws:** `Error` if inputs are invalid (types, threshold vs array length) or if any cryptographic operation fails.
*   **`async calculateDecryptionValue(password: string, encryptedSkPayloadHex: string): Promise<string>`**
    *   **Input(s):**
        *   `password: string`: User's password.
        *   `encryptedSkPayloadHex: string`: The encrypted BLS private key payload from `aesUtils.encryptWithPassword` (Format: "0x" + SALT_HEX + IV_HEX + CIPHERTEXT_HEX).
    *   **Output:** `Promise<string>`: The calculated decryption value `v_i` (0x-prefixed hex string of SHA256(decrypted_sk_bytes)).
    *   **Action:** Decrypts the BLS private key hex string using `aesUtils.decryptWithPassword`. Converts the decrypted hex key to bytes. Calculates the SHA-256 hash of the private key *bytes*. Uses dynamic imports for `aesUtils` and `conversionUtils`.
    *   **Throws:** `Error` if inputs are invalid, decryption fails (e.g., wrong password), or hashing fails.

### 3.1.1. `shamirUtils.js`

Handles Shamir's Secret Sharing functions.

**Key Functions:**

*   **`getKAndSecretShares(threshold: number, totalParticipants: number, fieldOrder: bigint = FIELD_ORDER): { k: bigint, shares: Array<{index: number, value: bigint}> }`**
    *   **Input(s):**
        *   `threshold: number`: The minimum number of shares (t) required to reconstruct the secret (must be > 0).
        *   `totalParticipants: number`: The total number of shares (n) to generate (must be >= threshold).
        *   `fieldOrder: bigint` (optional, default: `FIELD_ORDER` from `constants.js`): The order of the finite field for calculations.
    *   **Output:** `{ k: bigint, shares: Array<{index: number, value: bigint}> }`:
        *   `k: bigint`: The generated secret scalar `k`, modulo `fieldOrder`.
        *   `shares: Array<{index: number, value: bigint}>`: An array of share objects. Each object contains:
            *   `index: number`: The 1-based index of the participant (x-coordinate for the share).
            *   `value: bigint`: The share value `P(index)` modulo `fieldOrder`.
    *   **Action:** Generates a random secret scalar `k`. Constructs a polynomial `P(x)` of degree `threshold - 1` such that `P(0) = k`, with other coefficients chosen randomly modulo `fieldOrder`. Evaluates `P(j)` for `j` from 1 to `totalParticipants` to create the shares.
    *   **Throws:** `Error` if `threshold` or `totalParticipants` are invalid (e.g., `threshold <= 0`, `totalParticipants < threshold`).
*   **`async recomputeKey(participantShares: Array<{index: number, value: bigint}>, threshold: number, fieldOrder: bigint = FIELD_ORDER): Promise<CryptoKey>`**
    *   **Input(s):**
        *   `participantShares: Array<{index: number, value: bigint}>`: An array of share objects. Each object must contain:
            *   `index: number`: The x-coordinate of the share (participant's original 1-based index).
            *   `value: bigint`: The share value.
        At least `threshold` shares must be provided.
        *   `threshold: number`: The minimum number of shares (t) originally used to create the shares (must be > 0).
        *   `fieldOrder: bigint` (optional, default: `FIELD_ORDER` from `constants.js`): The order of the finite field used during share generation.
    *   **Output:** `Promise<CryptoKey>`: The reconstructed AES CryptoKey derived from the secret `k`.
    *   **Action:** Reconstructs the original secret scalar `k` using Lagrange interpolation on the first `threshold` shares provided in `participantShares`. It evaluates the interpolating polynomial at `x=0`. The reconstructed `k` (a BigInt) is then converted into an AES-GCM `CryptoKey` using `aesUtils.importBigIntAsCryptoKey`. Uses `lagrangeUtils.lagrangeBasis` and `lagrangeUtils.lagrangeInterpolate`.
    *   **Throws:** `Error` if inputs are invalid (e.g., insufficient shares, non-numeric threshold, invalid share format), or if reconstruction/key derivation fails.

### 3.1.2. `blsCryptoUtils.js`

Handles BLS-specific cryptographic functions using `@noble/curves/bls12-381`. Functions are exported individually.

**Key Functions:**

*   **`generateBLSKeyPair(): { sk: bigint, pk: PointG1 }`**
    *   **Output:** An object containing:
        *   `sk: bigint`: The private key scalar.
        *   `pk: PointG1`: The public key point (`bls12_381.G1.ProjectivePoint` instance).
    *   **Action:** Generates a new BLS key pair where `pk = sk * G1.Base`.
*   **`async calculateDecryptionShareForSubmission(privateKey: bigint, g1r_hex: string): Promise<string>`**
    *   **Input(s):**
        *   `privateKey: bigint`: User's BLS private key as a BigInt.
        *   `g1r_hex: string`: The `g1^r` point from the encrypted vote, as a *raw* hex string (no "0x" prefix).
    *   **Output:** `Promise<string>`: The calculated share `g1r^sk` as a *raw* hex string (no "0x" prefix), suitable for `VoteSession.submitDecryptionShare()` after appropriate formatting (e.g., adding "0x" prefix).
    *   **Action:** Performs modular reduction on the private key (`privateKey % FIELD_ORDER`) and then calculates the scalar multiplication `share_point = g1r_point * reducedPrivateKey`.
    *   **Throws:** `Error` if `privateKey` is not a `bigint` or if `g1r_hex` is not a valid raw hex representation of a G1 point.
*   **`verifyShares(share_hex: string, publicKey_hex: string, g2r_hex: string): boolean`**
    *   **Input(s):**
        *   `share_hex: string`: The share to verify (e.g., `(g1^r)^sk_i`), as a *raw* hex string (no "0x" prefix).
        *   `publicKey_hex: string`: The public key of the share owner (e.g., `g1^sk_i`), as a *raw* hex string (no "0x" prefix).
        *   `g2r_hex: string`: The `g2^r` point from the vote, as a *raw* hex string (no "0x" prefix).
    *   **Output:** `boolean`: True if the share is valid according to the pairing check `e(share, G2.Base) === e(PK, g2r)`, false otherwise.
    *   **Action:** Performs the BLS pairing check. Returns `false` if any input hex string is malformed.

### 3.1.3. `voteCryptoUtils.js`

Provides utilities for encoding/decoding vote options and encrypting/decrypting vote data.

**Key Functions:**

*   **`encodeVoteToPoint(option: string): string`**
    *   **Input(s):**
        *   `option: string`: The vote option string (e.g., "Yes", "No"). Must be non-empty.
    *   **Output:** `string`: The *raw* hex string representation of the G1 point (no "0x" prefix) corresponding to the vote option.
    *   **Action:** Converts the `option` string to UTF-8 bytes, then uses `bls12_381.G1.hashToCurve()` to map it to a G1 elliptic curve point. Returns the raw hexadecimal representation of this point.
    *   **Throws:** `Error` if `option` is invalid (e.g., empty string) or if the hashing to curve operation fails.

*   **`decodePointToVote(pointHex: string, possibleOptions: string[]): string | null`**
    *   **Input(s):**
        *   `pointHex: string`: The 0x-prefixed hex string of a G1 point to be decoded.
        *   `possibleOptions: string[]`: An array of possible vote option strings (e.g., `["Yes", "No", "Abstain"]`). Each option must be a non-empty string.
    *   **Output:** `string | null`: The matching vote option string from `possibleOptions` if the `pointHex` corresponds to one of them. Returns `null` if no match is found.
    *   **Action:** Iterates through `possibleOptions`. For each option, it calls `encodeVoteToPoint` to get its G1 point representation (raw hex). It then compares this (after prefixing with "0x") with the input `pointHex`. If a match is found, that option string is returned.
    *   **Throws:** `Error` if `pointHex` or `possibleOptions` are invalid (e.g., malformed hex, empty options array, invalid option strings within the array), or if an internal call to `encodeVoteToPoint` fails.

*   **`async encryptVoteData(voteData: string, aesKey: CryptoKey, activeHolderBlsPublicKeysHex: string[], voteEncryptionThreshold: number): Promise<object>`**
    *   **Input(s):**
        *   `voteData: string`: The raw vote data string (e.g., "Yes"). Must be non-empty.
        *   `aesKey: CryptoKey`: An AES-GCM `CryptoKey` for symmetric encryption of `voteData`.
        *   `activeHolderBlsPublicKeysHex: string[]`: An array of 0x-prefixed hex strings, where each string is a BLS public key of an active participant/holder.
        *   `voteEncryptionThreshold: number`: A positive integer `t` representing the threshold for this specific vote's encryption parameters (e.g., for a (t,n) threshold scheme).
    *   **Output:** `Promise<object>`: An object containing parameters suitable for the `VoteSession.castEncryptedVote` contract method:
        *   `ciphertext: string`: The AES-GCM encrypted `voteData`, formatted as a single 0x-prefixed hex string: "0x" + IV_HEX (12 bytes) + CIPHERTEXT_HEX. (Output from `aesUtils.AESEncrypt`).
        *   `g1r: string`: The raw hex string representation of the G1 point `G1.Base * r` (output from `blsPointUtils.getG1R`).
        *   `g2r: string`: The raw hex string representation of the G2 point `G2.Base * r` (output from `blsPointUtils.getG2R`).
        *   `alpha: Uint8Array[]`: An array of `Uint8Array`s, where each array contains the bytes of a BLS public key from `activeHolderBlsPublicKeysHex`.
        *   `threshold: number`: The input `voteEncryptionThreshold`.
    *   **Action:**
        1.  Validates all inputs.
        2.  Dynamically imports `AESEncrypt` from `aesUtils.js` and `hexToBytes` from `conversionUtils.js`.
        3.  Encrypts `voteData` using `AESEncrypt` with the provided `aesKey` to get `ciphertextHex`.
        4.  Generates a random scalar `r` using `blsPointUtils.genR`.
        5.  Computes `g1rHex` and `g2rHex` using `blsPointUtils.getG1R(r)` and `blsPointUtils.getG2R(r)`.
        6.  Converts each public key in `activeHolderBlsPublicKeysHex` from hex to a `Uint8Array` using `hexToBytes` to form the `alphaForContract` array.
        7.  Returns an object with `ciphertext`, `g1r`, `g2r`, `alpha` (as `alphaForContract`), and `threshold` (as `thresholdForContract`).
    *   **Throws:** `Error` if inputs are invalid (e.g., empty `voteData`, invalid `aesKey`, malformed public key hex strings, `voteEncryptionThreshold` not positive, or `activeHolderBlsPublicKeysHex.length < voteEncryptionThreshold`), or if any underlying cryptographic operation (encryption, point generation, hex conversion) fails.

*   **`async decryptVote(encryptedVoteHex: string, reconstructedKey: CryptoKey): Promise<string>`**
    *   **Input(s):**
        *   `encryptedVoteHex: string`: The 0x-prefixed hex string containing the IV prepended to the ciphertext (this is the format output by `aesUtils.AESEncrypt` and used as `ciphertext` in `encryptVoteData`).
        *   `reconstructedKey: CryptoKey`: The AES-GCM `CryptoKey` that was used for encryption (e.g., derived from reconstructed Shamir's shares).
    *   **Output:** `Promise<string>`: The decrypted plaintext vote string.
    *   **Action:**
        1.  Validates the `reconstructedKey`.
        2.  Dynamically imports `AESDecrypt` from `aesUtils.js`.
        3.  Calls `AESDecrypt` with `encryptedVoteHex` and `reconstructedKey` to decrypt the data.
        4.  Returns the resulting plaintext string.
    *   **Throws:** `Error` if `reconstructedKey` is not a valid `CryptoKey`, or if the decryption process fails (e.g., wrong key, corrupted data, malformed `encryptedVoteHex`).

### 3.2. `aesUtils.js`

Provides AES encryption and decryption utilities using the Web Crypto API. Functions are exported individually.

**Key Functions:**

*   **`randomBytes(size: number): Uint8Array`**
    *   **Input(s):** `size: number` (Must be a positive integer).
    *   **Output:** `Uint8Array`: An array of cryptographically secure random bytes.
    *   **Throws:** `Error` if `size` is not a positive integer.
*   **`async AESEncrypt(text: string, key: CryptoKey): Promise<string>`**
    *   **Input(s):**
        *   `text: string`: The plaintext string to encrypt.
        *   `key: CryptoKey`: The AES-GCM CryptoKey (should be 256-bit).
    *   **Output:** `Promise<string>`: A hex string: "0x" + IV_HEX (12 bytes) + CIPHERTEXT_HEX.
    *   **Action:** Encodes the text, generates a random 12-byte IV, encrypts using AES-GCM, and returns the combined IV and ciphertext as a single hex string prefixed with "0x". Uses dynamic import for `conversionUtils.bytesToHex`.
    *   **Throws:** `Error` if inputs are invalid or the encryption operation fails.
*   **`async AESDecrypt(encryptedHex: string, key: CryptoKey): Promise<string>`**
    *   **Input(s):**
        *   `encryptedHex: string`: The hex string containing the IV prepended to the ciphertext (Format: "0x" + IV_HEX + CIPHERTEXT_HEX).
        *   `key: CryptoKey`: The AES-GCM CryptoKey used for encryption.
    *   **Output:** `Promise<string>`: The decrypted plaintext string.
    *   **Action:** Parses the input hex string to extract the IV (first 12 bytes after "0x") and the ciphertext. Decrypts using AES-GCM and the provided key. Decodes the result back to a UTF-8 string. Uses dynamic import for `conversionUtils.hexToBytes`.
    *   **Throws:** `Error` if inputs are invalid, format is incorrect, or decryption fails (e.g., wrong key, corrupted data).
*   **`async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey>`**
    *   **Input(s):**
        *   `password: string` (Must be non-empty).
        *   `salt: Uint8Array` (Should be random and sufficiently long, e.g., >= 8 bytes).
    *   **Output:** `Promise<CryptoKey>`: A CryptoKey suitable for AES-GCM encryption/decryption.
    *   **Action:** Derives a 256-bit AES-GCM key from the password and salt using PBKDF2. Uses hardcoded parameters for iterations (`PBKDF2_ITERATIONS = 250000`) and hash (`SHA-256`).
    *   **Throws:** `Error` if inputs are invalid or key derivation fails.
*   **`async importBigIntAsCryptoKey(bigintKey: bigint): Promise<CryptoKey>`**
    *   **Input(s):** `bigintKey: bigint`.
    *   **Output:** `Promise<CryptoKey>`: An AES-GCM CryptoKey (256-bit).
    *   **Action:** Converts the BigInt to its minimal byte representation, calculates the SHA-256 hash of these bytes, and imports the resulting 32-byte hash digest as a raw AES-GCM key. Uses dynamic import for `conversionUtils`.
    *   **Throws:** `Error` if input is not a BigInt or key import fails.
*   **`async encryptWithPassword(plaintext: string, password: string): Promise<string>`**
    *   **Input(s):**
        *   `plaintext: string`.
        *   `password: string` (Must be non-empty).
    *   **Output:** `Promise<string>`: A hex string: "0x" + SALT_HEX (16 bytes) + IV_HEX (12 bytes) + CIPHERTEXT_HEX.
    *   **Action:** Generates a random 16-byte salt, derives an AES key using `deriveKeyFromPassword`, encrypts the plaintext using `AESEncrypt` (which generates the IV), and returns the combined salt, IV, and ciphertext as a single hex string prefixed with "0x".
    *   **Throws:** `Error` if inputs are invalid or if key derivation or encryption fails.
*   **`async decryptWithPassword(encryptedDataHex: string, password: string): Promise<string>`**
    *   **Input(s):**
        *   `encryptedDataHex: string` (Format: "0x" + SALT_HEX + IV_HEX + CIPHERTEXT_HEX).
        *   `password: string` (Must be non-empty).
    *   **Output:** `Promise<string>`: The decrypted plaintext string.
    *   **Action:** Parses the input hex string to extract the salt (first 16 bytes after "0x"). Derives the AES key using `deriveKeyFromPassword`. Calls `AESDecrypt` with the key and the remaining part of the hex string ("0x" + IV_HEX + CIPHERTEXT_HEX) to get the plaintext.
    *   **Throws:** `Error` if inputs are invalid, format is incorrect, or if key derivation or decryption fails.

### 3.3. `conversionUtils.js`

Provides utilities for data type conversions (hex, bytes, string, BigInt). Functions are exported individually.

**Key Functions:**

*   **`bigIntToHex(bigInt: bigint): string`**
    *   **Input(s):** `bigInt: bigint`.
    *   **Output:** `string`: The *raw* hexadecimal representation (no "0x" prefix), padded with a leading '0' if necessary to ensure even length.
    *   **Throws:** `Error` if input is not a BigInt.
*   **`hexToBytes(hex: string): Uint8Array`**
    *   **Input(s):** `hex: string` (Hexadecimal string, optional "0x" prefix).
    *   **Output:** `Uint8Array`: The corresponding byte array.
    *   **Throws:** `Error` if input is not a string, has odd length (after removing prefix), or contains invalid hex characters.
*   **`bytesToHex(bytes: Uint8Array | number[]): string`**
    *   **Input(s):** `bytes: Uint8Array | number[]`.
    *   **Output:** `string`: The *raw* hexadecimal representation (no "0x" prefix).
    *   **Throws:** `Error` if input is not a Uint8Array or Array, or if array contains invalid byte values.
*   **`pointToBigint(point: object): bigint`**
    *   **Input(s):** `point: object` (An object representing a curve point, expected to have a `toHex()` method).
    *   **Output:** `bigint`: The point's hex representation converted to BigInt, modulo `FIELD_ORDER`.
    *   **Action:** Calls `point.toHex()`, converts the resulting hex to BigInt, and performs modular reduction using `FIELD_ORDER` from constants.
    *   **Throws:** `Error` if input is not an object or lacks a `toHex` method.
*   **`stringToBigInt(str: string): bigint`**
    *   **Input(s):** `str: string` (Decimal, hex, or 0x-prefixed hex).
    *   **Output:** `bigint`: The BigInt representation.
    *   **Throws:** `Error` if input is not a string, is empty, or cannot be parsed as a valid numeric string (decimal or hex).
*   **`bigIntTo32Bytes(num: bigint): Uint8Array`**
    *   **Input(s):** `num: bigint`.
    *   **Output:** `Uint8Array`: A 32-byte Uint8Array representation (Big-Endian).
    *   **Action:** Converts the BigInt to hex, pads with leading zeros to 64 hex characters (32 bytes), truncates if necessary (taking least significant 32 bytes), and converts to a Uint8Array.
    *   **Throws:** `Error` if input is not a BigInt.

### 3.4. `blsPointUtils.js`

Provides low-level BLS point manipulations using `@noble/curves/bls12-381`. Functions are exported individually.

**Key Functions:**
*   **`genR(): bigint`**
    *   **Output:** `bigint`: A random scalar `r` modulo `FIELD_ORDER`.
    *   **Action:** Generates 32 random bytes using `crypto.getRandomValues` and reduces the resulting BigInt modulo `FIELD_ORDER`.
*   **`getG1R(r: bigint): string`**
    *   **Input(s):** `r: bigint` (The scalar).
    *   **Output:** `string`: The hex representation (from `point.toHex()`) of the resulting G1 point (`G1.Base * r`).
    *   **Action:** Calculates the G1 base point multiplied by the scalar `r`.
    *   **Throws:** `Error` if `r` is not a BigInt.
*   **`getG2R(r: bigint): string`**
    *   **Input(s):** `r: bigint` (The scalar).
    *   **Output:** `string`: The hex representation (from `point.toHex()`) of the resulting G2 point (`G2.Base * r`).
    *   **Action:** Calculates the G2 base point multiplied by the scalar `r`.
    *   **Throws:** `Error` if `r` is not a BigInt.
*   **`computePkRValue(pubkey: string, r: bigint): object`**
    *   **Input(s):**
        *   `pubkey: string`: Hex string representation of the G1 public key (with or without "0x" prefix).
        *   `r: bigint`: The scalar.
    *   **Output:** `object`: The resulting G1 ProjectivePoint object (`bls12_381.G1.ProjectivePoint` instance) representing `PK * r`.
    *   **Action:** Deserializes the public key hex string into a G1 point and multiplies it by the scalar `r`.
    *   **Throws:** `Error` if `pubkey` is not a string, `r` is not a BigInt, or if the public key hex is invalid.

### 3.5. `lagrangeUtils.js`

Provides Lagrange interpolation logic, primarily used by `shamirUtils.js`. Functions are exported individually.

**Key Functions:**

*   **`modInverse(a: bigint, m: bigint): bigint`**
    *   **Input(s):** `a: bigint`, `m: bigint` (modulus, must be positive).
    *   **Output:** `bigint`: The modular multiplicative inverse of `a` modulo `m`.
    *   **Action:** Computes the inverse using the extended Euclidean algorithm. Uses `mod` helper from `@noble/curves`.
    *   **Throws:** `Error` if inputs are not BigInts, `m` is not positive, `a` is 0 mod `m`, or if the inverse does not exist (gcd(a, m) != 1).
*   **`lagrangeBasis(indexes: bigint[], x: bigint): bigint[]`**
    *   **Input(s):**
        *   `indexes: bigint[]`: Array of unique BigInt x-coordinates (e.g., participant indices).
        *   `x: bigint`: The point at which to evaluate the basis polynomials (often 0n for secret recovery).
    *   **Output:** `bigint[]`: Array containing the evaluated Lagrange basis coefficients `L_i(x)` for each index `i` in `indexes`, calculated modulo `FIELD_ORDER`.
    *   **Action:** For each index `i`, calculates `L_i(x) = Product_{j!=i} (x - indexes[j]) / (indexes[i] - indexes[j]) mod FIELD_ORDER`. Uses the local `modInverse` function.
    *   **Throws:** `Error` if `indexes` is empty, contains non-BigInts, contains duplicates, or if `x` is not a BigInt.
*   **`lagrangeInterpolate(basis: bigint[], shares: bigint[]): bigint`**
    *   **Input(s):**
        *   `basis: bigint[]`: Array of pre-calculated Lagrange basis coefficients (e.g., the output of `lagrangeBasis(indexes, 0n)`).
        *   `shares: bigint[]`: Array of corresponding y-values (shares).
    *   **Output:** `bigint`: The interpolated value of the polynomial at the point `x` used to calculate the `basis` (typically `P(0)`), modulo `FIELD_ORDER`.
    *   **Action:** Calculates the sum `Sum(shares[i] * basis[i]) mod FIELD_ORDER`.
    *   **Throws:** `Error` if `basis` and `shares` are not arrays of the same length, or if any element is not a BigInt during calculation.

### 3.6. `constants.js`
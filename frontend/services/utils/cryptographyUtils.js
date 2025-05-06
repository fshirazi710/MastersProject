// import { bls12_381 } from "@noble/curves/bls12-381"; // Moved to voteCryptoUtils.js
// import { Buffer } from "buffer"; // Moved to voteCryptoUtils.js

// Import conversion utilities
import {
    bytesToHex, // Still used by calculateNullifier, calculateDecryptionValue
    // pointToBigint, // Moved with decodePointToVote (or rather, not used by remaining)
    hexToBytes,   // Still used by calculateNullifier, calculateDecryptionValue
    // bigIntTo32Bytes // Assuming not used by remaining functions
} from './conversionUtils.js';

// Import shared constants
import { DOMAIN_SEPARATOR_NULLIFIER } from './constants.js';

// Import BLS Point utilities - genR, getG1R, getG2R moved with encryptVoteData
// import {
//     genR,
//     getG1R,
//     getG2R,
// } from './blsPointUtils.js';

// AES/Password functions are in aesUtils.js and will be imported dynamically where needed.

// encodeVoteToPoint - MOVED to voteCryptoUtils.js

// decodePointToVote - MOVED to voteCryptoUtils.js

// decryptVote - MOVED to voteCryptoUtils.js

/**
 * Calculates a unique identifier (nullifier) for a user in a specific session 
 * without revealing their private key. Typically used to prevent double-voting.
 * The current implementation uses SHA256(domain_separator + sk_hex + sessionId_str).
 * @param {bigint} privateKey User's private key as a BigInt.
 * @param {string | number} sessionId Identifier for the vote session.
 * @returns {Promise<string>} The calculated nullifier hash (bytes32 hex string, prefixed with 0x).
 * @throws {Error} If inputs are invalid or hashing fails.
 */
export async function calculateNullifier(privateKey, sessionId) {
    if (typeof privateKey !== 'bigint') {
        throw new Error("privateKey must be a BigInt for calculateNullifier.");
    }
    if (sessionId === undefined || sessionId === null || String(sessionId).length === 0) {
        throw new Error("sessionId is required and must be non-empty for calculateNullifier.");
    }

    try {
        // Convert sk to a fixed-length hex string (e.g., 64 chars for 32 bytes)
        const skHex = privateKey.toString(16).padStart(64, '0');
        const sessionStr = String(sessionId);
        
        // Use domain separation constant
        const dataToHashString = `${DOMAIN_SEPARATOR_NULLIFIER}${skHex}:${sessionStr}`;
        const dataToHashBytes = new TextEncoder().encode(dataToHashString);

        // Use Web Crypto API for SHA-256
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataToHashBytes);
        
        // Convert hash buffer to hex string - Dynamic import still needed inside?
        // Let's keep dynamic import for now, or refactor to static if preferred.
        const { bytesToHex: localBytesToHex } = await import('./conversionUtils.js'); // Use alias if bytesToHex is also static import
        const nullifierHex = localBytesToHex(new Uint8Array(hashBuffer));

        console.log(`[calculateNullifier] Input sk: ${skHex.substring(0,10)}..., sessionId: ${sessionStr}`);
        console.log(`[calculateNullifier] Data Hashed: ${dataToHashString}`);
        console.log(`[calculateNullifier] Result: 0x${nullifierHex}`);

        return '0x' + nullifierHex;
    } catch (error) {
        console.error("Error calculating nullifier:", error);
        throw new Error(`Nullifier calculation failed: ${error.message}`);
    }
}

/**
 * TODO: Implement ZK-SNARK Proof Generation.
 * Requires circuit definition (e.g., Circom), compiled WASM, proving key (.zkey),
 * and a library like snarkjs.
 * The specific inputs depend entirely on the circuit design.
 * @param {object} inputs Inputs required by the ZK circuit (e.g., sk, vote, nullifier, merkle path, etc.).
 * @param {ArrayBuffer | string} wasmBufferOrPath Path or buffer for circuit WASM.
 * @param {ArrayBuffer | string} provingKeyOrPath Path or buffer for proving key (.zkey).
 * @returns {Promise<{proof: object, publicSignals: string[]}>} The generated proof object and public signals array.
 * @throws {Error} If ZK proof generation is not implemented or fails.
 */
export async function generateZkProof(inputs, wasmBufferOrPath, provingKeyOrPath) {
    console.error("ZK-SNARK proof generation is not yet implemented!");
    console.error("Requires circuit details (WASM/zKey) and snarkjs integration.");
    console.log("Inputs received by generateZkProof:", inputs);
    // In a real implementation, you would load snarkjs, load keys/wasm,
    // format inputs, call groth16.fullProve, and return the result.
    /*
    try {
        // Dynamically import snarkjs if not globally available
        const snarkjs = window.snarkjs; // Assuming snarkjs is loaded globally
        if (!snarkjs) throw new Error("snarkjs library not found.");

        console.log("Generating ZK proof with snarkjs...");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            inputs, 
            wasmBufferOrPath, // Can be ArrayBuffer or path/URL
            provingKeyOrPath  // Can be ArrayBuffer or path/URL
        );

        console.log("ZK Proof Generated:", proof);
        console.log("Public Signals:", publicSignals);

        return { proof, publicSignals };

    } catch (error) {
        console.error("Error during ZK proof generation:", error);
        throw new Error(`Failed to generate ZK proof: ${error.message}`);
    }
    */

    // Return dummy data or throw error for now
    throw new Error("generateZkProof is not implemented. ZK circuit and proving logic required.");
    // Or return dummy data:
    // return {
    //     proof: { pi_a: ['0', '0'], pi_b: [[ '0', '0' ], [ '0', '0' ]], pi_c: ['0', '0'], protocol: "groth16", curve: "bls12381" },
    //     publicSignals: ['1'] // Example public signal
    // };
}

/**
 * Encrypts vote data using AES-GCM and prepares parameters for VoteSession.castEncryptedVote.
 * @param {string} voteData The raw vote data string (e.g., "Yes", "No").
 * @param {CryptoKey} aesKey The symmetric AES CryptoKey for encrypting the voteData.
 * @param {string[]} activeHolderBlsPublicKeysHex Array of hex strings of BLS public keys of active holders.
 * @param {number} voteEncryptionThreshold The threshold 't' for this specific vote's encryption parameters.
 * @returns {Promise<object>} An object containing {ciphertext, g1r, g2r, alpha, threshold} for contract submission.
 * @throws {Error} If inputs are invalid or encryption/preparation fails.
 */
export async function encryptVoteData(
    voteData,
    aesKey,
    activeHolderBlsPublicKeysHex,
    voteEncryptionThreshold
) {
    console.log("[encryptVoteData] Starting encryption and parameter preparation...");

    // Validate inputs
    if (typeof voteData !== 'string' || voteData.length === 0) {
        throw new Error("Invalid voteData: Must be a non-empty string.");
    }
    if (!(aesKey instanceof CryptoKey) || aesKey.type !== 'secret' || aesKey.algorithm.name !== 'AES-GCM') {
        throw new Error("Invalid aesKey: Must be an AES-GCM CryptoKey.");
    }
    if (!Array.isArray(activeHolderBlsPublicKeysHex) || activeHolderBlsPublicKeysHex.some(key => typeof key !== 'string' || !key.startsWith('0x'))) {
        throw new Error("Invalid activeHolderBlsPublicKeysHex: Must be an array of hex strings starting with 0x.");
    }
    if (typeof voteEncryptionThreshold !== 'number' || voteEncryptionThreshold <= 0) {
        throw new Error("Invalid voteEncryptionThreshold: Must be a positive number.");
    }
    if (activeHolderBlsPublicKeysHex.length < voteEncryptionThreshold) {
        throw new Error(`Insufficient activeHolderBlsPublicKeysHex (${activeHolderBlsPublicKeysHex.length}) for the voteEncryptionThreshold (${voteEncryptionThreshold}).`);
    }

    try {
        // Dynamically import necessary utils
        const { AESEncrypt } = await import('./aesUtils.js');
        const { hexToBytes } = await import('./conversionUtils.js'); // Assuming hexToBytes returns Uint8Array or compatible

        // 1. AES Encryption of voteData
        const voteDataBytes = new TextEncoder().encode(voteData);
        console.log("[encryptVoteData] Encrypting vote data with AES-GCM...");
        const ciphertextHex = await AESEncrypt(voteDataBytes, aesKey); // Expected to return "0xIV+Ciphertext"
        console.log("[encryptVoteData] AES Ciphertext (hex):", ciphertextHex.substring(0, 50) + "...");

        // 2. Generate r-based elliptic curve points
        console.log("[encryptVoteData] Generating r, g1^r, g2^r...");
        const r = genR(); // Already imported from blsPointUtils.js
        const g1rHex = getG1R(r); // Already imported from blsPointUtils.js
        const g2rHex = getG2R(r); // Already imported from blsPointUtils.js
        console.log("[encryptVoteData] r:", r.toString().substring(0,10) + "...");
        console.log("[encryptVoteData] g1^r (hex):", g1rHex);
        console.log("[encryptVoteData] g2^r (hex):", g2rHex);

        // 3. Prepare alpha (BLS Public Keys as bytes) for castEncryptedVote
        console.log("[encryptVoteData] Converting BLS public keys to bytes for alpha parameter...");
        const alphaForContract = activeHolderBlsPublicKeysHex.map(pkHex => {
            try {
                return hexToBytes(pkHex); // Each element will be Uint8Array or similar byte array
            } catch (e) {
                console.error(`[encryptVoteData] Error converting public key hex '${pkHex}' to bytes:`, e);
                throw new Error(`Invalid hex format for public key: ${pkHex}`);
            }
        });
        console.log("[encryptVoteData] Alpha parameter (count):", alphaForContract.length);


        // 4. Threshold for castEncryptedVote
        const thresholdForContract = voteEncryptionThreshold;
        console.log("[encryptVoteData] Threshold parameter:", thresholdForContract);

        const result = {
            ciphertext: ciphertextHex,
            g1r: g1rHex,
            g2r: g2rHex,
            alpha: alphaForContract,
            threshold: thresholdForContract
        };

        console.log("[encryptVoteData] Successfully prepared parameters for castEncryptedVote:", result);
        return result;

    } catch (error) {
        console.error("Error during encryptVoteData:", error);
        throw new Error(`Failed to encrypt vote data and prepare parameters: ${error.message}`);
    }
}

/**
 * Calculates the final decryption value (v_i) to be submitted to `VoteSession.submitDecryptionValue`.
 * This value is derived from the user's private key (after decrypting it with a password)
 * but SHOULD NOT expose the key itself. It's typically a hash of the private key.
 * This function now expects the BLS private key to be encrypted using `aesUtils.encryptWithPassword`.
 * @param {string} password User's password to decrypt the stored BLS private key.
 * @param {string} encryptedSkPayloadHex Hex string of the AES-encrypted BLS private key, 
 *                                      formatted as "0xSALT_HEXIV_HEXCIPHERTEXT_HEX" (output of `encryptWithPassword`).
 * @returns {Promise<string>} The calculated decryption value (bytes32 hex string, prefixed with 0x).
 * @throws {Error} If inputs are invalid, decryption of SK fails, or hashing fails.
 */
export async function calculateDecryptionValue(password, encryptedSkPayloadHex) {
    console.log("[calculateDecryptionValue] Starting with combined payload...");
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error("Password must be a non-empty string for calculateDecryptionValue.");
    }
    if (typeof encryptedSkPayloadHex !== 'string' || !encryptedSkPayloadHex.startsWith("0x")) {
        // Further validation of length/format can be done by decryptWithPassword
        throw new Error("Encrypted SK payload must be a hex string starting with '0x'.");
    }

    try {
        // Dynamically import utilities
        const { hexToBytes, bytesToHex } = await import('./conversionUtils.js');
        const { decryptWithPassword } = await import('./aesUtils.js'); // Import the new wrapper

        console.log("[calculateDecryptionValue] Decrypting BLS private key using password...");
        // decryptWithPassword will handle salt/IV extraction and key derivation
        const decryptedSkHex = await decryptWithPassword(encryptedSkPayloadHex, password);
        // decryptedSkHex is the raw private key hex string (e.g., "0x...") returned by AESDecrypt after TextDecoder
        
        console.log("[calculateDecryptionValue] BLS Private Key decrypted (hex):", decryptedSkHex.substring(0, 10) + "...");

        console.log("[calculateDecryptionValue] Hashing the decrypted private key (SHA-256) to get submission value...");

        // Convert hex private key to bytes. 
        // Ensure hexToBytes handles potential "0x" prefix if decryptedSkHex includes it (it should, if AESEncrypt produced it).
        const skBytes = hexToBytes(decryptedSkHex);

        const hashBuffer = await window.crypto.subtle.digest('SHA-256', skBytes);
        const valueBytes = new Uint8Array(hashBuffer);
        const valueHex = bytesToHex(valueBytes);

        console.log(`[calculateDecryptionValue] Calculated value (SHA256(sk)): 0x${valueHex}`);
        return '0x' + valueHex;

    } catch (error) {
        console.error("Failed in calculateDecryptionValue:", error);
        // decryptWithPassword might throw specific errors related to password or data integrity.
        throw new Error(`calculateDecryptionValue failed: ${error.message}`);
    }
}
import { bls12_381 } from "@noble/curves/bls12-381";
import { Buffer } from "buffer";

// Assuming blsPointUtils, aesUtils, conversionUtils are in the same directory
import {
    genR,
    getG1R,
    getG2R
} from './blsPointUtils.js';

// Note: AESEncrypt/Decrypt and hex/bytes converters are imported dynamically within functions.

/**
 * Encodes a vote option string to a G1 point using the standard hash-to-curve function.
 * @param {string} option The vote option string.
 * @returns {string} The hex string representation of the G1 point (prefixed with 0x).
 * @throws {Error} If the input string cannot be hashed to a valid point.
 */
export function encodeVoteToPoint(option) {
    if (typeof option !== 'string' || option.length === 0) {
        throw new Error("Invalid vote option provided. Must be a non-empty string.");
    }
    try {
        // Convert the option string to UTF-8 bytes
        const optionBytes = Buffer.from(option, 'utf8');
        // Use the standard hash-to-curve function for G1
        const point = bls12_381.G1.hashToCurve(optionBytes);
        const pointHex = point.toHex(); // noble-curves toHex() by default returns raw hex for points
        console.log(`[encodeVoteToPoint] Mapped "${option}" to G1 point (raw hex): ${pointHex}`);
        // Return raw hex as expected by noble-curves fromHex if it's a point.
        // Other utils might expect "0x" for general hex, this one is specific to noble point hex.
        return pointHex.startsWith('0x') ? pointHex.slice(2) : pointHex;
    } catch (e) {
        console.error(`Error hashing vote option "${option}" to curve:`, e);
        throw new Error(`Failed to encode vote option "${option}": ${e.message}`);
    }
}

/**
 * Decodes a G1 point (hex string) back to a vote option string by comparing it
 * against the encodings of possible options.
 * @param {string} pointHex The hex string of the decrypted G1 point (expected to start with 0x).
 * @param {string[]} possibleOptions An array of possible vote option strings (e.g., ["Yes", "No"]).
 * @returns {string | null} The matching vote option string, or null if no match is found.
 * @throws {Error} If inputs are invalid.
 */
export function decodePointToVote(pointHex, possibleOptions) {
    if (typeof pointHex !== 'string' || !pointHex.startsWith('0x') || pointHex.length % 2 !== 0) {
         throw new Error("Invalid pointHex provided. Must be a valid hex string starting with 0x.");
    }
     if (!Array.isArray(possibleOptions) || possibleOptions.some(opt => typeof opt !== 'string' || opt.length === 0)) {
        throw new Error("Invalid possibleOptions provided. Must be an array of non-empty strings.");
    }

    console.log(`[decodePointToVote] Attempting to decode point: ${pointHex}`);
    console.log(`[decodePointToVote] Possible options:`, possibleOptions);

    try {
        // Pre-compute the encodings for efficiency if many points need decoding later,
        // but for a single call, direct comparison is fine.
        for (const option of possibleOptions) {
            const encodedOptionRawHex = encodeVoteToPoint(option); // This returns raw hex
            // Compare the input pointHex (which has "0x") with "0x" + raw encoded option
            if (('0x' + encodedOptionRawHex) === pointHex) {
                console.log(`[decodePointToVote] Decoded point ${pointHex} as: "${option}"`);
                return option;
            }
        }

        console.warn(`[decodePointToVote] Point ${pointHex} did not match any possible option.`);
        return null; // No match found
    } catch (e) {
         console.error(`Error during point decoding for point ${pointHex}:`, e);
         // Re-throw specific errors from encodeVoteToPoint if needed, or a general one
         throw new Error(`Failed to decode point ${pointHex}: ${e.message}`);
    }
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
        // AESEncrypt expects plaintext string and returns 0xIV+Ciphertext
        console.log("[encryptVoteData] Encrypting vote data with AES-GCM...");
        const ciphertextHex = await AESEncrypt(voteData, aesKey); 
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
 * Decrypts an encrypted vote using the reconstructed AES key.
 * This assumes the encryptedVoteHex is the direct AES-GCM output (0xIV+Ciphertext).
 * @param {string} encryptedVoteHex Hex string containing the IV prepended to the ciphertext (output of AESEncrypt).
 * @param {CryptoKey} reconstructedKey The AES-GCM CryptoKey derived from the reconstructed BigInt k.
 * @returns {Promise<string>} The decrypted vote string.
 * @throws {Error} If decryption fails.
 */
export async function decryptVote(encryptedVoteHex, reconstructedKey) {
    console.log("[decryptVote] Attempting to decrypt vote...");
    // Validation included in AESDecrypt
    if (!(reconstructedKey instanceof CryptoKey)) {
         throw new Error("Invalid reconstructedKey provided. Must be a CryptoKey.");
    }

    try {
        // Dynamically import AESDecrypt from aesUtils.js
        const { AESDecrypt } = await import('./aesUtils.js');
        
        console.log(`  Input Encrypted Hex (IV+Cipher): ${encryptedVoteHex.substring(0,40)}...`);
        console.log(`  Using reconstructed key:`, reconstructedKey); 

        // AESDecrypt handles splitting the 0x+IV and ciphertext and decrypting
        const decryptedString = await AESDecrypt(encryptedVoteHex, reconstructedKey);
        
        console.log("[decryptVote] Decryption successful. Result:", decryptedString);
        return decryptedString;
    } catch (error) {
        console.error("Error during AES decryption in decryptVote:", error);
        throw new Error(`Vote decryption failed: ${error.message}`);
    }
} 
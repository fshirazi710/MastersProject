/**
 * Generates cryptographically secure random bytes.
 * @param {number} size The number of bytes to generate.
 * @returns {Uint8Array} An array of random bytes.
 */
export function randomBytes(size) {
    if (typeof size !== 'number' || size <= 0 || !Number.isInteger(size)) {
        throw new Error("Size must be a positive integer.");
    }
    return crypto.getRandomValues(new Uint8Array(size));
}

/**
 * Encrypts text using AES-GCM with a given CryptoKey.
 * @param {string} text The plaintext string to encrypt.
 * @param {CryptoKey} key The AES-GCM CryptoKey (should be 256-bit).
 * @returns {Promise<string>} A hex string containing the IV prepended to the ciphertext.
 */
export async function AESEncrypt(text, key) {
    if (typeof text !== 'string' || !(key instanceof CryptoKey)) {
        console.error("Invalid input types for AESEncrypt");
        throw new Error("Invalid arguments for AES encryption.");
    }
    // Optional: Add check for key algorithm and length
    if (key.algorithm.name !== 'AES-GCM' || key.algorithm.length !== 256) {
        console.warn("AESEncrypt called with potentially incorrect key type/length.");
    }

    try {
        const iv = randomBytes(12); // AES-GCM standard IV size
        const encodedText = new TextEncoder().encode(text);

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: new Uint8Array() },
            key,
            encodedText
        );

        // Return IV prepended to ciphertext as a single hex string
        const { bytesToHex } = await import('./conversionUtils.js'); // Dynamic import
        const ivHex = bytesToHex(iv);
        const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBuffer));
        return ivHex + ciphertextHex;

    } catch (error) {
        console.error("Encryption failed:", error);
        // Avoid leaking sensitive details in the error message
        throw new Error("Encryption operation failed.");
    }
}

/**
 * Decrypts an AES-GCM encrypted hex string using a CryptoKey.
 * @param {string} encryptedHex The hex string containing IV prepended to ciphertext.
 * @param {CryptoKey} key The AES-GCM CryptoKey.
 * @returns {Promise<string>} The decrypted plaintext string.
 */
export async function AESDecrypt(encryptedHex, key) {
    // Input validation
    if (typeof encryptedHex !== 'string' || encryptedHex.length < 24 || !(key instanceof CryptoKey)) {
        console.error("Invalid input types or format for AESDecrypt");
        throw new Error("Invalid arguments for AES decryption.");
    }
    if (key.algorithm.name !== 'AES-GCM' || key.algorithm.length !== 256) {
        console.warn("AESDecrypt called with potentially incorrect key type/length.");
    }

    const { hexToBytes } = await import('./conversionUtils.js'); // Dynamic import
    let iv, ciphertext;
    try {
        iv = hexToBytes(encryptedHex.slice(0, 24)); // First 12 bytes (24 hex chars) are IV
        ciphertext = hexToBytes(encryptedHex.slice(24)); // The rest is ciphertext
    } catch (e) {
        console.error("Failed to parse encrypted hex string:", e);
        throw new Error("Invalid encrypted data format.");
    }

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv, additionalData: new Uint8Array() },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error("Decryption failed:", error); // Log the specific error
        // Provide a more generic error to the user
        throw new Error("Decryption failed. Check password or data integrity.");
    }
}

// --- Password-Based Key Derivation (PBKDF2) ---

// Default PBKDF2 parameters (can be adjusted)
const PBKDF2_ITERATIONS = 250000; // Higher = more secure, but slower
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH_BITS = 256; // For AES-256

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 * @param {string} password The user's password.
 * @param {Uint8Array} salt A random salt (should be stored alongside the encrypted data).
 * @returns {Promise<CryptoKey>} A CryptoKey suitable for AES-GCM encryption/decryption.
 */
export async function deriveKeyFromPassword(password, salt) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error("Password must be a non-empty string.");
    }
    if (!(salt instanceof Uint8Array) || salt.length < 8) { // Require a reasonable salt length
        throw new Error("Salt must be a Uint8Array of sufficient length (e.g., 8+ bytes).");
    }

    try {
        const passwordBuffer = new TextEncoder().encode(password);

        // Import the password as a base key material for PBKDF2
        const baseKey = await window.crypto.subtle.importKey(
            "raw",
            passwordBuffer,
            { name: "PBKDF2" },
            false, // not extractable
            ["deriveKey"]
        );

        // Derive the AES key using PBKDF2
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: PBKDF2_HASH,
            },
            baseKey,
            { name: "AES-GCM", length: AES_KEY_LENGTH_BITS }, // Specify AES-GCM key type
            true, // key is extractable (optional, set false if never needed raw)
            ["encrypt", "decrypt"] // Key usages
        );

        return derivedKey;
    } catch (error) {
        console.error("Password key derivation failed:", error);
        throw new Error("Failed to derive encryption key from password.");
    }
}

/**
 * Imports a BigInt as a raw AES-GCM CryptoKey.
 * Uses SHA-256 hash of the BigInt's minimal byte representation as the 32-byte key material.
 * @param {bigint} bigintKey The BigInt to use for key derivation.
 * @returns {Promise<CryptoKey>} A CryptoKey suitable for AES-GCM.
 */
export async function importBigIntAsCryptoKey(bigintKey) {
     if (typeof bigintKey !== 'bigint') {
        throw new Error(`Invalid input to importBigIntAsCryptoKey: expected bigint, got ${typeof bigintKey}`);
    }
    const { hexToBytes, bytesToHex } = await import('./conversionUtils.js'); // Dynamic import

    try {
        // 1. Convert BigInt to its minimal byte representation (big-endian)
        let hexKey = bigintKey.toString(16);
        if (hexKey.length % 2) { hexKey = '0' + hexKey; } // Ensure even length
        const minimalKeyBytes = hexToBytes(hexKey);

        // 2. Hash the minimal bytes using SHA-256
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', minimalKeyBytes);
        const keyBytes = new Uint8Array(hashBuffer); // hashBuffer is the 32-byte digest

        // Log the final key bytes being imported (optional, but good for final check)
        console.log(`importBigIntAsCryptoKey: Importing SHA-256 hash of k as keyBytes (Hex): ${bytesToHex(keyBytes)} (Original k BigInt: ${bigintKey.toString()})`);

        // 3. Import the 32-byte hash digest as the AES key
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyBytes, // Use the 32-byte hash
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        return cryptoKey;
    } catch (error) {
        console.error("Error importing BigInt as CryptoKey:", error);
        throw new Error("Failed to import key material.");
    }
}
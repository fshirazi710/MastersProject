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
        return "0x" + ivHex + ciphertextHex;

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
    if (typeof encryptedHex !== 'string' || !encryptedHex.startsWith("0x") || encryptedHex.length < 26) { // Min length: 0x + 12-byte IV (24 hex) = 26 chars
        console.error("Invalid input types or format for AESDecrypt. Expected '0x' prefixed hex string with IV.");
        throw new Error("Invalid arguments for AES decryption. Expected '0x' prefixed hex string.");
    }
    if (key.algorithm.name !== 'AES-GCM' || key.algorithm.length !== 256) {
        console.warn("AESDecrypt called with potentially incorrect key type/length.");
    }

    const { hexToBytes } = await import('./conversionUtils.js'); // Dynamic import
    let iv, ciphertext;
    try {
        // Slice to remove "0x", then take IV and ciphertext
        iv = hexToBytes(encryptedHex.slice(2, 26)); // First 12 bytes (24 hex chars) after "0x" are IV
        ciphertext = hexToBytes(encryptedHex.slice(26)); // The rest is ciphertext
    } catch (e) {
        console.error("Failed to parse encrypted hex string (after 0x prefix):", e);
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

// --- Password-Based Encryption Wrappers ---
const SALT_LENGTH_BYTES = 16; // 128-bit salt
const IV_HEX_LENGTH = 24; // 12-byte IV is 24 hex characters
const SALT_HEX_LENGTH = SALT_LENGTH_BYTES * 2;

/**
 * Encrypts plaintext using a password. Generates a random salt, derives a key using PBKDF2,
 * then encrypts with AES-GCM. The salt and IV are prepended to the ciphertext.
 * @param {string} plaintext The text string to encrypt.
 * @param {string} password The password to use for key derivation.
 * @returns {Promise<string>} A hex string: "0x" + SALT_HEX + IV_HEX + CIPHERTEXT_HEX.
 * @throws {Error} If encryption or key derivation fails.
 */
export async function encryptWithPassword(plaintext, password) {
    if (typeof plaintext !== 'string') {
        throw new Error("Plaintext must be a string.");
    }
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error("Password must be a non-empty string.");
    }

    try {
        const { bytesToHex } = await import('./conversionUtils.js');

        // 1. Generate a random salt
        const salt = randomBytes(SALT_LENGTH_BYTES);
        const saltHex = bytesToHex(salt);

        // 2. Derive encryption key from password and salt
        const cryptoKey = await deriveKeyFromPassword(password, salt);

        // 3. Encrypt using AESEncrypt (which handles IV generation and prepends IV)
        // AESEncrypt already returns "0x" + IV_HEX + CIPHERTEXT_HEX
        const ivAndCiphertextHex = await AESEncrypt(plaintext, cryptoKey);

        // 4. Prepend saltHex to the ivAndCiphertextHex. 
        // Need to insert saltHex after the "0x" from AESEncrypt's output.
        const finalEncryptedHex = "0x" + saltHex + ivAndCiphertextHex.substring(2); // Remove "0x" from ivAndCiphertextHex before concatenation

        console.log(`[encryptWithPassword] Encrypted. SaltHex length: ${saltHex.length}, IV+Ciphertext part length (excl 0x): ${ivAndCiphertextHex.substring(2).length}`);
        return finalEncryptedHex;

    } catch (error) {
        console.error("encryptWithPassword failed:", error);
        throw new Error(`Password-based encryption failed: ${error.message}`);
    }
}

/**
 * Decrypts data that was encrypted with a password using `encryptWithPassword`.
 * Extracts salt, derives key, extracts IV, and then decrypts.
 * @param {string} encryptedDataHex The hex string "0xSALT_HEXIV_HEXCIPHERTEXT_HEX".
 * @param {string} password The password for decryption.
 * @returns {Promise<string>} The decrypted plaintext string.
 * @throws {Error} If decryption or key derivation fails, or format is invalid.
 */
export async function decryptWithPassword(encryptedDataHex, password) {
    if (typeof encryptedDataHex !== 'string' || !encryptedDataHex.startsWith("0x")) {
        throw new Error("Encrypted data must be a hex string starting with '0x'.");
    }
    // Min length: "0x" + SALT_HEX_LENGTH + IV_HEX_LENGTH + at least 1 byte ciphertext (2 hex chars)
    if (encryptedDataHex.length < 2 + SALT_HEX_LENGTH + IV_HEX_LENGTH + 2) { 
        throw new Error("Encrypted data hex string is too short to contain salt, IV, and ciphertext.");
    }
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error("Password must be a non-empty string for decryption.");
    }

    try {
        const { hexToBytes } = await import('./conversionUtils.js');

        // 1. Extract salt (comes after "0x")
        const saltHex = encryptedDataHex.substring(2, 2 + SALT_HEX_LENGTH);
        const salt = hexToBytes(saltHex);

        // 2. Derive decryption key
        const cryptoKey = await deriveKeyFromPassword(password, salt);

        // 3. Prepare the part that AESDecrypt expects: "0x" + IV_HEX + CIPHERTEXT_HEX
        const ivAndCiphertextHex = "0x" + encryptedDataHex.substring(2 + SALT_HEX_LENGTH);
        
        // 4. Decrypt using AESDecrypt
        const plaintext = await AESDecrypt(ivAndCiphertextHex, cryptoKey);

        console.log(`[decryptWithPassword] Decrypted successfully.`);
        return plaintext;

    } catch (error) {
        console.error("decryptWithPassword failed:", error);
        // It might be a password error, format error, or data integrity error.
        // AESDecrypt throws "Decryption failed. Check password or data integrity."
        // deriveKeyFromPassword throws "Failed to derive encryption key from password."
        throw new Error(`Password-based decryption failed: ${error.message}`); 
    }
}
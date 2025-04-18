import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";
import { bls } from "@noble/curves/abstract/bls";

const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

export function generateBLSKeyPair() {
    // Use the library utility to generate a cryptographically secure private key (Uint8Array)
    // This ensures the key is valid and < CURVE_ORDER, preventing scalar errors.
    const skBytes = bls12_381.utils.randomPrivateKey(); 
    // Convert the valid private key bytes to a BigInt for multiplication
    const skBigInt = BigInt("0x" + Buffer.from(skBytes).toString("hex")); 
    // Calculate the public key Point object
    const pkPoint = bls12_381.G1.ProjectivePoint.BASE.multiply(skBigInt); 
    // Return the BigInt secret key and the ProjectivePoint public key object
    // (Changed from returning raw Uint8Array public key)
    return { sk: skBigInt, pk: pkPoint }; 
}

function genR() {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    const hexString = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return mod(BigInt("0x" + hexString), FIELD_ORDER);
}

function getG1R(r) {
    const g1 = bls12_381.G1.ProjectivePoint.BASE;
    const result = g1.multiply(r);
    return result.toHex();
}

function getG2R(r) {
    const g2 = bls12_381.G2.ProjectivePoint.BASE;
    const result = g2.multiply(r);
    return result.toHex();
}

export function randomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}

function bigIntToHex(bigInt) {
    let hex = bigInt.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hex;
}

export function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

export function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function pointToBigint(point) {
    return mod(BigInt("0x" + point.toHex()), FIELD_ORDER);
}

function stringToBigInt(str) {
    return BigInt(str);
}

export async function AESEncrypt(text, key) {
    // Consider adding input type validation (text is string, key is CryptoKey)
    if (typeof text !== 'string' || !(key instanceof CryptoKey)) {
        console.error("Invalid input types for AESEncrypt");
        throw new Error("Invalid arguments for AES encryption.");
    }
    try {
        const iv = randomBytes(12); // Use our randomBytes helper
        const encodedText = new TextEncoder().encode(text);
        const ciphertextBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedText);
        // Return IV and Ciphertext separately as hex strings
        return {
            iv: bytesToHex(iv),
            ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer))
        }; 
    } catch (error) {
        console.error("Encryption failed:", error);
        throw error;
    }
}

export async function AESDecrypt(encryptedHex, key) {
    // Consider adding input type validation
    if (typeof encryptedHex !== 'string' || encryptedHex.length < 24 || !(key instanceof CryptoKey)) {
        console.error("Invalid input types or format for AESDecrypt");
        throw new Error("Invalid arguments for AES decryption.");
    }
    const iv = hexToBytes(encryptedHex.slice(0, 24));
    const ciphertext = hexToBytes(encryptedHex.slice(24));

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error("Decryption failed:", error);
        // Provide a more generic error to the user, log the specific one
        throw new Error("Decryption failed. Check password or data integrity."); 
    }
}

export async function getKAndSecretShares(pubkeys, threshold, total) {
    const indexes = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    const tIndexes = indexes.slice(0, threshold);
    const restIndexes = indexes.slice(threshold);
    const tPubkeys = pubkeys.slice(0, threshold);
    const restPubkeys = pubkeys.slice(threshold);

    const r = genR();
    const [k, alphas] = await getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys);

    const g1r = getG1R(r)

    const g2r = getG2R(r)

    return [k, g1r, g2r, alphas];
}

export function generateShares(g1r_hex, privateKey) {
    // Input validation/conversion
    let bigIntPrivateKey;
    if (typeof privateKey === 'bigint') {
        bigIntPrivateKey = privateKey;
    } else if (typeof privateKey === 'string') {
        try {
             // Ensure hex strings start with 0x, handle potential errors
            const keyHex = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
            bigIntPrivateKey = BigInt(keyHex);
        } catch (e) {
            console.error("Invalid private key string format for BigInt conversion:", privateKey, e);
            throw new Error("Invalid private key format.");
        }
    } else {
        throw new Error("Invalid private key type provided to generateShares.");
    }

    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);
    // Handle potential errors during point deserialization
    try {
        const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
        const result = g1r_point.multiply(modBigIntPrivateKey);
        return bigIntToHex(pointToBigint(result))
    } catch (e) {
        console.error("Error during share generation (point operation):", e);
        throw new Error(`Failed to generate share from g1r: ${g1r_hex}`);
    }
}

export function verifyShares(share, share2, publicKey, g2r) {
    // const sharePoint = bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt("0x" + share2))
    // const shareBytes = hexToBytes(bigIntToHex(pointToBigint(sharePoint)))

    const publicKeyAffine = bls12_381.G1.ProjectivePoint.fromHex(publicKey);
    const shareAffine = bls12_381.G1.ProjectivePoint.fromHex(share2);
    const g2rAffine = bls12_381.G2.ProjectivePoint.fromHex(g2r);

    const pairing1 = bls12_381.pairing(shareAffine, bls12_381.G2.ProjectivePoint.BASE);
    const pairing2 = bls12_381.pairing(publicKeyAffine, g2rAffine);

    console.log(pairing1)
    console.log(pairing2)

    return pairing1 === pairing2;
}

export async function recomputeKey(indexes, shares, alphas, threshold) {
    // Ensure inputs are the types we expect/need early on
    const bigIntIndexes = indexes.map(idx => {
        try {
            return BigInt(idx); // Expects numbers or numeric strings
        } catch (e) {
            console.error(`Failed to convert index '${idx}' to BigInt:`, e);
            throw new Error(`Invalid index format for BigInt conversion: ${idx}`);
        }
    });
    const bigIntShares = shares.map(s => {
         try {
            // Handle potential '0x' prefix if shares are hex strings, or already BigInt
            if (typeof s === 'bigint') return s;
            if (typeof s === 'string' && s.startsWith('0x')) return BigInt(s);
             // Assume it's a direct numeric representation (string or number)
            return BigInt(s);
        } catch (e) {
            console.error(`Failed to convert share '${s}' to BigInt:`, e);
            throw new Error(`Invalid share format for BigInt conversion: ${s}`);
        }
    });
    const thresholdNum = Number(threshold); // Keep threshold as number for comparisons/indexing

    // Check if threshold conversion worked
    if (isNaN(thresholdNum)) {
         throw new Error("Invalid threshold value, cannot convert to number.");
    }

    // --- FIX: Use the first thresholdNum *submitted* points for interpolation ---
    if (bigIntIndexes.length < thresholdNum) {
        throw new Error(`Insufficient shares provided (${bigIntIndexes.length}) to meet threshold (${thresholdNum}) for reconstruction.`);
    }

    const basisIndices = [];
    const valuesForInterpolation = [];

    // Iterate through the first thresholdNum submitted shares/indexes
    for (let i = 0; i < thresholdNum; i++) {
        const currentBigIntIndex = bigIntIndexes[i];
        const currentBigIntShare = bigIntShares[i];

        basisIndices.push(currentBigIntIndex); // Add index to basis list

        // Determine the value to use for interpolation based on the index
        if (Number(currentBigIntIndex) <= thresholdNum) {
            // Index is within the original threshold, use the raw share
            valuesForInterpolation.push(currentBigIntShare);
        } else {
            // Index is beyond the original threshold, need to use alpha
            const alphaIndex = Number(currentBigIntIndex) - 1 - thresholdNum;
            if (alphaIndex < 0 || alphaIndex >= alphas.length || typeof alphas[alphaIndex] !== 'string') {
                console.error(`Invalid alpha access: alphaIndex=${alphaIndex}, alphas.length=${alphas.length}, currentBigIntIndex=${currentBigIntIndex}, thresholdNum=${thresholdNum}`);
                throw new Error(`Invalid alpha index or alpha value at calculated index ${alphaIndex}`);
            }
            const alphaBigInt = stringToBigInt(alphas[alphaIndex]);

            // Perform XOR term calculation
            const shareHex = bigIntToHex(currentBigIntShare);
            const alphaHex = bigIntToHex(alphaBigInt);
            const alphaBytes = hexToBytes(alphaHex);
            const shareBytes = hexToBytes(shareHex);

             if (alphaBytes.length === 0 || shareBytes.length === 0) {
                 console.error("Cannot perform XOR on empty byte arrays. Share:", shareHex, "Alpha:", alphaHex);
                 throw new Error("Empty byte array encountered during XOR operation in recomputeKey.");
            }

            const maxLength = Math.max(alphaBytes.length, shareBytes.length);
            const paddedAlphaBytes = padBytesStart(alphaBytes, maxLength);
            const paddedShareBytes = padBytesStart(shareBytes, maxLength);

            const xorResult = [];
            for (let j = 0; j < maxLength; j++) {
                xorResult.push(paddedAlphaBytes[j] ^ paddedShareBytes[j]);
            }

            const term = BigInt('0x' + Buffer.from(xorResult).toString('hex'));
            valuesForInterpolation.push(term); // Use the XORed term for interpolation
        }
    }

    // Calculate basis using the collected indices
    const basis = lagrangeBasis(basisIndices, BigInt(0));

    // Ensure lengths match before interpolation
    if (basis.length !== valuesForInterpolation.length) {
        console.error("Basis length:", basis.length, "Values length:", valuesForInterpolation.length);
        throw new Error("Mismatch between basis length and interpolation values length.");
    }
     if (basis.length !== thresholdNum) {
        console.error("Basis length (", basis.length, ") does not match threshold (", thresholdNum, ")");
        // This might indicate an issue with lagrangeBasis or the input indices
        throw new Error("Basis length does not match threshold.");
    }

    // --- Remove Debugging Logs ---
    // console.log("--- Inputs to Lagrange Interpolation ---");
    // console.log("Threshold:", thresholdNum);
    // console.log("Basis Indices (BigInt):", basisIndices.map(v => v.toString()));
    // console.log("Values for Interpolation (BigInt):", valuesForInterpolation.map(v => v.toString()));
    // console.log("Calculated Basis (Lagrange Coefficients L_i(0)):", basis.map(v => v.toString()));
    // -------------------------

    // Perform interpolation
    const k = lagrangeInterpolate(basis, valuesForInterpolation);
    // --------------------------------------------------------------------

    // console.log("Recomputed k (BigInt):", k); // Removed log
    const key = await importBigIntAsCryptoKey(k);

    return key;
}

// Helper function to pad Uint8Array with leading zeros
function padBytesStart(bytes, length) {
    if (bytes.length >= length) {
        return bytes;
    }
    const padded = new Uint8Array(length);
    padded.set(bytes, length - bytes.length);
    return padded;
}

function computePkRValue(pubkey, r) {
    // Remove "0x" prefix if present, as fromHex expects raw hex digits
    const hexString = pubkey.startsWith('0x') ? pubkey.slice(2) : pubkey;
    // Pass the raw hex string to fromHex
    const pkPoint = bls12_381.G1.ProjectivePoint.fromHex(hexString); 
    return pkPoint.multiply(r);
}

function lagrangeBasis(indexes, x) {
    // Add check for empty indexes to prevent division by zero or unexpected behavior
    if (!indexes || indexes.length === 0) {
        console.error("lagrangeBasis called with empty or invalid indexes.");
        throw new Error("Cannot calculate Lagrange basis with no indexes.");
    }
    return indexes.map((i) => {
      let numerator = BigInt(1);
      let denominator = BigInt(1);
  
      for (const j of indexes) {
        if (i !== j) {
          numerator = mod(numerator * (x - j), FIELD_ORDER);
          denominator = mod(denominator * (i - j), FIELD_ORDER);
        }
      }
  
      return mod(numerator * modInverse(denominator, FIELD_ORDER), FIELD_ORDER);
    });
}

function modInverse(a, m) {
    a = (a % m + m) % m;

    const s = [];
    let b = m;

    while (b) {
        [a, b] = [b, a % b];
        s.push({ a, b });
    }

    let x = BigInt(1);
    let y = BigInt(0);

    for (let i = s.length - 2; i >= 0; --i) {
        [x, y] = [y, x - y * BigInt(s[i].a / s[i].b)];
    }

    return (y % m + m) % m;
}

function lagrangeInterpolate(basis, shares) {
    // Ensure accumulator and share are BigInt before multiplication
    return shares.reduce((acc, share, i) => {
        const currentShare = BigInt(share); // Ensure share is BigInt
        const currentBasis = BigInt(basis[i]); // Ensure basis element is BigInt
        const product = mod(currentShare * currentBasis, FIELD_ORDER);
        return mod(BigInt(acc) + product, FIELD_ORDER); // Ensure accumulator is BigInt
    }, BigInt(0));
}

export async function getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys) {
    const tShares = tPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

    console.log(tShares)
    const basis = lagrangeBasis(tIndexes, BigInt(0));
    const k = lagrangeInterpolate(basis, tShares);
    console.log(k)
    const key = await importBigIntAsCryptoKey(k);

    const restShares = restPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

    let alphas = [];
    for (let counter = 0; counter < restIndexes.length; counter++) {
        const i = restIndexes[counter];
        const i_basis = lagrangeBasis(tIndexes, i);
        const i_point = lagrangeInterpolate(i_basis, tShares);

        // Convert BigInts to byte arrays for XOR
        const i_point_bytes = hexToBytes(bigIntToHex(i_point));
        const i_share_bytes = hexToBytes(bigIntToHex(restShares[counter]));

        // --- Add padding before XOR, consistent with recomputeKey ---
        if (i_point_bytes.length === 0 || i_share_bytes.length === 0) {
            console.error("Cannot perform XOR on empty byte arrays during alpha generation. Index:", i);
            throw new Error("Empty byte array encountered during alpha generation.");
        }

        const maxLength = Math.max(i_point_bytes.length, i_share_bytes.length);
        const padded_i_point_bytes = padBytesStart(i_point_bytes, maxLength);
        const padded_i_share_bytes = padBytesStart(i_share_bytes, maxLength);

        const xorResultBytes = [];
        for (let j = 0; j < maxLength; j++) {
            xorResultBytes.push(padded_i_point_bytes[j] ^ padded_i_share_bytes[j]);
        }
        // -------------------------------------------------------------

        // Convert padded XOR result back to BigInt
        const i_alpha = BigInt("0x" + Buffer.from(xorResultBytes).toString("hex")); 
        alphas.push(i_alpha.toString());
    }

    return [key, alphas];
}

export async function importBigIntAsCryptoKey(bigintKey) {
    try {
        let hexKey = bigintKey.toString(16).padStart(64, '0'); 
        
        const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM", length: 256 }, // AES-256
            true,
            ["encrypt", "decrypt"]
        );

        return cryptoKey;
    } catch (error) {
        console.error("Error importing CryptoKey:", error);
        throw error;
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

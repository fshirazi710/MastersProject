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
    // Handle potential hex strings (with or without 0x prefix)
    if (typeof str !== 'string') {
        throw new Error(`Invalid input to stringToBigInt: expected string, got ${typeof str}`);
    }
    const trimmedStr = str.trim(); // Remove leading/trailing whitespace
    if (trimmedStr.startsWith('0x')) {
        return BigInt(trimmedStr);
    } else if (/^[0-9a-fA-F]+$/.test(trimmedStr)) { // Check if it IS a hex string (without 0x)
        return BigInt('0x' + trimmedStr);
    } else { // Assume decimal if not hex
        return BigInt(trimmedStr); // Let BigInt handle potential decimal errors
    }
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

        // --- ADD DETAILED LOG BEFORE ENCRYPT ---
        console.log("AESEncrypt Inputs:");
        console.log("  IV (Hex):", bytesToHex(iv));
        console.log("  Key Algo:", key.algorithm);
        console.log("  Key Type:", key.type);
        console.log("  Key Usages:", key.usages);
        console.log("  Encoded Text (Hex):", bytesToHex(encodedText));
        // --------------------------------------

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: new Uint8Array() }, 
            key, 
            encodedText
        );
        // --- FIX: Return IV prepended to ciphertext as a single hex string ---
        const ivHex = bytesToHex(iv);
        const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBuffer));
        return ivHex + ciphertextHex; 
        // --- End Fix ---
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

    // --- ADD DETAILED LOG BEFORE DECRYPT ---
    console.log("AESDecrypt Inputs:");
    console.log("  IV (Hex):", bytesToHex(iv));
    console.log("  Ciphertext (Hex):", bytesToHex(ciphertext)); 
    console.log("  Key Algo:", key.algorithm);
    console.log("  Key Type:", key.type);
    console.log("  Key Usages:", key.usages);
    // --------------------------------------

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv, additionalData: new Uint8Array() }, 
            key, 
            ciphertext
        );
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
    const [k_bigint, alphas_hex] = await getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys);

    const g1r = getG1R(r)
    const g2r = getG2R(r)

    return [k_bigint, g1r, g2r, alphas_hex];
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

// Helper function to convert BigInt to a 32-byte Uint8Array (Big-Endian)
function bigIntTo32Bytes(num) {
  let hex = num.toString(16);
  // Ensure even length hex string
  if (hex.length % 2) { hex = '0' + hex; }
  // Pad with leading zeros to 64 hex characters (32 bytes)
  const paddedHex = hex.padStart(64, '0');
  // Handle cases where the number might be too large (take least significant 32 bytes)
  // Although FIELD_ORDER should prevent this for valid numbers in the field
  const finalHex = paddedHex.length > 64 ? paddedHex.slice(paddedHex.length - 64) : paddedHex;
  // Convert final hex string to Uint8Array
  return hexToBytes(finalHex);
}

export async function recomputeKey(indexes, shares, alphas, threshold) {
    console.log("--- recomputeKey START ---");
    console.log("Input Indexes:", indexes);
    console.log("Input Shares (BigInts/Hex?):", shares); // Check input format
    console.log("Input Alphas (Hex Strings?):", alphas);
    console.log("Input Threshold:", threshold);

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
            // --- Ensure 0x prefix for hex string shares ---
            if (typeof s === 'string') {
                const trimmedShare = s.trim();
                if (trimmedShare.startsWith('0x')) return BigInt(trimmedShare);
                // Assuming hex if not already BigInt, add 0x if missing
                if (/^[0-9a-fA-F]+$/.test(trimmedShare)) return BigInt('0x' + trimmedShare);
                 // Fallback: try as decimal (might fail if it was meant to be hex)
                console.warn(`Share string '${s}' doesn't look like hex, attempting decimal conversion.`);
                return BigInt(trimmedShare); 
            }
            // --- End Share Conversion Update ---
            // Original fallback (might not be needed now)
            // return BigInt(s);
            throw new Error(`Invalid share type: expected string or bigint, got ${typeof s}`);
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

    if (bigIntIndexes.length < thresholdNum) {
        throw new Error(`Insufficient shares provided (${bigIntIndexes.length}) to meet threshold (${thresholdNum}) for reconstruction.`);
    }

    const basisIndices = [];
    const valuesForInterpolation = [];
    console.log("Processing first", thresholdNum, "shares for interpolation...");

    // Iterate through the first thresholdNum submitted shares/indexes
    for (let i = 0; i < thresholdNum; i++) {
        const currentBigIntIndex = bigIntIndexes[i];
        const currentBigIntShare = bigIntShares[i];
        console.log(`  [i=${i}] Holder Index: ${currentBigIntIndex}`);

        basisIndices.push(currentBigIntIndex); // Add index to basis list

        // Determine the value to use for interpolation based on the index
        if (Number(currentBigIntIndex) <= thresholdNum) {
            console.log(`    Index <= threshold. Using raw share: ${currentBigIntShare}`);
            valuesForInterpolation.push(currentBigIntShare);
        } else {
            console.log(`    Index > threshold. Using share XOR alpha.`);
            const alphaIndex = Number(currentBigIntIndex) - 1 - thresholdNum;
            if (alphaIndex < 0 || alphaIndex >= alphas.length || typeof alphas[alphaIndex] !== 'string') {
                console.error(`    Invalid alpha access: alphaIndex=${alphaIndex}, alphas.length=${alphas.length}, currentBigIntIndex=${currentBigIntIndex}, thresholdNum=${thresholdNum}`);
                throw new Error(`Invalid alpha index or alpha value at calculated index ${alphaIndex}`);
            }
            const alphaString = alphas[alphaIndex];
            const alphaBigInt = stringToBigInt(alphaString); // Uses updated stringToBigInt
            console.log(`    Share: ${currentBigIntShare}`);
            console.log(`    Alpha String (Hex): ${alphaString}`);
            console.log(`    Alpha BigInt: ${alphaBigInt}`);

            // Perform XOR term calculation
            const shareBytes = bigIntTo32Bytes(currentBigIntShare);
            const alphaBytes = bigIntTo32Bytes(alphaBigInt);
             if (alphaBytes.length !== 32 || shareBytes.length !== 32) {
                 console.error("    Byte conversion did not result in 32 bytes. Share length:", shareBytes.length, "Alpha length:", alphaBytes.length);
                 throw new Error("Internal error during byte conversion for XOR.");
             }

            const xorResult = [];
            for (let j = 0; j < 32; j++) { 
                xorResult.push(alphaBytes[j] ^ shareBytes[j]);
            }
            const term = BigInt('0x' + bytesToHex(new Uint8Array(xorResult)));
            console.log(`    Share Bytes (Hex): ${bytesToHex(shareBytes)}`);
            console.log(`    Alpha Bytes (Hex): ${bytesToHex(alphaBytes)}`);
            console.log(`    XOR Result Bytes (Hex): ${bytesToHex(new Uint8Array(xorResult))}`);
            console.log(`    XOR Term (BigInt): ${term}`);
            valuesForInterpolation.push(term); // Use the XORed term for interpolation
        }
    }

    console.log("Basis Indices for Lagrange:", basisIndices.map(v=>v.toString()));
    console.log("Values for Interpolation:", valuesForInterpolation.map(v=>v.toString()));

    // Calculate basis using the collected indices
    const basis = lagrangeBasis(basisIndices, BigInt(0));
    console.log("Lagrange Basis L_i(0):", basis.map(v=>v.toString()));

    if (basis.length !== valuesForInterpolation.length || basis.length !== thresholdNum) {
       console.error("Basis/Values/Threshold length mismatch! Basis:", basis.length, "Values:", valuesForInterpolation.length, "Threshold:", thresholdNum);
       throw new Error("Internal error: Basis/Values/Threshold length mismatch.");
    }

    // Perform interpolation
    const k = lagrangeInterpolate(basis, valuesForInterpolation);
    console.log("Recomputed k (BigInt):", k.toString()); 
    console.log("--- recomputeKey END ---");

    const key = await importBigIntAsCryptoKey(k);

    return key;
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
    // Ensure a is within [0, m-1] and m > 0
    if (m <= 0n) throw new Error("Modulus must be positive"); // Check m is BigInt
    a = (a % m + m) % m;
    if (a === 0n) throw new Error("Cannot compute inverse of 0");

    let r_prev = m;
    let r_curr = a;
    let x_prev = 0n;
    let x_curr = 1n;
    // y coefficients are not needed for the inverse result

    while (r_curr > 0n) {
        const q = r_prev / r_curr; // Floor division

        // Update remainders
        [r_prev, r_curr] = [r_curr, r_prev - q * r_curr];

        // Update x coefficients (corresponding to original 'a')
        [x_prev, x_curr] = [x_curr, x_prev - q * x_curr];
    }

    // After loop, r_prev holds the gcd(a, m)
    // x_prev holds the Bezout coefficient corresponding to 'a' (which is the inverse)
    if (r_prev !== 1n) {
        console.error(`Modular inverse does not exist for ${a} mod ${m} (GCD is ${r_prev}, not 1)`);
        throw new Error("Modular inverse does not exist (GCD != 1)");
    }

    // Ensure result is positive in [0, m-1]
    return (x_prev % m + m) % m;
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
    // --- DETAILED LOGGING START ---
    console.log("--- getKAndAlphas START ---");
    console.log("Input r:", r.toString());
    console.log("Input tIndexes:", tIndexes.map(v=>v.toString()));
    console.log("Input tPubkeys:", tPubkeys); // Log raw pubkeys
    console.log("Input restIndexes:", restIndexes.map(v=>v.toString()));
    console.log("Input restPubkeys:", restPubkeys); // Log raw pubkeys
    // --- DETAILED LOGGING END ---

    const tShares = tPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

    // --- DETAILED LOGGING START ---
    console.log("Calculated tShares:", tShares.map(v=>v.toString()));
    // --- DETAILED LOGGING END ---

    // console.log(tShares) // Original log, commented out for clarity
    const basis = lagrangeBasis(tIndexes, BigInt(0));
    const k = lagrangeInterpolate(basis, tShares);
    // Log the original k computed during generation
    console.log("Original k (BigInt) during getKAndAlphas:", k.toString());

    // --- DETAILED LOGGING START ---
    // Note: Key derivation happens later, after this function returns k
    // const key = await importBigIntAsCryptoKey(k); // Original line moved
    // --- DETAILED LOGGING END ---

    const restShares = restPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

    // --- DETAILED LOGGING START ---
    console.log("Calculated restShares:", restShares.map(v=>v.toString()));
    // --- DETAILED LOGGING END ---

    let alphas = [];
    console.log("Calculating alphas..."); // Log start of alpha loop
    for (let counter = 0; counter < restIndexes.length; counter++) {
        const i = restIndexes[counter];
        // --- DETAILED LOGGING START ---
        console.log(`  Alpha calculation for index ${i}:`);
        // --- DETAILED LOGGING END ---
        const i_basis = lagrangeBasis(tIndexes, i);
        const i_point = lagrangeInterpolate(i_basis, tShares);
        // --- DETAILED LOGGING START ---
        console.log(`    i_point (P(${i})): ${i_point.toString()}`);
        console.log(`    restShare[${counter}] (S(${i})): ${restShares[counter].toString()}`);
        // --- DETAILED LOGGING END ---

        // --- CORRECTED: Convert BigInts to FIXED 32 bytes before XOR ---
        const i_point_bytes = bigIntTo32Bytes(i_point);
        const i_share_bytes = bigIntTo32Bytes(restShares[counter]);
        // -----------------------------------------------------------

        // Ensure byte arrays are 32 bytes (defensive check)
        if (i_point_bytes.length !== 32 || i_share_bytes.length !== 32) {
            console.error("Byte conversion did not result in 32 bytes during alpha generation. Index:", i);
            throw new Error("Internal error during byte conversion for alpha XOR.");
        }
        // --- DETAILED LOGGING START ---
        console.log(`    i_point_bytes (Hex): ${bytesToHex(i_point_bytes)}`);
        console.log(`    i_share_bytes (Hex): ${bytesToHex(i_share_bytes)}`);
        // --- DETAILED LOGGING END ---

        const xorResultBytes = [];
        for (let j = 0; j < 32; j++) { // Iterate exactly 32 times
            xorResultBytes.push(i_point_bytes[j] ^ i_share_bytes[j]);
        }
        // --- DETAILED LOGGING START ---
        const xorHex = bytesToHex(new Uint8Array(xorResultBytes));
        console.log(`    XOR Result Bytes (Hex): ${xorHex}`);
        // --- DETAILED LOGGING END ---

        // Convert 32-byte XOR result back to BigInt
        const i_alpha = BigInt("0x" + xorHex);
        // --- DETAILED LOGGING START ---
        console.log(`    Calculated Alpha (BigInt): ${i_alpha.toString()}`);
        // --- DETAILED LOGGING END ---

        // --- CORRECTED: Store HEX string representation for API ---
        const alphaHex = i_alpha.toString(16); // Use existing hex string
        alphas.push(alphaHex);
        // --- DETAILED LOGGING START ---
        console.log(`    Stored Alpha (Hex String): ${alphaHex}`);
        // --- DETAILED LOGGING END ---
        // --------------------------------------------------------
    }

    // --- DETAILED LOGGING START ---
    console.log("Final generated alphas (Hex Strings):", alphas);
    console.log("--- getKAndAlphas END ---");
    // --- DETAILED LOGGING END ---

    // --- CORRECTED: Return k as BigInt, not CryptoKey ---
    // The encryption step needs the CryptoKey, but this function should return the raw components
    return [k, alphas]; // Return BigInt k and hex string alphas
}

export async function importBigIntAsCryptoKey(bigintKey) {
    try {
        // --- FIX: Derive 32-byte key using SHA-256 --- 

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
        // --- END FIX --- 

        /* --- OLD METHOD (Incorrect for keys > 256 bits) ---
        let hexKey = bigintKey.toString(16).padStart(64, '0'); 
        const keyBytes_old = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        console.log(`importBigIntAsCryptoKey: Importing keyBytes (Hex): ${bytesToHex(keyBytes_old)} from BigInt: ${bigintKey.toString()}`);
        const cryptoKey_old = await window.crypto.subtle.importKey(
            "raw",
            keyBytes_old,
            { name: "AES-GCM", length: 256 }, // AES-256
            true,
            ["encrypt", "decrypt"]
        );
        return cryptoKey_old;
        */

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

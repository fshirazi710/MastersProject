import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";

// Import conversion utilities
import {
    bytesToHex,
    pointToBigint,
    stringToBigInt,
    bigIntTo32Bytes
} from './conversionUtils.js';

// Import Lagrange utilities
import {
    lagrangeBasis,
    lagrangeInterpolate
} from './lagrangeUtils.js';

// Import BLS Point utilities
import {
    genR,
    getG1R,
    getG2R,
    computePkRValue
} from './blsPointUtils.js';

// AES/Password functions are in aesUtils.js and will be imported dynamically where needed.

const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

/**
 * Generates a BLS key pair (private key as BigInt, public key as ProjectivePoint).
 * @returns {{sk: bigint, pk: object}} Object containing the secret key (BigInt) and public key (ProjectivePoint).
 */
export function generateBLSKeyPair() {
    const skBytes = bls12_381.utils.randomPrivateKey(); 
    const skBigInt = BigInt("0x" + Buffer.from(skBytes).toString("hex")); 
    const pkPoint = bls12_381.G1.ProjectivePoint.BASE.multiply(skBigInt); 
    return { sk: skBigInt, pk: pkPoint }; 
}

/**
 * Sets up the threshold parameters (k, g1r, g2r, alphas).
 * @param {string[]} pubkeys Array of participant public keys (G1 hex strings).
 * @param {number} threshold The minimum number of shares required (t).
 * @param {number} total The total number of participants (n).
 * @returns {Promise<[bigint, string, string, string[]]>} Array containing [k (BigInt), g1r (hex), g2r (hex), alphas (hex strings)].
 */
export async function getKAndSecretShares(pubkeys, threshold, total) {
    const indexes = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    const tIndexes = indexes.slice(0, threshold);
    const restIndexes = indexes.slice(threshold);
    const tPubkeys = pubkeys.slice(0, threshold);
    const restPubkeys = pubkeys.slice(threshold);

    const r = genR(); // Use imported genR
    console.log("[getKAndSecretShares] Generated r:", r.toString());

    const [k_bigint, alphas_hex] = await getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys);

    const g1r_hex = getG1R(r); // Use imported getG1R
    const g2r_hex = getG2R(r); // Use imported getG2R

    console.log("[getKAndSecretShares] k:", k_bigint.toString());
    console.log("[getKAndSecretShares] g1r:", g1r_hex);
    console.log("[getKAndSecretShares] g2r:", g2r_hex);
    console.log("[getKAndSecretShares] alphas:", alphas_hex);

    return [k_bigint, g1r_hex, g2r_hex, alphas_hex];
}

/**
 * Generates a participant's share for submission (si = g1r * sk).
 * This might need adjustment based on what the contract expects.
 * @param {string} g1r_hex Hex string of the G1 point g1^r.
 * @param {bigint | string} privateKey The participant's private key (BigInt or hex string).
 * @returns {string} The hex representation of the calculated share point (si * G1).
 * @throws {Error} If inputs are invalid.
 */
export function generateShares(g1r_hex, privateKey) {
    let bigIntPrivateKey;
    try {
    if (typeof privateKey === 'bigint') {
        bigIntPrivateKey = privateKey;
    } else if (typeof privateKey === 'string') {
            bigIntPrivateKey = stringToBigInt(privateKey);
        } else {
            throw new Error(`Invalid private key type: ${typeof privateKey}`);
        }
    } catch (e) {
        console.error("Invalid private key format for BigInt conversion:", privateKey, e);
        throw new Error(`Invalid private key format: ${e.message}`);
    }

    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);

    try {
        const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
        const resultPoint = g1r_point.multiply(modBigIntPrivateKey);
        return resultPoint.toHex();
    } catch (e) {
        console.error("Error during share generation (point operation):", e);
        throw new Error(`Failed to generate share from g1r ${g1r_hex}: ${e.message}`);
    }
}

/**
 * Verifies if a generated share matches public key and g2r using pairings.
 * e(sharePoint, G2.Base) === e(publicKeyPoint, g2rPoint)
 * @param {string} share_hex Hex string of the calculated share point (G1).
 * @param {string} publicKey_hex Hex string of the participant's public key (G1).
 * @param {string} g2r_hex Hex string of the G2 point g2^r.
 * @returns {boolean} True if the pairing check passes, false otherwise.
 */
export function verifyShares(share_hex, publicKey_hex, g2r_hex) {
    try {
        const shareAffine = bls12_381.G1.fromHex(share_hex); 
        const publicKeyAffine = bls12_381.G1.fromHex(publicKey_hex);
        const g2Base = bls12_381.G2.ProjectivePoint.BASE.toAffine(); 
        const g2rAffine = bls12_381.G2.fromHex(g2r_hex);

        const pairing1 = bls12_381.pairing(shareAffine, g2Base);
        const pairing2 = bls12_381.pairing(publicKeyAffine, g2rAffine);

        console.log("verifyShares Pairing 1 (e(share, G2.Base)):", pairing1.toString(16));
        console.log("verifyShares Pairing 2 (e(pk, g2r)):", pairing2.toString(16));

        return pairing1.equals(pairing2);

    } catch (e) {
        console.error("Error during share verification:", e);
        return false; // Verification fails on error
    }
}

/**
 * Reconstructs the ephemeral AES key 'k' from shares using Lagrange interpolation.
 * Handles XORing with alphas for shares from participants with index > threshold.
 * @param {(number|string|bigint)[]} indexes Array of participant indexes (1-based).
 * @param {(string|bigint)[]} shares Array of submitted shares (corresponding to indexes).
 * @param {string[]} alphas Array of alpha values (hex strings, used for indexes > threshold).
 * @param {number|string|bigint} threshold The minimum number of shares required (t).
 * @returns {Promise<CryptoKey>} The reconstructed AES CryptoKey derived from k.
 * @throws {Error} If inputs are invalid or reconstruction fails.
 */
export async function recomputeKey(indexes, shares, alphas, threshold) {
    console.log("--- recomputeKey START ---");
    console.log("Input Indexes:", indexes);
    console.log("Input Shares:", shares);
    console.log("Input Alphas:", alphas);
    console.log("Input Threshold:", threshold);

    if (!Array.isArray(indexes) || !Array.isArray(shares) || !Array.isArray(alphas)) {
        throw new Error("Inputs indexes, shares, and alphas must be arrays.");
    }
    if (indexes.length !== shares.length) {
        throw new Error(`Index array length (${indexes.length}) does not match share array length (${shares.length}).`);
    }

    let thresholdNum;
    try {
         thresholdNum = Number(BigInt(threshold)); // Convert threshold robustly
         if (isNaN(thresholdNum) || thresholdNum <= 0) throw new Error("Threshold must be positive number");
    } catch(e) {
        throw new Error(`Invalid threshold value: ${threshold}, Error: ${e.message}`);
    }

    if (indexes.length < thresholdNum) {
        throw new Error(`Insufficient shares provided (${indexes.length}) to meet threshold (${thresholdNum}) for reconstruction.`);
    }

    // Process only the first thresholdNum shares needed for reconstruction
    const indexesForBasis = [];
    const valuesForInterpolation = [];
    console.log(`Processing first ${thresholdNum} shares/indexes for interpolation...`);

    for (let i = 0; i < thresholdNum; i++) {
        let currentIndex, currentShare;
        try {
            currentIndex = BigInt(indexes[i]);
            // Use stringToBigInt for robust share conversion
            currentShare = stringToBigInt(shares[i]);
            indexesForBasis.push(currentIndex);
        } catch (e) {
            console.error(`Failed to process index/share pair at i=${i}: Index=${indexes[i]}, Share=${shares[i]}`, e);
            throw new Error(`Invalid index or share format at position ${i}: ${e.message}`);
        }

        console.log(`  [i=${i}] Holder Index: ${currentIndex}`);

        // Determine the value used for Lagrange interpolation
        // Indexes are 1-based
        if (currentIndex <= BigInt(thresholdNum)) {
            console.log(`    Index <= threshold. Using raw share: ${currentShare}`);
            valuesForInterpolation.push(currentShare);
        } else {
            console.log(`    Index > threshold. Using share XOR alpha.`);
            // Calculate the correct index into the `alphas` array.
            // Alphas correspond to original indexes > thresholdNum.
            // Example: threshold=3. Indexes 1,2,3 use shares. Index 4 uses alpha[0], Index 5 uses alpha[1].
            // alphaIndex = currentIndex - thresholdNum - 1
            const alphaIndex = Number(currentIndex - BigInt(thresholdNum) - BigInt(1));

            if (alphaIndex < 0 || alphaIndex >= alphas.length || typeof alphas[alphaIndex] !== 'string') {
                console.error(`    Invalid alpha access: alphaIndex=${alphaIndex}, alphas.length=${alphas.length}, currentIndex=${currentIndex}, thresholdNum=${thresholdNum}`);
                throw new Error(`Invalid alpha index (${alphaIndex}) or alpha value format for index ${currentIndex}`);
            }

            let alphaBigInt;
            try {
                alphaBigInt = stringToBigInt(alphas[alphaIndex]); // Use robust conversion
            } catch (e) {
                 throw new Error(`Invalid alpha format at index ${alphaIndex}: ${alphas[alphaIndex]}, Error: ${e.message}`);
            }

            console.log(`    Share: ${currentShare}`);
            console.log(`    Alpha Hex: ${alphas[alphaIndex]}`);
            console.log(`    Alpha BigInt: ${alphaBigInt}`);

            // Perform XOR term calculation (ensure 32 bytes for both)
            const shareBytes = bigIntTo32Bytes(currentShare);
            const alphaBytes = bigIntTo32Bytes(alphaBigInt);

            if (shareBytes.length !== 32 || alphaBytes.length !== 32) {
                 console.error("Byte conversion did not result in 32 bytes.", {shareLen: shareBytes.length, alphaLen: alphaBytes.length});
                 throw new Error("Internal error during byte conversion for XOR.");
             }

            const xorResultBytes = new Uint8Array(32);
            for (let j = 0; j < 32; j++) { 
                xorResultBytes[j] = shareBytes[j] ^ alphaBytes[j];
            }
            const term = BigInt('0x' + bytesToHex(xorResultBytes)); // Convert result back to BigInt

            console.log(`    Share Bytes (Hex): ${bytesToHex(shareBytes)}`);
            console.log(`    Alpha Bytes (Hex): ${bytesToHex(alphaBytes)}`);
            console.log(`    XOR Result Bytes (Hex): ${bytesToHex(xorResultBytes)}`);
            console.log(`    XOR Term (BigInt): ${term}`);
            valuesForInterpolation.push(term); // Use the XORed term
        }
    }

    console.log("Basis Indices for Lagrange:", indexesForBasis.map(v=>v.toString()));
    console.log("Values for Interpolation:", valuesForInterpolation.map(v=>v.toString()));

    // Calculate basis using the collected indices (only first thresholdNum)
    const basis = lagrangeBasis(indexesForBasis, BigInt(0)); // Calculate L_i(0)
    console.log("Lagrange Basis L_i(0):", basis.map(v=>v.toString()));

    if (basis.length !== valuesForInterpolation.length || basis.length !== thresholdNum) {
       console.error("Basis/Values/Threshold length mismatch!", {basisLen: basis.length, valuesLen: valuesForInterpolation.length, threshold: thresholdNum});
       throw new Error("Internal error: Basis/Values/Threshold length mismatch during Lagrange calculation.");
    }

    // Perform interpolation: k = Sum(value_i * L_i(0))
    const k = lagrangeInterpolate(basis, valuesForInterpolation);
    console.log("Recomputed k (BigInt):", k.toString()); 
    console.log("--- recomputeKey END ---");

    // Derive the AES CryptoKey from the reconstructed BigInt k
    const { importBigIntAsCryptoKey } = await import('./aesUtils.js'); // Dynamic import
    const key = await importBigIntAsCryptoKey(k);

    return key;
}

/**
 * Calculates the ephemeral symmetric key k and blinding factors alphas.
 * k = P(0), where P(x) is the polynomial interpolated from the first t shares.
 * alpha_i = P(i) XOR S(i), where P(i) is interpolated value, S(i) is actual share value for i > t.
 * @param {bigint} r The random scalar used for pk^r calculations.
 * @param {bigint[]} tIndexes Indexes [1...t].
 * @param {string[]} tPubkeys Public keys corresponding to tIndexes.
 * @param {bigint[]} restIndexes Indexes [t+1...n].
 * @param {string[]} restPubkeys Public keys corresponding to restIndexes.
 * @returns {Promise<[bigint, string[]]>} Array [k (BigInt), alphas (hex strings)].
 */
export async function getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys) {
    console.log("--- getKAndAlphas START ---");
    console.log("Input r:", r.toString());
    console.log("Input tIndexes:", tIndexes.map(v=>v.toString()));
    console.log("Input tPubkeys:", tPubkeys);
    console.log("Input restIndexes:", restIndexes.map(v=>v.toString()));
    console.log("Input restPubkeys:", restPubkeys);

    // Calculate shares S(i) = pointToBigint(pk_i * r) for the first t participants
    const tShares = tPubkeys.map((pubkey) => {
        const pkrPoint = computePkRValue(pubkey, r); // Returns G1 point
        return pointToBigint(pkrPoint); // Converts point hex -> BigInt mod N
    });
    console.log("Calculated tShares (S(1)...S(t)):", tShares.map(v=>v.toString()));

    // Interpolate P(0) to find k using the first t shares and their indexes
    // Basis = L_i(0) for i in tIndexes
    const basisAtZero = lagrangeBasis(tIndexes, 0n);
    // k = Sum(tShares[i] * basisAtZero[i])
    const k = lagrangeInterpolate(basisAtZero, tShares);
    console.log("Original k (P(0)) calculated:", k.toString());

    // Calculate shares S(i) for the remaining participants (i > t)
    const restShares = restPubkeys.map((pubkey) => {
        const pkrPoint = computePkRValue(pubkey, r);
        return pointToBigint(pkrPoint);
    });
    console.log("Calculated restShares (S(t+1)...S(n)):", restShares.map(v=>v.toString()));

    // Calculate alphas for each remaining participant
    const alphas = [];
    console.log("Calculating alphas...");
    for (let counter = 0; counter < restIndexes.length; counter++) {
        const currentIndex = restIndexes[counter]; // Index i > t
        console.log(`  Alpha calculation for index ${currentIndex}:`);

        // Interpolate P(i) using the first t shares/indexes evaluated at currentIndex
        // BasisAtI = L_j(currentIndex) for j in tIndexes
        const basisAtI = lagrangeBasis(tIndexes, currentIndex);
        // P(i) = Sum(tShares[j] * basisAtI[j])
        const interpolatedPointVal = lagrangeInterpolate(basisAtI, tShares);
        console.log(`    Interpolated P(${currentIndex}): ${interpolatedPointVal.toString()}`);

        // Actual share S(i) for this index
        const actualShareVal = restShares[counter];
        console.log(`    Actual Share S(${currentIndex}): ${actualShareVal.toString()}`);

        // Calculate alpha_i = P(i) XOR S(i)
        // Convert both P(i) and S(i) to 32-byte arrays for XOR
        const interpolatedBytes = bigIntTo32Bytes(interpolatedPointVal);
        const actualShareBytes = bigIntTo32Bytes(actualShareVal);

        if (interpolatedBytes.length !== 32 || actualShareBytes.length !== 32) {
            console.error("Byte conversion error during alpha generation.", {idx: currentIndex});
            throw new Error("Internal error: byte conversion for alpha XOR failed.");
        }
        console.log(`    P(${currentIndex}) bytes (Hex): ${bytesToHex(interpolatedBytes)}`);
        console.log(`    S(${currentIndex}) bytes (Hex): ${bytesToHex(actualShareBytes)}`);

        const xorResultBytes = new Uint8Array(32);
        for (let j = 0; j < 32; j++) {
            xorResultBytes[j] = interpolatedBytes[j] ^ actualShareBytes[j];
        }
        const alphaHex = bytesToHex(xorResultBytes);
        console.log(`    XOR Result (Alpha) Bytes (Hex): ${alphaHex}`);

        alphas.push(alphaHex); // Store alpha as hex string
    }

    console.log("Final generated alphas (Hex Strings):", alphas);
    console.log("--- getKAndAlphas END ---");

    // Return k (BigInt) and alphas (array of hex strings)
    return [k, alphas];
}


// --- PLACEHOLDERS / TODOs for missing crypto logic ---

/**
 * TODO: Implement vote encoding.
 * Converts a vote option (e.g., index, string) into an elliptic curve point.
 * The exact mapping depends on the cryptographic scheme.
 * @param {any} option The vote option.
 * @returns {object} The corresponding G1 ProjectivePoint object.
 */
export function encodeVoteToPoint(option) {
    console.warn("TODO: Implement encodeVoteToPoint based on the specific scheme!");
    // Placeholder: Map index i to (i+1) * G1.Base
    const optionIndex = Number(option);
    if (isNaN(optionIndex) || optionIndex < 0) {
        throw new Error(`Invalid option for placeholder encoding: ${option}`);
    }
    const scalar = BigInt(optionIndex + 1); // Map 0 to 1*G1, 1 to 2*G1 etc.
    return bls12_381.G1.ProjectivePoint.BASE.multiply(scalar);
}

/**
 * TODO: Implement vote decoding.
 * Converts a decrypted elliptic curve point back to the original vote option.
 * The exact mapping depends on the cryptographic scheme.
 * @param {object} point The G1 ProjectivePoint object.
 * @returns {any} The decoded vote option (e.g., index, string).
 */
export function decodePointToVote(point) {
    console.warn("TODO: Implement decodePointToVote based on the specific scheme!");
    // Placeholder: Inverse of index i to (i+1) * G1.Base
    // This requires finding discrete log or comparing against precomputed points.
    // For simplicity, returning point hex as placeholder.
    if (!point || typeof point.toHex !== 'function') {
         throw new Error("Invalid point object for placeholder decoding.");
    }
    // This is NOT the real decoded vote, just a placeholder.
    // A real implementation would likely involve comparing point against
    // G1.Base * 1, G1.Base * 2, etc., up to the number of options.
    return point.toHex();
}

/**
 * TODO: Implement decryption share calculation for contract submission.
 * This likely involves sk * G2 or alpha_i * sk * G2.
 * @param {bigint} privateKey User's private key.
 * @param {bigint | string | null} alpha Alpha value (BigInt, hex string, or null) if index > t, null otherwise.
 * @returns {Promise<object>} Object containing hex coordinates { x, y } of the G2 share point.
 */
export async function calculateDecryptionShareForSubmission(privateKey, alpha = null) {
    if (typeof privateKey !== 'bigint') {
        throw new Error("Private key must be a BigInt.");
    }

    let scalar = privateKey; // Default to sk if alpha is not provided or not needed

    // If alpha is provided, calculate scalar = sk * alpha mod N
    if (alpha !== null) {
        let alphaBigInt;
        try {
            if (typeof alpha === 'bigint') {
                alphaBigInt = alpha;
            } else if (typeof alpha === 'string') {
                alphaBigInt = stringToBigInt(alpha); // Use conversion utility
            } else {
                throw new Error(`Invalid alpha type: ${typeof alpha}`);
            }
            console.log(`Calculating share with alpha: 0x${alphaBigInt.toString(16)}`);
            // scalar = (privateKey * alphaBigInt) % FIELD_ORDER;
            scalar = mod(privateKey * alphaBigInt, FIELD_ORDER); // Use mod helper
        } catch (e) {
            console.error("Error processing alpha value:", alpha, e);
            throw new Error(`Invalid alpha value format: ${e.message}`);
        }
    } else {
        console.log("Calculating share without alpha (sk * G2).");
        // scalar remains privateKey
    }

    // Calculate the final share point on G2: scalar * G2.Base
    const finalSharePoint = bls12_381.G2.ProjectivePoint.BASE.multiply(scalar);

    // Contract likely expects affine coordinates
    const affinePoint = finalSharePoint.toAffine();

    // Format the Fp2 coordinates (c0, c1) into hex strings array [c0_hex, c1_hex]
    // as expected by the Solidity ABI for G2Point struct
    const formatFq2 = (fq2) => {
        if (!fq2 || typeof fq2.c0 !== 'bigint' || typeof fq2.c1 !== 'bigint') {
            console.error("Invalid Fq2 structure detected:", fq2);
            throw new Error("Invalid Fq2 structure for formatting");
        }
        // Return hex strings with "0x" prefix
        return ['0x' + fq2.c0.toString(16), '0x' + fq2.c1.toString(16)];
    };

    try {
        const xFormatted = formatFq2(affinePoint.x);
        const yFormatted = formatFq2(affinePoint.y);
        // Return the structure matching the Solidity G2Point struct
        return {
            x: xFormatted, // [x.c0 hex, x.c1 hex]
            y: yFormatted  // [y.c0 hex, y.c1 hex]
        };
    } catch (e) {
         console.error("Error formatting G2 point coordinates:", e);
         throw new Error(`Failed to format G2 point coordinates: ${e.message}`);
    }
}

/**
 * TODO: Implement the actual decryption of a single vote.
 * This depends heavily on the encryption scheme (ElGamal variant?).
 * It likely involves pairing operations.
 * @param {object} c1 Encrypted vote component 1 (G1 point).
 * @param {object} c2 Encrypted vote component 2 (G1 point).
 * @param {object} reconstructedKey Share or key reconstructed from shares (e.g., sk*G2 point?).
 * @param {object} params Other necessary params (e.g., g1r, aggregate pk?).
 * @returns {Promise<object>} The decrypted G1 point representing the vote.
 */
export async function decryptVote(c1, c2, reconstructedKey, params) {
     console.warn("TODO: Implement actual decryptVote logic using pairings!");
     // Placeholder: return c2 - this is INCORRECT
     if (!c1 || typeof c1.subtract !== 'function') { // Check c1 instead of c2 for return
          throw new Error("Invalid c1 point for placeholder decryption.");
     }
     // Returning c1 as a dummy placeholder to avoid errors, REAL logic needed.
     return c1;
}

/**
 * TODO: Implement Nullifier Calculation.
 * Typically hash(secret_key, session_id or domain_separator).
 * @param {bigint | string} privateKey User's private key.
 * @param {string | number} sessionId Identifier for the vote session.
 * @returns {Promise<string>} The calculated nullifier hash (hex string).
 */
export async function calculateNullifier(privateKey, sessionId) {
    console.warn("TODO: Implement calculateNullifier!");
    // Placeholder implementation using SHA-256
    const skHex = typeof privateKey === 'bigint' ? privateKey.toString(16) : stringToBigInt(privateKey).toString(16); // Ensure BigInt then hex
    const sessionStr = String(sessionId);
    const dataToHash = new TextEncoder().encode(skHex + sessionStr); // Simple concatenation
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataToHash);
    return bytesToHex(new Uint8Array(hashBuffer)); // Use imported conversion util
}

/**
 * TODO: Implement ZK-SNARK Proof Generation.
 * Requires circuit definition, proving key, and ZKP library (e.g., snarkjs).
 * @param {object} inputs Inputs required by the ZK circuit (e.g., sk, vote, merkle proof, nullifier...).
 * @param {ArrayBuffer} wasmBuffer Circuit WASM code.
 * @param {ArrayBuffer} provingKey ZKey file.
 * @returns {Promise<object>} The generated proof and public signals.
 */
export async function generateZkProof(inputs, wasmBuffer, provingKey) {
     console.warn("TODO: Implement generateZkProof using snarkjs or similar!");
     // Placeholder:
     return {
         proof: { /* proof structure */ pi_a: [], pi_b: [], pi_c: [], protocol: "groth16" },
         publicSignals: [ /* public signals array */ ]
     };
}

/**
 * TODO: Implement calculation of the value submitted via submitDecryptionValue.
 * This might involve decrypting the stored BLS key using a password.
 * @param {string} password User's password.
 * @param {string} encryptedSkHex Encrypted BLS secret key (hex).
 * @param {Uint8Array} salt Salt used during key derivation.
 * @returns {Promise<bigint>} The decrypted BLS secret key as a BigInt. (Assumes contract expects the raw SK).
 */
export async function calculateDecryptionValue(password, encryptedSkHex, salt) {
    // Placeholder:
    // 1. Derive AES key from password
    // 2. Decrypt BLS sk
    // 3. Return decrypted sk (or whatever the contract expects)
    const { deriveKeyFromPassword, AESDecrypt } = await import('./aesUtils.js');
    try {
         const aesKey = await deriveKeyFromPassword(password, salt);
         const decryptedSkHex = await AESDecrypt(encryptedSkHex, aesKey);
         console.log("Decrypted SK (hex) in calculateDecryptionValue:", decryptedSkHex);

         // Convert the decrypted hex string to a BigInt
         const decryptedSkBigInt = stringToBigInt(decryptedSkHex); // Use conversion utility

         // ASSUMPTION: The contract's submitDecryptionValue function expects the raw private key (sk) as a uint256.
         // If it expects something else (e.g., a derived value, a share), this needs modification.
         console.log("Returning decrypted SK as BigInt:", decryptedSkBigInt.toString());
         return decryptedSkBigInt;

    } catch (error) {
        console.error("Failed in calculateDecryptionValue:", error);
        throw error; // Re-throw to be handled by caller
    }
}

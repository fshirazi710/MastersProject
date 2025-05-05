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

/**
 * Encodes a vote option string to a G1 point using the standard hash-to-curve function.
 * @param {string} option The vote option string.
 * @returns {string} The hex string representation of the G1 point.
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
        console.log(`[encodeVoteToPoint] Mapped "${option}" to G1 point: ${point.toHex()}`);
        return point.toHex();
    } catch (e) {
        console.error(`Error hashing vote option "${option}" to curve:`, e);
        throw new Error(`Failed to encode vote option "${option}": ${e.message}`);
    }
}

/**
 * Decodes a G1 point (hex string) back to a vote option string by comparing it
 * against the encodings of possible options.
 * @param {string} pointHex The hex string of the decrypted G1 point.
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
            const encodedOptionHex = encodeVoteToPoint(option); // Reuse the encoding function
            if (encodedOptionHex === pointHex) {
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
 * TODO: Implement calculation of the G2 share point required by VoteSession.submitShares.
 * This likely involves the participant's private key (sk) and potentially alpha_i.
 * Currently, this acts as a wrapper around `generateShares` which calculates g1r * sk (G1 point).
 * This might need to change based on the exact requirements of the off-chain decryption process
 * and what `VoteSession.submitShares` expects as `_shareData`.
 * @param {bigint | string} privateKey The participant's private key (BigInt or hex string).
 * @param {string} g1r_hex Hex string of the G1 point g1^r (needed by current `generateShares`).
 * @param {any} alpha Optional alpha value if needed for the specific scheme (currently unused).
 * @returns {string} The hex representation of the calculated share point (currently G1: g1r * sk).
 */
export async function calculateDecryptionShareForSubmission(privateKey, g1r_hex, alpha = null) {
    console.warn("[calculateDecryptionShareForSubmission] - Current implementation calculates G1 point (g1r * sk) via generateShares. Verify if this matches the expected `_shareData` for submitShares and off-chain decryption.");
    if (!g1r_hex) {
        throw new Error("g1r_hex parameter is required for the current implementation.");
    }
    // Note: Alpha is currently ignored, add logic if scheme requires alpha * sk * G2 or similar.
    if (alpha) {
        console.warn("[calculateDecryptionShareForSubmission] - Alpha parameter provided but ignored by current implementation.");
    }
    try {
        // Delegate to the existing generateShares function which computes G1 point g1r*sk
        const shareHex = generateShares(g1r_hex, privateKey);
        console.log("[calculateDecryptionShareForSubmission] Calculated share (g1r*sk):", shareHex);
        return shareHex;
    } catch (e) {
        console.error("Error in calculateDecryptionShareForSubmission calling generateShares:", e);
        throw new Error(`Failed to calculate decryption share: ${e.message}`);
    }
}

/**
 * TODO: Implement decryption of the vote ciphertext using the reconstructed key.
 * Assumes AES-GCM symmetric encryption where the key 'k' was derived via threshold mechanism.
 * @param {string} encryptedVoteHex Hex string containing the IV prepended to the ciphertext.
 * @param {CryptoKey} reconstructedKey The AES-GCM CryptoKey derived from the reconstructed BigInt k.
 * @param {any} params Optional parameters (e.g., g1r, g2r) - Currently unused for AES decryption.
 * @returns {Promise<string>} The decrypted vote string.
 * @throws {Error} If decryption fails.
 */
export async function decryptVote(encryptedVoteHex, reconstructedKey, params = null) {
    console.log("[decryptVote] Attempting to decrypt vote...");
    if (typeof encryptedVoteHex !== 'string' || !encryptedVoteHex.startsWith('0x') || encryptedVoteHex.length < 48) { // Min length: 0x + 24 hex (IV) + 2 hex (tag?)
         throw new Error("Invalid encryptedVoteHex provided. Must be a hex string containing IV + ciphertext.");
    }
    if (!(reconstructedKey instanceof CryptoKey)) {
         throw new Error("Invalid reconstructedKey provided. Must be a CryptoKey.");
    }
    if (params) {
        console.warn("[decryptVote] 'params' argument provided but ignored for AES decryption.");
    }

    try {
        // Dynamically import AESDecrypt from aesUtils.js
        const { AESDecrypt } = await import('./aesUtils.js');
        
        console.log(`  Input Encrypted Hex (IV+Cipher): ${encryptedVoteHex.substring(0,40)}...`);
        console.log(`  Using reconstructed key:`, reconstructedKey); 

        // AESDecrypt handles splitting the IV and ciphertext
        const decryptedString = await AESDecrypt(encryptedVoteHex, reconstructedKey);
        
        console.log("[decryptVote] Decryption successful. Result:", decryptedString);
        return decryptedString;
    } catch (error) {
        console.error("Error during AES decryption in decryptVote:", error);
        throw new Error(`Vote decryption failed: ${error.message}`);
    }
}

/**
 * TODO: Implement Nullifier Calculation.
 * Calculates a unique identifier for a user in a specific session without revealing their private key.
 * Typically hash(secret_key, session_id or domain_separator).
 * @param {bigint} privateKey User's private key as a BigInt.
 * @param {string | number} sessionId Identifier for the vote session.
 * @returns {Promise<string>} The calculated nullifier hash (hex string, prefixed with 0x).
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
        
        // Use domain separation
        const dataToHashString = `nullifier:${skHex}:${sessionStr}`;
        const dataToHashBytes = new TextEncoder().encode(dataToHashString);

        // Use Web Crypto API for SHA-256
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataToHashBytes);
        
        // Convert hash buffer to hex string
        const { bytesToHex } = await import('./conversionUtils.js'); // Dynamic import
        const nullifierHex = bytesToHex(new Uint8Array(hashBuffer));

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
    // Example structure (replace with actual logic):
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
 * TODO: Implement calculation of the final decryption value (v_i).
 * This is the value submitted to `VoteSession.submitDecryptionValue`.
 * It should be derived from the user's private key but SHOULD NOT expose the key itself.
 * Current implementation calculates SHA256(sk) as bytes32.
 * @param {string} password User's password to decrypt the stored private key.
 * @param {string} encryptedSkHex Hex string of the AES-encrypted BLS private key from local storage.
 * @param {string} saltHex Hex string of the salt used during key encryption.
 * @returns {Promise<string>} The calculated decryption value (bytes32 hex string, prefixed with 0x).
 */
export async function calculateDecryptionValue(password, encryptedSkHex, salt) {
    console.log("[calculateDecryptionValue] Starting...");
    if (!password || !encryptedSkHex || !salt) {
        throw new Error("Password, encryptedSkHex, and salt are required.");
    }

    try {
        // Dynamically import utilities
        const { hexToBytes, bytesToHex } = await import('./conversionUtils.js');
        const { deriveKeyFromPassword, AESDecrypt } = await import('./aesUtils.js');

        const saltBytes = hexToBytes(salt);
        
        console.log("Deriving key from password...");
        const aesKey = await deriveKeyFromPassword(password, saltBytes);
        
        console.log("Decrypting stored BLS private key...");
        const decryptedSkHex = await AESDecrypt(encryptedSkHex, aesKey);
        console.log("BLS Private Key decrypted (hex):", decryptedSkHex.substring(0, 10) + "...");

        // --- Calculate the value to submit --- 
        // We should NOT submit the raw private key. Submit its hash (bytes32).
        console.log("Hashing the decrypted private key (SHA-256) to get submission value...");

        // Convert hex private key to bytes
        const skBytes = hexToBytes(decryptedSkHex);

        // Hash the private key bytes using SHA-256
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', skBytes);
        
        // The result is already 32 bytes (bytes32)
        const valueBytes = new Uint8Array(hashBuffer);
        const valueHex = bytesToHex(valueBytes);

        console.log(`[calculateDecryptionValue] Calculated value (SHA256(sk)): 0x${valueHex}`);

        // Return the bytes32 hash as a hex string (prefixed with 0x)
        return '0x' + valueHex;

    } catch (error) {
        console.error("Failed in calculateDecryptionValue:", error);
        // Add more context to the error potentially
        if (error.message.includes("decryption failed")) {
             throw new Error("Failed to decrypt private key. Check your password.");
        }
        throw error; // Re-throw other errors
    }
}

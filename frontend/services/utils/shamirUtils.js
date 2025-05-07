import { mod } from "@noble/curves/abstract/modular";
import { bls12_381 } from "@noble/curves/bls12-381"; // For bls12_381.utils.randomPrivateKey
import { Buffer } from "buffer"; // For Buffer.from in random coefficient generation if needed, or direct BigInt

// Import Lagrange utilities from lagrangeUtils.js
import {
    lagrangeBasis,
    lagrangeInterpolate
} from './lagrangeUtils.js';

// Import AES key import utility
// Assuming aesUtils.js is in the same directory
import { importBigIntAsCryptoKey } from './aesUtils.js';

// Import shared constants
import { FIELD_ORDER } from './constants.js';

/**
 * Generates a secret scalar k and distributes it among n participants using (t,n)-Shamir's Secret Sharing.
 * Any t shares can be used to reconstruct k.
 * @param {number} threshold The minimum number of shares (t) required to reconstruct the secret.
 * @param {number} totalParticipants The total number of shares (n) to generate.
 * @param {bigint} [fieldOrder=FIELD_ORDER] The order of the finite field for calculations.
 * @returns {{k: bigint, shares: Array<{index: number, value: bigint}>}} An object containing the secret k and an array of shares.
 * @throws {Error} If threshold is invalid.
 */
export function getKAndSecretShares(threshold, totalParticipants, fieldOrder = FIELD_ORDER) {
    if (typeof threshold !== 'number' || threshold <= 0 || typeof totalParticipants !== 'number' || totalParticipants < threshold) {
        throw new Error("Invalid threshold or totalParticipants. Ensure threshold > 0 and totalParticipants >= threshold.");
    }

    // 1. Generate the random secret k (scalar)
    // bls12_381.utils.randomPrivateKey() returns a Uint8Array of 32 bytes.
    const k_bytes = bls12_381.utils.randomPrivateKey(); 
    const k = mod(BigInt("0x" + Buffer.from(k_bytes).toString("hex")), fieldOrder);

    // 2. Generate threshold - 1 random coefficients for the polynomial P(x)
    // P(x) = a_{t-1}x^{t-1} + ... + a_1x + k  (where k is a_0)
    const coefficients = [k]; // P(0) = k
    for (let i = 0; i < threshold - 1; i++) {
        const coeff_bytes = bls12_381.utils.randomPrivateKey();
        coefficients.push(mod(BigInt("0x" + Buffer.from(coeff_bytes).toString("hex")), fieldOrder));
    }

    // 3. For each participant j from 1 to totalParticipants, calculate their share s_j = P(j)
    const shares = [];
    for (let j = 1; j <= totalParticipants; j++) {
        const participantIndex = BigInt(j); // x-coordinate for the share
        let shareValue = BigInt(0);
        // Evaluate polynomial P(participantIndex) = sum_{i=0}^{threshold-1} (coefficients[i] * participantIndex^i)
        for (let i = 0; i < threshold; i++) { // Iterate up to threshold (degree t-1 polynomial has t coefficients)
            const term = mod(coefficients[i] * (participantIndex ** BigInt(i)), fieldOrder);
            shareValue = mod(shareValue + term, fieldOrder);
        }
        shares.push({ index: j, value: shareValue }); // Store 1-based index for clarity
    }

    console.log("[getKAndSecretShares] Generated k:", k.toString());
    console.log("[getKAndSecretShares] Generated shares:", shares.map(s => ({index: s.index, value: s.value.toString()})));

    return { k: k, shares: shares };
}

/**
 * Reconstructs the secret scalar k from a set of Shamir's shares using Lagrange interpolation,
 * and then derives an AES CryptoKey from k.
 * @param {Array<{index: number, value: bigint}>} participantShares An array of share objects, where 'index' is the x-coordinate.
 * @param {number} threshold The minimum number of shares (t) required for reconstruction.
 * @param {bigint} [fieldOrder=FIELD_ORDER] The order of the finite field for calculations.
 * @returns {Promise<CryptoKey>} The reconstructed AES CryptoKey derived from k.
 * @throws {Error} If inputs are invalid or reconstruction fails.
 */
export async function recomputeKey(participantShares, threshold, fieldOrder = FIELD_ORDER) {
    // Perform initial input validation first
    if (!Array.isArray(participantShares)) {
        throw new Error("Input participantShares must be an array.");
    }
    if (typeof threshold !== 'number' || threshold <= 0) {
        throw new Error("Threshold must be a positive number.");
    }
    // This check might be slightly redundant if the next one catches it, but good for clarity
    if (participantShares.length === 0 && threshold > 0) { // Can't reconstruct from no shares if threshold > 0
        throw new Error("Input participantShares cannot be empty if threshold is positive.");
    }
    if (participantShares.length < threshold) {
        throw new Error(`Insufficient shares provided (${participantShares.length}) to meet threshold (${threshold}) for reconstruction.`);
    }

    // Now that basic array/threshold checks passed, we can log
    console.log("[recomputeKey - Shamir's] Starting reconstruction...");
    console.log("Input Participant Shares:", participantShares.map(s => {
        // Basic check for share structure before logging to prevent further errors
        if (typeof s !== 'object' || s === null || typeof s.index === 'undefined' || typeof s.value === 'undefined') {
            return { index: 'invalid_share', value: 'invalid_share' }; // Avoid crashing map
        }
        return { index: s.index, value: String(s.value) }; // Convert value to string for logging
    }));
    console.log("Input Threshold:", threshold);

    // Ensure we use exactly 'threshold' distinct shares for reconstruction
    // Taking the first 'threshold' shares. Caller should ensure these are distinct and valid.
    const sharesForReconstruction = participantShares.slice(0, threshold);

    // The 'indexes' for Lagrange basis are the x-coordinates of the shares
    const indexesForBasis = sharesForReconstruction.map(s => {
        if (typeof s.index !== 'number' && typeof s.index !== 'bigint') throw new Error ('Share index must be number or bigint');
        return BigInt(s.index);
    });
    const valuesForInterpolation = sharesForReconstruction.map(s => {
        if (typeof s.value !== 'bigint') throw new Error('Share value must be bigint');
        return s.value;
    });

    console.log("[recomputeKey - Shamir's] Using shares for interpolation:", sharesForReconstruction.map(s => ({index: s.index, value: s.value.toString() })));
    console.log("[recomputeKey - Shamir's] Basis Indices for Lagrange:", indexesForBasis.map(v => v.toString()));
    console.log("[recomputeKey - Shamir's] Values for Interpolation:", valuesForInterpolation.map(v => v.toString()));

    // Calculate basis L_i(0) for each share's index. We evaluate at x=0 to find the constant term of the polynomial (the secret k).
    const basisCoefficients = lagrangeBasis(indexesForBasis, BigInt(0)); // Pass fieldOrder if lagrangeUtils doesn't default to it
    console.log("[recomputeKey - Shamir's] Lagrange Basis L_i(0):", basisCoefficients.map(v => v.toString()));

    if (basisCoefficients.length !== valuesForInterpolation.length) { 
        throw new Error("Internal error: Basis and values length mismatch during Lagrange calculation.");
    }

    // Perform interpolation: k = Sum(value_i * L_i(0)) mod fieldOrder
    const k_reconstructed_bigint = lagrangeInterpolate(basisCoefficients, valuesForInterpolation); // Pass fieldOrder if lagrangeUtils doesn't default
    console.log("[recomputeKey - Shamir's] Recomputed k (BigInt):", k_reconstructed_bigint.toString());
    
    // Derive the AES CryptoKey from the reconstructed BigInt k
    try {
        const aesKey = await importBigIntAsCryptoKey(k_reconstructed_bigint);
        console.log("[recomputeKey - Shamir's] Successfully derived AES CryptoKey from reconstructed k.");
        return aesKey;
    } catch (error) {
        console.error("[recomputeKey - Shamir's] Error deriving AES key from reconstructed k:", error);
        throw new Error(`Failed to derive AES key: ${error.message}`);
    }
} 
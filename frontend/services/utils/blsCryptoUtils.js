import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";

// Import shared constants
import { FIELD_ORDER } from './constants.js';

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
 * Verifies if a generated share matches public key and g2r using pairings.
 * e(sharePoint, G2.Base) === e(publicKeyPoint, g2rPoint)
 * Assumes inputs are raw hex strings without "0x" prefix.
 * @param {string} share_hex Raw hex string of the calculated share point (G1).
 * @param {string} publicKey_hex Raw hex string of the participant's public key (G1).
 * @param {string} g2r_hex Raw hex string of the G2 point g2^r.
 * @returns {boolean} True if the pairing check passes, false otherwise.
 */
export function verifyShares(share_hex, publicKey_hex, g2r_hex) {
    try {
        // Noble library expects raw hex strings
        // Use ProjectivePoint.fromHex for deserialization
        const sharePoint = bls12_381.G1.ProjectivePoint.fromHex(share_hex); 
        const publicKeyPoint = bls12_381.G1.ProjectivePoint.fromHex(publicKey_hex);
        const g2Base = bls12_381.G2.ProjectivePoint.BASE; 
        const g2rPoint = bls12_381.G2.ProjectivePoint.fromHex(g2r_hex);

        // Use projective points directly for pairing
        const pairing1 = bls12_381.pairing(sharePoint, g2Base);
        const pairing2 = bls12_381.pairing(publicKeyPoint, g2rPoint);

        return bls12_381.fields.Fp12.eql(pairing1, pairing2);

    } catch (e) {
        console.error("Error during share verification:", e);
        return false; // Verification fails on error
    }
}

/**
 * Calculates a participant's decryption share for submission (share = g1r * sk).
 * This is the raw cryptographic operation. The result is typically used in `VoteSession.submitDecryptionShare()`.
 * Expects g1r_hex as a raw hex string without "0x" prefix.
 * Returns the calculated share as a raw hex string without "0x" prefix.
 * @async 
 * @param {bigint} privateKey The participant's BLS private key as a BigInt.
 * @param {string} g1r_hex Raw hex string of the G1 point (g1^r) associated with the encrypted vote.
 * @returns {Promise<string>} Raw hex representation of the calculated share point (g1^r * sk).
 * @throws {Error} If inputs are invalid or the cryptographic operation fails.
 */
export async function calculateDecryptionShareForSubmission(privateKey, g1r_hex) {
    // Validate privateKey type
    if (typeof privateKey !== 'bigint') {
        throw new Error(`[calculateDecryptionShareForSubmission] Invalid privateKey type: ${typeof privateKey}. Expected BigInt.`);
    }

    // g1r_hex validation (ensure it's a raw hex string with even length)
    if (typeof g1r_hex !== 'string' || !/^[0-9a-fA-F]+$/i.test(g1r_hex) || g1r_hex.length % 2 !== 0) { 
        console.error("[calculateDecryptionShareForSubmission] Invalid g1r_hex format:", g1r_hex);
        throw new Error('[calculateDecryptionShareForSubmission] Invalid g1r_hex format. Expected a raw hex string with even length.');
    }

    // Ensure private key is within the field order for cryptographic operations
    const modBigIntPrivateKey = mod(privateKey, FIELD_ORDER);

    try {
        // Noble library expects raw hex string
        const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
        
        const resultPoint = g1r_point.multiply(modBigIntPrivateKey);
        console.log("[calculateDecryptionShareForSubmission] Successfully calculated share.");
        // Return result as raw hex string
        return resultPoint.toHex();
    } catch (e) {
        console.error("[calculateDecryptionShareForSubmission] Error during share calculation (point operation):", e);
        // Include g1r_hex in error message, but add prefix back for potential debugging clarity if needed?
        // For now, keep it simple.
        throw new Error(`[calculateDecryptionShareForSubmission] Failed to calculate share from g1r ${g1r_hex}: ${e.message}`);
    }
} 
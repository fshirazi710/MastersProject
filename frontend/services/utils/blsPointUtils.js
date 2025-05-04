import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";

// Field order might be needed here too
const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

/**
 * Generates a random BigInt r modulo the field order.
 * Uses window.crypto for randomness.
 * @returns {bigint} A random BigInt scalar.
 */
export function genR() {
    // Use browser crypto API for secure random bytes
    const randomBytes = (size) => crypto.getRandomValues(new Uint8Array(size));
    const randBytes = randomBytes(32); // 32 bytes for ~256 bits
    const hexString = Array.from(randBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    // Convert hex to BigInt and reduce modulo FIELD_ORDER
    return mod(BigInt("0x" + hexString), FIELD_ORDER);
}

/**
 * Calculates r * G1.
 * @param {bigint} r The scalar.
 * @returns {string} The hex representation of the resulting G1 point.
 */
export function getG1R(r) {
    if (typeof r !== 'bigint') throw new Error("Scalar r must be a BigInt");
    const g1 = bls12_381.G1.ProjectivePoint.BASE;
    const result = g1.multiply(r);
    return result.toHex(); // Returns hex string directly
}

/**
 * Calculates r * G2.
 * @param {bigint} r The scalar.
 * @returns {string} The hex representation of the resulting G2 point.
 */
export function getG2R(r) {
    if (typeof r !== 'bigint') throw new Error("Scalar r must be a BigInt");
    const g2 = bls12_381.G2.ProjectivePoint.BASE;
    const result = g2.multiply(r);
    return result.toHex(); // Returns hex string directly
}

/**
 * Computes r * PK for a given public key.
 * @param {string} pubkey Hex string of the G1 public key.
 * @param {bigint} r The scalar.
 * @returns {object} The resulting G1 ProjectivePoint object.
 * @throws {Error} If the public key hex is invalid or scalar is not BigInt.
 */
export function computePkRValue(pubkey, r) {
    if (typeof pubkey !== 'string') throw new Error("Public key must be a hex string.");
    if (typeof r !== 'bigint') throw new Error("Scalar r must be a BigInt.");
    try {
        // fromHex handles optional '0x' prefix
        const pkPoint = bls12_381.G1.ProjectivePoint.fromHex(pubkey); 
        return pkPoint.multiply(r);
    } catch (e) {
        console.error(`Failed to compute Pk*r for pubkey ${pubkey}:`, e);
        throw new Error(`Invalid public key format or multiplication error: ${pubkey}`);
    }
} 
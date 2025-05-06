/**
 * @file constants.js
 * @description Shared constants used across utility modules.
 */

/**
 * The order of the BLS12-381 scalar field (fr).
 * This is used for calculations involving private keys, random scalars (like r or k for SSS),
 * and share values in Shamir's Secret Sharing, as well as in Lagrange interpolation.
 * @type {bigint}
 */
export const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

/**
 * Domain separator string for nullifier calculation.
 * Used in `cryptographyUtils.calculateNullifier` to ensure hash input uniqueness.
 * E.g., SHA256(DOMAIN_SEPARATOR_NULLIFIER + sk_hex + sessionId)
 * @type {string}
 */
export const DOMAIN_SEPARATOR_NULLIFIER = "nullifier:";

// Add other shared constants here as they are identified.
// For example:
// export const AES_KEY_LENGTH_BITS = 256;
// export const PBKDF2_ITERATIONS = 250000;
// (Though these are currently defined locally in aesUtils.js and might stay there if not widely shared) 
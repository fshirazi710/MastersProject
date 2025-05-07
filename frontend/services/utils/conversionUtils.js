import { mod } from "@noble/curves/abstract/modular";
import { FIELD_ORDER } from './constants.js';

// Field order for BLS12-381 scalar field
// const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

/**
 * Converts a BigInt to a hexadecimal string.
 * Ensures the hex string has an even number of digits by prepending a '0' if necessary.
 * @param {bigint} bigInt The BigInt to convert.
 * @returns {string} The hexadecimal representation.
 */
export function bigIntToHex(bigInt) {
    if (typeof bigInt !== 'bigint') {
        throw new Error(`Invalid input to bigIntToHex: expected bigint, got ${typeof bigInt}`);
    }
    let hex = bigInt.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hex;
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param {string} hex The hexadecimal string (can optionally start with '0x').
 * @returns {Uint8Array} The byte array representation.
 */
export function hexToBytes(hex) {
    if (typeof hex !== 'string') {
         throw new Error(`Invalid input to hexToBytes: expected string, got ${typeof hex}`);
    }
    const hexNormalized = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (hexNormalized.length % 2 !== 0) {
         throw new Error("Hex string must have an even number of digits");
    }
    if (!/^[0-9a-fA-F]*$/.test(hexNormalized)) {
        throw new Error("Invalid characters in hex string");
    }
    
    const bytes = new Uint8Array(hexNormalized.length / 2);
    for (let i = 0; i < hexNormalized.length; i += 2) {
        bytes[i / 2] = parseInt(hexNormalized.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Converts a Uint8Array or standard Array of numbers to a hexadecimal string.
 * @param {Uint8Array | number[]} bytes The byte array to convert.
 * @returns {string} The hexadecimal representation.
 */
export function bytesToHex(bytes) {
    if (!(bytes instanceof Uint8Array) && !Array.isArray(bytes)) {
        throw new Error(`Invalid input to bytesToHex: expected Uint8Array or array, got ${typeof bytes}`);
    }
    return Array.from(bytes)
        .map(byte => {
            if (typeof byte !== 'number' || byte < 0 || byte > 255) {
                 throw new Error(`Invalid byte value in array: ${byte}`);
            }
            return byte.toString(16).padStart(2, "0");
        })
        .join("");
}

/**
 * Converts an elliptic curve point object (assuming it has a toHex method)
 * to a BigInt modulo the field order.
 * @param {object} point An object with a `toHex()` method representing a curve point.
 * @returns {bigint} The point's hex representation converted to a BigInt mod FIELD_ORDER.
 */
export function pointToBigint(point) {
    if (!point || typeof point.toHex !== 'function') {
         throw new Error(`Invalid input to pointToBigint: expected point object with toHex method`);
    }
    // Assuming point.toHex() returns a valid hex string
    const hex = point.toHex(); 
    return mod(BigInt("0x" + hex), FIELD_ORDER);
}

/**
 * Converts various string formats (decimal, hex with/without 0x) to a BigInt.
 * @param {string} str The string to convert.
 * @returns {bigint} The BigInt representation.
 * @throws {Error} If the input is not a string or cannot be parsed as BigInt.
 */
export function stringToBigInt(str) {
    if (typeof str !== 'string') {
        throw new Error(`Invalid input to stringToBigInt: expected string, got ${typeof str}`);
    }
    const trimmedStr = str.trim();
    if (trimmedStr === '') {
        throw new Error(`Invalid input to stringToBigInt: received empty string`);
    }
    try {
        if (trimmedStr.startsWith('0x')) {
            return BigInt(trimmedStr);
        } else if (/^[0-9]+$/.test(trimmedStr)) { // Check if it's purely decimal digits FIRST
             return BigInt(trimmedStr);
        } else if (/^[0-9a-fA-F]+$/.test(trimmedStr)) { // THEN check if it's hex characters (potentially mixed)
            return BigInt('0x' + trimmedStr); // Treat as hex only if it contains a-f or was not purely decimal
        } else {
            // If it contains non-hex, non-decimal characters, BigInt will throw later anyway
            throw new Error("Invalid numeric string format"); 
        }
    } catch (e) {
        console.error(`Failed to convert string "${str}" to BigInt:`, e);
        throw new Error(`Could not parse string as BigInt: ${str}`);
    }
}

/**
 * Converts a BigInt to a 32-byte Uint8Array (Big-Endian).
 * Pads with leading zeros if necessary. Truncates (takes least significant bytes)
 * if the BigInt is larger than 32 bytes.
 * @param {bigint} num The BigInt to convert.
 * @returns {Uint8Array} A 32-byte Uint8Array.
 */
export function bigIntTo32Bytes(num) {
  if (typeof num !== 'bigint') {
      throw new Error(`Invalid input to bigIntTo32Bytes: expected bigint, got ${typeof num}`);
  }
  let hex = num.toString(16);
  // Ensure even length hex string
  if (hex.length % 2) { hex = '0' + hex; }
  // Pad with leading zeros to 64 hex characters (32 bytes)
  const paddedHex = hex.padStart(64, '0');
  // Handle cases where the number might be too large (take least significant 32 bytes)
  const finalHex = paddedHex.length > 64 ? paddedHex.slice(paddedHex.length - 64) : paddedHex;
  // Convert final hex string to Uint8Array
  return hexToBytes(finalHex); // hexToBytes handles '0x' prefix internally if needed
} 
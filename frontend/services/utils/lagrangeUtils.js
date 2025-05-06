import { mod } from "@noble/curves/abstract/modular";

// Import shared constants
import { FIELD_ORDER } from './constants.js';

/**
 * Computes the modular multiplicative inverse of a modulo m using the extended Euclidean algorithm.
 * Finds x such that (a * x) % m = 1.
 * @param {bigint} a The number to find the inverse of.
 * @param {bigint} m The modulus.
 * @returns {bigint} The modular inverse of a modulo m.
 * @throws {Error} If the inverse does not exist (gcd(a, m) !== 1) or inputs are invalid.
 */
export function modInverse(a, m) {
    if (typeof a !== 'bigint' || typeof m !== 'bigint') {
        throw new Error("Inputs a and m must be BigInts.");
    }
    if (m <= 0n) throw new Error("Modulus m must be positive.");
    
    const aModM = mod(a, m); // Use mod helper to handle negative 'a'
    if (aModM === 0n) throw new Error("Cannot compute inverse of 0.");

    let r_prev = m;
    let r_curr = aModM;
    let x_prev = 0n;
    let x_curr = 1n;

    while (r_curr > 0n) {
        const q = r_prev / r_curr; 
        [r_prev, r_curr] = [r_curr, r_prev - q * r_curr]; // Standard EEA step for remainder
        [x_prev, x_curr] = [x_curr, x_prev - q * x_curr];
    }

    if (r_prev !== 1n) {
        console.error(`Modular inverse does not exist for ${a} mod ${m} (GCD is ${r_prev}, not 1)`);
        throw new Error(`Modular inverse does not exist (GCD = ${r_prev})`);
    }

    // Ensure result is positive in [0, m-1]
    return mod(x_prev, m); // Use mod helper for final result
}

/**
 * Calculates the Lagrange basis polynomials L_i(x) evaluated at a point x.
 * L_i(x) = Product_{j=0, j!=i}^{k} (x - indexes[j]) / (indexes[i] - indexes[j])
 * @param {bigint[]} indexes Array of BigInt indexes (points on the x-axis, e.g., participant IDs).
 * @param {bigint} x The point at which to evaluate the basis polynomials (often 0 for SSS).
 * @returns {bigint[]} Array of Lagrange basis coefficients L_i(x) mod FIELD_ORDER.
 * @throws {Error} If inputs are invalid.
 */
export function lagrangeBasis(indexes, x) {
    if (!Array.isArray(indexes) || indexes.length === 0) {
        throw new Error("Indexes must be a non-empty array of BigInts.");
    }
    if (typeof x !== 'bigint') {
         throw new Error("Evaluation point x must be a BigInt.");
    }

    return indexes.map((i) => {
      if (typeof i !== 'bigint') throw new Error("All indexes must be BigInts.");
      let numerator = 1n;
      let denominator = 1n;
  
      for (const j of indexes) {
        if (typeof j !== 'bigint') throw new Error("All indexes must be BigInts.");
        if (i !== j) {
          numerator = mod(numerator * (x - j), FIELD_ORDER);
          const diff = mod(i - j, FIELD_ORDER); // Calculate difference modulo FIELD_ORDER
          if (diff === 0n) {
               console.error(`Duplicate index found in Lagrange basis calculation: ${i}`);
               throw new Error(`Duplicate index ${i} encountered in Lagrange basis calculation.`);
          }
          denominator = mod(denominator * diff, FIELD_ORDER);
        }
      }
  
      if (denominator === 0n) {
            console.error(`Denominator is zero in Lagrange basis calculation for index ${i}. Should not happen with unique indexes.`);
            throw new Error(`Lagrange basis denominator is zero for index ${i}.`);
      }
      
      // Compute modular inverse of the denominator
      const invDenominator = modInverse(denominator, FIELD_ORDER); // Use local modInverse
      return mod(numerator * invDenominator, FIELD_ORDER);
    });
}

/**
 * Performs Lagrange interpolation to find the value of the polynomial at x=0.
 * P(0) = Sum_{i=0}^{k} (shares[i] * basis[i])
 * @param {bigint[]} basis Array of Lagrange basis coefficients L_i(0).
 * @param {bigint[]} shares Array of corresponding shares (or adjusted values for SSS).
 * @returns {bigint} The interpolated value P(0) mod FIELD_ORDER.
 */
export function lagrangeInterpolate(basis, shares) {
    if (!Array.isArray(basis) || !Array.isArray(shares) || basis.length !== shares.length) {
         throw new Error("Basis and shares must be arrays of the same length.");
    }
    return shares.reduce((acc, share, i) => {
        // Add type checks inside reduce for safety
        if (typeof acc !== 'bigint' || typeof share !== 'bigint' || typeof basis[i] !== 'bigint') {
             throw new Error(`Invalid type in Lagrange interpolation at index ${i}: acc=${typeof acc}, share=${typeof share}, basis=${typeof basis[i]}`);
        }
        const product = mod(share * basis[i], FIELD_ORDER);
        return mod(acc + product, FIELD_ORDER); 
    }, 0n); // Start accumulator as BigInt 0
} 
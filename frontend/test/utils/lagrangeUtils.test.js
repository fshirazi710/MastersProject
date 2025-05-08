import { describe, it, expect } from 'vitest';
import { FIELD_ORDER } from '../../services/utils/constants.js'; // Assuming constants.js is in the same dir
import {
    modInverse,
    lagrangeBasis,
    lagrangeInterpolate
} from '../../services/utils/lagrangeUtils.js';

describe('lagrangeUtils.js', () => {
    describe('modInverse(a, m)', () => {
        it('should compute correct modular inverse for known pairs', () => {
            // 7 * x % 11 = 1  => x = 8
            expect(modInverse(7n, 11n)).toBe(8n);
            // 3 * x % 26 = 1 => x = 9
            expect(modInverse(3n, 26n)).toBe(9n);
            // 5 * x % FIELD_ORDER = 1 (use a large prime like FIELD_ORDER)
            // Let's test with a value and its inverse: (5 * inv(5)) % FIELD_ORDER = 1
            const val = 5n;
            const invVal = modInverse(val, FIELD_ORDER);
            expect((val * invVal) % FIELD_ORDER).toBe(1n);
        });

        it('should throw an error if inverse does not exist (gcd(a,m) != 1)', () => {
            // gcd(2, 4) = 2 != 1
            expect(() => modInverse(2n, 4n)).toThrow('Modular inverse does not exist');
            // gcd(10, 25) = 5 != 1
            expect(() => modInverse(10n, 25n)).toThrow(/GCD = 5/);
        });

        it('should throw an error if a is 0', () => {
            expect(() => modInverse(0n, 11n)).toThrow('Cannot compute inverse of 0');
        });

        it('should throw an error if m is 0 or negative', () => {
            expect(() => modInverse(7n, 0n)).toThrow('Modulus m must be positive');
            expect(() => modInverse(7n, -11n)).toThrow('Modulus m must be positive');
        });

        it('should throw an error for non-BigInt inputs', () => {
            // @ts-expect-error - testing invalid type
            expect(() => modInverse(7, 11n)).toThrow('Inputs a and m must be BigInts');
            // @ts-expect-error - testing invalid type
            expect(() => modInverse(7n, 11)).toThrow('Inputs a and m must be BigInts');
        });
    });

    describe('lagrangeBasis(indexes, x)', () => {
        // L_i(x) = Product_{j=0, j!=i}^{k-1} (x - indexes[j]) / (indexes[i] - indexes[j])
        // For x = 0: L_i(0) = Product_{j=0, j!=i}^{k-1} (-indexes[j]) / (indexes[i] - indexes[j])

        it('should compute correct basis coefficients for x=0', () => {
            const indexes = [1n, 2n, 3n]; // k=3 (threshold)
            const x = 0n;
            const basis = lagrangeBasis(indexes, x);

            // L_0(0) for index 1: (0-2)(0-3) / (1-2)(1-3) = (-2)(-3) / (-1)(-2) = 6 / 2 = 3
            // L_1(0) for index 2: (0-1)(0-3) / (2-1)(2-3) = (-1)(-3) / (1)(-1) = 3 / -1 = -3. Modulo FIELD_ORDER
            // L_2(0) for index 3: (0-1)(0-2) / (3-1)(3-2) = (-1)(-2) / (2)(1)  = 2 / 2 = 1
            const expectedBasis = [
                3n,
                (FIELD_ORDER - 3n) % FIELD_ORDER, // -3 mod FIELD_ORDER
                1n
            ];
            expect(basis).toEqual(expectedBasis);
        });

        it('should compute correct basis coefficients for x != 0', () => {
            const indexes = [1n, 2n]; // k=2
            const x = 5n; // Evaluate at x=5
            const basis = lagrangeBasis(indexes, x);

            // L_0(5) for index 1: (5-2) / (1-2) = 3 / -1 = -3
            // L_1(5) for index 2: (5-1) / (2-1) = 4 / 1  = 4
            const expectedBasis = [
                (FIELD_ORDER - 3n) % FIELD_ORDER,
                4n
            ];
            expect(basis).toEqual(expectedBasis);
        });

        it('should throw an error if duplicate indexes are provided', () => {
            const indexes = [1n, 2n, 1n];
            const x = 0n;
            expect(() => lagrangeBasis(indexes, x)).toThrow('Duplicate index 1 encountered');
        });

        it('should throw an error for empty indexes array', () => {
            expect(() => lagrangeBasis([], 0n)).toThrow('Indexes must be a non-empty array');
        });

        it('should throw an error for non-BigInt inputs in indexes', () => {
            // @ts-expect-error - testing invalid type
            expect(() => lagrangeBasis([1n, 2], 0n)).toThrow('All indexes must be BigInts');
        });

        it('should throw an error for non-BigInt input for x', () => {
            // @ts-expect-error - testing invalid type
            expect(() => lagrangeBasis([1n, 2n], 0)).toThrow('Evaluation point x must be a BigInt');
        });
    });

    describe('lagrangeInterpolate(basis, shares)', () => {
        // P(x) = S + a1*x + a2*x^2 + ... + a(t-1)*x^(t-1)
        // Let secret S = 100, t=2 (polynomial of degree 1: P(x) = 100 + 20x)
        // Shares (using 1-based indexing for points for simplicity):
        // P(1) = 100 + 20*1 = 120. Point (1, 120)
        // P(2) = 100 + 20*2 = 140. Point (2, 140)
        // P(3) = 100 + 20*3 = 160. Point (3, 160)

        it('should correctly interpolate the secret at x=0 with t=2 shares', () => {
            const secret = 100n;
            const shares = [120n, 140n]; // Corresponds to P(1), P(2)
            const indexes = [1n, 2n];
            
            const basisCoeffs = lagrangeBasis(indexes, 0n);
            // L_0(0) for index 1: (0-2)/(1-2) = -2/-1 = 2
            // L_1(0) for index 2: (0-1)/(2-1) = -1/1  = -1
            const expectedBasis = [2n, (FIELD_ORDER -1n) % FIELD_ORDER];
            expect(basisCoeffs).toEqual(expectedBasis);

            const interpolatedSecret = lagrangeInterpolate(basisCoeffs, shares);
            // P(0) = 120*2 + 140*(-1) = 240 - 140 = 100
            expect(interpolatedSecret).toBe(secret);
        });

        it('should correctly interpolate the secret at x=0 with t=3 shares', () => {
            // P(x) = 50 + 10x + 5x^2 (secret=50, t=3)
            // P(1) = 50 + 10 + 5 = 65
            // P(2) = 50 + 20 + 20 = 90
            // P(3) = 50 + 30 + 45 = 125
            const secret = 50n;
            const shares = [65n, 90n, 125n]; // P(1), P(2), P(3)
            const indexes = [1n, 2n, 3n];

            const basisCoeffs = lagrangeBasis(indexes, 0n);
            // From previous test: [3n, FIELD_ORDER-3n, 1n]
            const expectedBasis = [3n, (FIELD_ORDER - 3n) % FIELD_ORDER, 1n];
            expect(basisCoeffs).toEqual(expectedBasis);

            const interpolatedSecret = lagrangeInterpolate(basisCoeffs, shares);
            // P(0) = 65*3 + 90*(-3) + 125*1
            //      = 195 - 270 + 125 = 320 - 270 = 50
            expect(interpolatedSecret).toBe(secret);
        });

        it('should throw an error if basis and shares have different lengths', () => {
            const basis = [1n, 2n];
            const shares = [10n];
            expect(() => lagrangeInterpolate(basis, shares)).toThrow('Basis and shares must be arrays of the same length');
        });

        it('should throw an error if basis or shares contain non-BigInts', () => {
            // @ts-expect-error - testing invalid type
            expect(() => lagrangeInterpolate([1n, '2'], [10n, 20n])).toThrow(/Invalid type in Lagrange interpolation/);
            // @ts-expect-error - testing invalid type
            expect(() => lagrangeInterpolate([1n, 2n], [10n, '20'])).toThrow(/Invalid type in Lagrange interpolation/);
        });

        it('should return 0n for empty basis and shares arrays', () => {
            expect(lagrangeInterpolate([], [])).toBe(0n);
        });
    });
}); 
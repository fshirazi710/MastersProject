import { describe, it, expect, vi } from 'vitest';
import { bls12_381 } from '@noble/curves/bls12-381';
import { FIELD_ORDER } from '../../services/utils/constants.js';
import {
    genR,
    getG1R,
    getG2R,
    computePkRValue
} from '../../services/utils/blsPointUtils.js';

describe('blsPointUtils.js', () => {
    describe('genR()', () => {
        it('should return a BigInt', () => {
            const r = genR();
            expect(typeof r).toBe('bigint');
        });

        it('should return a number within the field order [0, FIELD_ORDER - 1]', () => {
            const r = genR();
            expect(r >= BigInt(0)).toBe(true);
            expect(r < FIELD_ORDER).toBe(true);
        });

        it('should produce different numbers on subsequent calls (probabilistic)', () => {
            const r1 = genR();
            const r2 = genR();
            // It's highly improbable they are the same, but not impossible.
            // For a stronger test, one might generate many and check for uniqueness.
            expect(r1).not.toBe(r2); 
        });
    });

    describe('getG1R(r)', () => {
        const testR = BigInt(1234567890);

        it('should return a valid G1 hex string for a BigInt r', () => {
            const g1rHex = getG1R(testR);
            expect(typeof g1rHex).toBe('string');
            // Noble `toHex()` for points is uncompressed by default, G1 is 48 bytes * 2 (hex) = 96 chars
            expect(g1rHex).toMatch(/^[0-9a-fA-F]{96}$/);
            // Attempt to create a point from it to validate
            expect(() => bls12_381.G1.ProjectivePoint.fromHex(g1rHex)).not.toThrow();
        });

        it('should throw an error if r is not a BigInt', () => {
            // @ts-expect-error - testing invalid type
            expect(() => getG1R('not-a-bigint')).toThrow('Scalar r must be a BigInt');
        });
    });

    describe('getG2R(r)', () => {
        const testR = BigInt(9876543210);

        it('should return a valid G2 hex string for a BigInt r', () => {
            const g2rHex = getG2R(testR);
            expect(typeof g2rHex).toBe('string');
            // G2 uncompressed is 96 bytes * 2 (hex) = 192 chars
            expect(g2rHex).toMatch(/^[0-9a-fA-F]{192}$/);
            // Attempt to create a point from it to validate
            expect(() => bls12_381.G2.ProjectivePoint.fromHex(g2rHex)).not.toThrow();
        });

        it('should throw an error if r is not a BigInt', () => {
            // @ts-expect-error - testing invalid type
            expect(() => getG2R(123)).toThrow('Scalar r must be a BigInt');
        });
    });

    describe('computePkRValue(pubkey, r)', () => {
        let mockPkHex;
        let mockR;
        let expectedResultPoint;

        beforeAll(() => {
            mockR = BigInt('123456789012345678901234567890');
            const basePkScalar = BigInt('987654321098765432109876543210');
            const pkPoint = bls12_381.G1.ProjectivePoint.BASE.multiply(basePkScalar);
            mockPkHex = pkPoint.toHex(); // This is raw hex by default from noble
            expectedResultPoint = pkPoint.multiply(mockR);
        });

        it('should compute the correct G1 ProjectivePoint for valid inputs', () => {
            const resultPoint = computePkRValue(mockPkHex, mockR); // computePkRValue expects raw hex
            expect(resultPoint instanceof bls12_381.G1.ProjectivePoint).toBe(true);
            expect(resultPoint.equals(expectedResultPoint)).toBe(true);
        });
        
        it('should compute the correct G1 ProjectivePoint for valid inputs with "0x" prefix', () => {
            const resultPoint = computePkRValue('0x' + mockPkHex, mockR);
            expect(resultPoint instanceof bls12_381.G1.ProjectivePoint).toBe(true);
            expect(resultPoint.equals(expectedResultPoint)).toBe(true);
        });

        it('should throw an error for invalid pubkey hex string', () => {
            expect(() => computePkRValue('0xinvalidhex', mockR))
                .toThrow(/Invalid public key format or multiplication error/i);
        });
        
        it('should throw an error if pubkey is not a string', () => {
            // @ts-expect-error - testing invalid type
            expect(() => computePkRValue(12345, mockR))
                .toThrow('Public key must be a hex string.');
        });

        it('should throw an error if r is not a BigInt', () => {
            // @ts-expect-error - testing invalid type
            expect(() => computePkRValue(mockPkHex, 'not-a-bigint'))
                .toThrow('Scalar r must be a BigInt');
        });
    });
}); 
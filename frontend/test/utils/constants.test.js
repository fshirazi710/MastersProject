import { describe, it, expect } from 'vitest';
import {
    FIELD_ORDER,
    DOMAIN_SEPARATOR_NULLIFIER
} from '../../services/utils/constants.js';

describe('constants.js', () => {
    describe('FIELD_ORDER', () => {
        it('should be defined as a BigInt', () => {
            expect(typeof FIELD_ORDER).toBe('bigint');
        });

        it('should have the correct value for BLS12-381 scalar field order', () => {
            // This is the known r for BLS12-381 (scalar field order)
            const expectedFieldOrder = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");
            expect(FIELD_ORDER).toBe(expectedFieldOrder);
        });
    });

    describe('DOMAIN_SEPARATOR_NULLIFIER', () => {
        it('should be defined as a string', () => {
            expect(typeof DOMAIN_SEPARATOR_NULLIFIER).toBe('string');
        });

        it('should have the expected value', () => {
            expect(DOMAIN_SEPARATOR_NULLIFIER).toBe("nullifier:");
        });

        it('should be a non-empty string', () => {
            expect(DOMAIN_SEPARATOR_NULLIFIER.length).toBeGreaterThan(0);
        });
    });
}); 
import { describe, it, expect, beforeAll } from 'vitest';
import { bls12_381 } from '@noble/curves/bls12-381'; // For G1/G2 points and BASE
import {
    generateBLSKeyPair,
    calculateDecryptionShareForSubmission,
    verifyShares
} from '../../services/utils/blsCryptoUtils.js';
import { FIELD_ORDER } from '../../services/utils/constants.js'; // For potential mod operations if needed

// Helper to generate a random G1 point (raw hex) for testing g1r
const getRandomG1RawHex = () => {
    const randomScalar = bls12_381.utils.randomPrivateKey();
    return bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt('0x' + Buffer.from(randomScalar).toString('hex'))).toHex();
};

// Helper to generate a random G2 point (raw hex) for testing g2r
const getRandomG2RawHex = () => {
    const randomScalar = bls12_381.utils.randomPrivateKey();
    return bls12_381.G2.ProjectivePoint.BASE.multiply(BigInt('0x' + Buffer.from(randomScalar).toString('hex'))).toHex();
};

describe('blsCryptoUtils', () => {
    describe('generateBLSKeyPair', () => {
        it('should generate a valid BLS key pair', () => {
            const { sk, pk } = generateBLSKeyPair();

            expect(typeof sk).toBe('bigint');
            expect(sk).toBeGreaterThan(0n);
            expect(sk).toBeLessThan(FIELD_ORDER); // Private key should be in the field

            expect(pk).toBeInstanceOf(bls12_381.G1.ProjectivePoint);
            
            // Verify pk = sk * G1.BASE
            const expectedPk = bls12_381.G1.ProjectivePoint.BASE.multiply(sk);
            expect(pk.equals(expectedPk)).toBe(true);
        });
    });

    describe('calculateDecryptionShareForSubmission', () => {
        const { sk, pk } = generateBLSKeyPair();
        const g1r_raw_hex = getRandomG1RawHex();

        it('should calculate a valid decryption share raw hex string', async () => {
            const shareRawHex = await calculateDecryptionShareForSubmission(sk, g1r_raw_hex);
            expect(shareRawHex).toMatch(/^[0-9a-fA-F]+$/i); // Raw hex, no 0x
            expect(shareRawHex.length % 2).toBe(0); // Hex string should have even length

            // Verify the crypto: share_point = g1r_point * sk
            const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_raw_hex);
            const expectedSharePoint = g1r_point.multiply(sk);
            const calculatedSharePoint = bls12_381.G1.ProjectivePoint.fromHex(shareRawHex);
            expect(calculatedSharePoint.equals(expectedSharePoint)).toBe(true);
        });

        it('should throw if privateKey is not a BigInt', async () => {
            // @ts-expect-error - testing invalid type
            await expect(calculateDecryptionShareForSubmission('not-a-bigint', g1r_raw_hex))
                .rejects.toThrow(/Invalid privateKey type/);
        });

        it('should throw if g1r_hex is malformed (not raw hex)', async () => {
            // Includes non-hex chars
            await expect(calculateDecryptionShareForSubmission(sk, 'notahexstring'))
                .rejects.toThrow(/Invalid g1r_hex format/);
            // Includes 0x prefix (now invalid for this function)
            await expect(calculateDecryptionShareForSubmission(sk, '0x' + g1r_raw_hex))
                .rejects.toThrow(/Invalid g1r_hex format/);
        });

        it('should throw if g1r_hex is malformed (odd length)', async () => {
            await expect(calculateDecryptionShareForSubmission(sk, '12345'))
                .rejects.toThrow(/Invalid g1r_hex format/);
        });
        
        it('should throw if g1r_hex is not a valid G1 point hex (noble-curves error)', async () => {
            const invalidG1LikeRawHex = '00'.repeat(47) + '11'; // Correct length, likely invalid point
            await expect(calculateDecryptionShareForSubmission(sk, invalidG1LikeRawHex))
                .rejects.toThrow(); // General error from noble library for invalid point
        });
    });

    describe('verifyShares', () => {
        const { sk, pk } = generateBLSKeyPair();
        const pk_raw_hex = pk.toHex();
        let g1r_raw_hex = getRandomG1RawHex();
        let g2r_raw_hex = getRandomG2RawHex(); 
        let validShareRawHex;

        // Regenerate consistent points for the positive test case
        const r_scalar_bytes = bls12_381.utils.randomPrivateKey();
        const r_scalar = BigInt('0x' + Buffer.from(r_scalar_bytes).toString('hex'));
        const test_g1r_raw_hex = bls12_381.G1.ProjectivePoint.BASE.multiply(r_scalar).toHex();
        const test_g2r_raw_hex = bls12_381.G2.ProjectivePoint.BASE.multiply(r_scalar).toHex();
        const test_pk_raw_hex = pk_raw_hex; // Use the same pk
        let test_share_raw_hex;

        // Simpler points for basic identity check
        const base_g2_raw_hex = bls12_381.G2.ProjectivePoint.BASE.toHex();

        beforeAll(async () => {
            // Calculate the valid share corresponding to test_g1r_raw_hex and sk
            test_share_raw_hex = await calculateDecryptionShareForSubmission(sk, test_g1r_raw_hex);
            // Calculate a share based on the randomly generated g1r for negative tests
            validShareRawHex = await calculateDecryptionShareForSubmission(sk, g1r_raw_hex);
        });

        it('should return true for a valid share, public key, and g2r (all raw hex) - Complex Case', () => {
            // Use the pre-calculated consistent values derived from the same scalar 'r'
            expect(verifyShares(test_share_raw_hex, test_pk_raw_hex, test_g2r_raw_hex)).toBe(true);
        });
        
        it('should return true for basic identity check e(pk, G2.Base) == e(pk, G2.Base)', () => {
            // Test the identity using pk for both share and publicKey, and G2.Base for g2r
            expect(verifyShares(test_pk_raw_hex, test_pk_raw_hex, base_g2_raw_hex)).toBe(true);
        });

        it('should return false if the share is incorrect (raw hex)', () => {
            const incorrectShareRawHex = getRandomG1RawHex(); // A random different G1 point
            expect(incorrectShareRawHex).not.toEqual(validShareRawHex); // Ensure it's different
            // Use the g2r that corresponds to validShareRawHex's g1r
            expect(verifyShares(incorrectShareRawHex, pk_raw_hex, g2r_raw_hex)).toBe(false); 
        });

        it('should return false if the public key is incorrect (raw hex)', () => {
            const { pk: otherPk } = generateBLSKeyPair();
            const otherPkRawHex = otherPk.toHex();
            // Use the valid share and its corresponding g2r
            expect(verifyShares(validShareRawHex, otherPkRawHex, g2r_raw_hex)).toBe(false);
        });

        it('should return false if g2r is incorrect (raw hex)', () => {
            const otherG2rRawHex = getRandomG2RawHex();
            expect(otherG2rRawHex).not.toEqual(g2r_raw_hex); // Ensure it's different
            // Use the valid share and pk
            expect(verifyShares(validShareRawHex, pk_raw_hex, otherG2rRawHex)).toBe(false);
        });

        it('should return false for malformed share_hex (non-hex chars)', () => {
            expect(verifyShares('invalid', pk_raw_hex, g2r_raw_hex)).toBe(false);
        });

        it('should return false for malformed publicKey_hex (non-hex chars)', () => {
            expect(verifyShares(validShareRawHex, 'invalid', g2r_raw_hex)).toBe(false);
        });

        it('should return false for malformed g2r_hex (non-hex chars)', () => {
            expect(verifyShares(validShareRawHex, pk_raw_hex, 'invalid')).toBe(false);
        });
    });
}); 
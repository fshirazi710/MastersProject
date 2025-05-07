import { describe, it, expect } from 'vitest';
import { getKAndSecretShares, recomputeKey } from '../../services/utils/shamirUtils.js';
import { importBigIntAsCryptoKey } from '../../services/utils/aesUtils.js'; // For comparing derived keys
import { FIELD_ORDER } from '../../services/utils/constants.js'; // If testing with specific field order
import { mod } from '@noble/curves/abstract/modular'; // For the corrupted share test

describe('shamirUtils', () => {
    describe('getKAndSecretShares', () => {
        it('should generate k and the correct number of shares', () => {
            const threshold = 3;
            const totalParticipants = 5;
            const { k, shares } = getKAndSecretShares(threshold, totalParticipants);

            expect(typeof k).toBe('bigint');
            expect(k).toBeGreaterThanOrEqual(0n);
            expect(k).toBeLessThan(FIELD_ORDER); // k should be within the field order

            expect(shares).toBeInstanceOf(Array);
            expect(shares.length).toBe(totalParticipants);
            shares.forEach(share => {
                expect(share).toHaveProperty('index');
                expect(typeof share.index).toBe('number');
                expect(share.index).toBeGreaterThan(0);
                expect(share.index).toBeLessThanOrEqual(totalParticipants);
                expect(share).toHaveProperty('value');
                expect(typeof share.value).toBe('bigint');
                expect(share.value).toBeGreaterThanOrEqual(0n);
                expect(share.value).toBeLessThan(FIELD_ORDER); // Share values also in field
            });
        });

        it('should throw error for invalid threshold or totalParticipants', () => {
            expect(() => getKAndSecretShares(0, 5)).toThrow('Invalid threshold or totalParticipants');
            expect(() => getKAndSecretShares(3, 2)).toThrow('Invalid threshold or totalParticipants');
            expect(() => getKAndSecretShares(-1, 5)).toThrow('Invalid threshold or totalParticipants');
            // @ts-expect-error - testing invalid type
            expect(() => getKAndSecretShares('abc', 5)).toThrow('Invalid threshold or totalParticipants');
            // @ts-expect-error - testing invalid type
            expect(() => getKAndSecretShares(3, 'xyz')).toThrow('Invalid threshold or totalParticipants');
        });

        // It might be useful to test with a specific known k and polynomial if we wanted to verify share values,
        // but that requires more manual setup and knowledge of the internal random coefficients.
        // For now, verifying structure and reconstruction is the main goal.
    });

    describe('recomputeKey', () => {
        it('should successfully recompute k and derive the same AES key with exactly threshold shares', async () => {
            const threshold = 3;
            const totalParticipants = 5;
            const { k: originalK, shares } = getKAndSecretShares(threshold, totalParticipants);

            const sharesForReconstruction = shares.slice(0, threshold); // Take first 'threshold' shares

            const originalAesKey = await importBigIntAsCryptoKey(originalK);
            const recomputedAesKey = await recomputeKey(sharesForReconstruction, threshold);

            const exportedOriginalKey = await crypto.subtle.exportKey("raw", originalAesKey);
            const exportedRecomputedKey = await crypto.subtle.exportKey("raw", recomputedAesKey);

            expect(new Uint8Array(exportedRecomputedKey)).toEqual(new Uint8Array(exportedOriginalKey));
        });

        it('should successfully recompute k and derive the same AES key with more than threshold shares', async () => {
            const threshold = 2;
            const totalParticipants = 4;
            const { k: originalK, shares } = getKAndSecretShares(threshold, totalParticipants);

            // Use all available shares (more than threshold)
            const sharesForReconstruction = shares; 

            const originalAesKey = await importBigIntAsCryptoKey(originalK);
            const recomputedAesKey = await recomputeKey(sharesForReconstruction, threshold);

            const exportedOriginalKey = await crypto.subtle.exportKey("raw", originalAesKey);
            const exportedRecomputedKey = await crypto.subtle.exportKey("raw", recomputedAesKey);

            expect(new Uint8Array(exportedRecomputedKey)).toEqual(new Uint8Array(exportedOriginalKey));
        });
        
        it('should successfully recompute k even if shares are not in order of index', async () => {
            const threshold = 3;
            const totalParticipants = 5;
            const { k: originalK, shares } = getKAndSecretShares(threshold, totalParticipants);

            let sharesForReconstruction = shares.slice(0, threshold);
            // Shuffle the shares
            sharesForReconstruction = sharesForReconstruction.sort(() => Math.random() - 0.5);

            const originalAesKey = await importBigIntAsCryptoKey(originalK);
            const recomputedAesKey = await recomputeKey(sharesForReconstruction, threshold);

            const exportedOriginalKey = await crypto.subtle.exportKey("raw", originalAesKey);
            const exportedRecomputedKey = await crypto.subtle.exportKey("raw", recomputedAesKey);

            expect(new Uint8Array(exportedRecomputedKey)).toEqual(new Uint8Array(exportedOriginalKey));
        });


        it('should throw error if fewer than threshold shares are provided', async () => {
            const threshold = 3;
            const totalParticipants = 5;
            const { shares } = getKAndSecretShares(threshold, totalParticipants);

            const insufficientShares = shares.slice(0, threshold - 1);
            
            await expect(recomputeKey(insufficientShares, threshold))
                .rejects
                .toThrow(/Insufficient shares provided/);
        });

        it('should throw error for invalid input types for recomputeKey', async () => {
            const validShares = [{ index: 1, value: 123n }];
            const validThreshold = 1;

            // @ts-expect-error - testing invalid type
            await expect(recomputeKey('not-an-array', validThreshold))
                .rejects.toThrow('Input participantShares must be an array.');
            
            // @ts-expect-error - testing invalid type
            await expect(recomputeKey(validShares, 'not-a-number'))
                .rejects.toThrow('Threshold must be a positive number.');
            
            await expect(recomputeKey(validShares, 0))
                .rejects.toThrow('Threshold must be a positive number.');
            
            // @ts-expect-error - testing invalid type
            const sharesWithInvalidIndex = [{ index: 'abc', value: 123n }];
            await expect(recomputeKey(sharesWithInvalidIndex, validThreshold))
                .rejects.toThrow('Share index must be number or bigint');

            // @ts-expect-error - testing invalid type
            const sharesWithInvalidValue = [{ index: 1, value: '123' }];
            await expect(recomputeKey(sharesWithInvalidValue, validThreshold))
                .rejects.toThrow('Share value must be bigint');
        });

        // Consider a test where one of the shares is corrupted (e.g., value changed)
        // This should lead to a different (incorrect) recomputed k, and thus a different AES key.
        it('should result in a different key if a share value is corrupted', async () => {
            const threshold = 2;
            const totalParticipants = 3;
            const { k: originalK, shares } = getKAndSecretShares(threshold, totalParticipants);

            const sharesForReconstruction = shares.slice(0, threshold);
            
            // Corrupt one share
            const corruptedShares = sharesForReconstruction.map((s, i) => 
                i === 0 ? { ...s, value: s.value + 1n } : s // Add 1 to the first share's value
            );
            
            // Ensure the corrupted value is still within field order for a valid comparison
            if (corruptedShares[0].value >= FIELD_ORDER) {
                corruptedShares[0].value = mod(corruptedShares[0].value, FIELD_ORDER);
            }


            const originalAesKey = await importBigIntAsCryptoKey(originalK);
            const recomputedCorruptedAesKey = await recomputeKey(corruptedShares, threshold);

            const exportedOriginalKey = await crypto.subtle.exportKey("raw", originalAesKey);
            const exportedCorruptedKey = await crypto.subtle.exportKey("raw", recomputedCorruptedAesKey);

            expect(new Uint8Array(exportedCorruptedKey)).not.toEqual(new Uint8Array(exportedOriginalKey));
        });
    });
}); 
import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import { createHash } from 'node:crypto';

// Assuming cryptographyUtils.js is in '../../services/utils/'
import {
    calculateNullifier,
    generateZkProof, // Assuming this is the mock/placeholder
    calculateDecryptionValue
} from '../../services/utils/cryptographyUtils.js';

// Mock dependencies if necessary (e.g., for calculateDecryptionValue which might use aesUtils)
vi.mock('../../services/utils/aesUtils.js', () => ({
    decryptWithPassword: vi.fn(),
}));

describe('cryptographyUtils.js', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('calculateNullifier', () => {
        it('should produce a consistent 32-byte hex string for the same inputs', async () => {
            const blsPrivateKeyHex = '0x' + 'a'.repeat(64);
            const blsPrivateKeyBigInt = ethers.toBigInt(blsPrivateKeyHex);
            const voteIdentifier = 'session123_voteOptionA';
            
            const nullifier1 = await calculateNullifier(blsPrivateKeyBigInt, voteIdentifier);
            const nullifier2 = await calculateNullifier(blsPrivateKeyBigInt, voteIdentifier);

            expect(ethers.isHexString(nullifier1, 32)).toBe(true);
            expect(nullifier1).toBe(nullifier2);
        });

        it('should produce different nullifiers for different private keys', async () => {
            const blsPrivateKeyHex1 = '0x' + 'a'.repeat(64);
            const blsPrivateKeyBigInt1 = ethers.toBigInt(blsPrivateKeyHex1);
            const blsPrivateKeyHex2 = '0x' + 'b'.repeat(64);
            const blsPrivateKeyBigInt2 = ethers.toBigInt(blsPrivateKeyHex2);
            const voteIdentifier = 'session123_voteOptionA';

            const nullifier1 = await calculateNullifier(blsPrivateKeyBigInt1, voteIdentifier);
            const nullifier2 = await calculateNullifier(blsPrivateKeyBigInt2, voteIdentifier);

            expect(nullifier1).not.toBe(nullifier2);
        });

        it('should produce different nullifiers for different vote identifiers', async () => {
            const blsPrivateKeyHex = '0x' + 'a'.repeat(64);
            const blsPrivateKeyBigInt = ethers.toBigInt(blsPrivateKeyHex);
            const voteIdentifier1 = 'session123_voteOptionA';
            const voteIdentifier2 = 'session123_voteOptionB';

            const nullifier1 = await calculateNullifier(blsPrivateKeyBigInt, voteIdentifier1);
            const nullifier2 = await calculateNullifier(blsPrivateKeyBigInt, voteIdentifier2);

            expect(nullifier1).not.toBe(nullifier2);
        });

        // TODO: Add tests for invalid inputs (e.g., non-hex private key, empty identifier) if validation is expected here
        it('should throw an error if privateKey is not a BigInt', async () => {
            const invalidPrivateKey = 'not-a-bigint';
            const voteIdentifier = 'session123';
            await expect(calculateNullifier(invalidPrivateKey, voteIdentifier))
                .rejects
                .toThrow(/privateKey must be a BigInt for calculateNullifier/i);
        });

        it('should throw an error if sessionId is undefined', async () => {
            const blsPrivateKeyBigInt = BigInt('0x' + 'a'.repeat(64));
            await expect(calculateNullifier(blsPrivateKeyBigInt, undefined))
                .rejects
                .toThrow(/sessionId is required and must be non-empty for calculateNullifier/i);
        });

        it('should throw an error if sessionId is null', async () => {
            const blsPrivateKeyBigInt = BigInt('0x' + 'a'.repeat(64));
            await expect(calculateNullifier(blsPrivateKeyBigInt, null))
                .rejects
                .toThrow(/sessionId is required and must be non-empty for calculateNullifier/i);
        });

        it('should throw an error if sessionId is an empty string', async () => {
            const blsPrivateKeyBigInt = BigInt('0x' + 'a'.repeat(64));
            const emptySessionId = '';
            await expect(calculateNullifier(blsPrivateKeyBigInt, emptySessionId))
                .rejects
                .toThrow(/sessionId is required and must be non-empty for calculateNullifier/i);
        });
    });

    // Placeholder for generateZkProof tests
    describe('generateZkProof', () => {
        it('should throw the specific "not implemented" error', async () => {
            // This test depends on the current placeholder implementation of generateZkProof
            // which throws an error.
            // Use await expect().rejects.toThrow() for async functions that reject/throw.
            await expect(generateZkProof({})).rejects.toThrow(
                "generateZkProof is not implemented. ZK circuit and proving logic required."
            ); 
        });
    });

    // Placeholder for calculateDecryptionValue tests
    describe('calculateDecryptionValue', () => {
        const mockPassword = 'test-password';
        // Simulate the expected input format: 0xSALT_HEXIV_HEXCIPHERTEXT_HEX
        const mockEncryptedPayload = '0x' + 's'.repeat(32) + 'i'.repeat(24) + 'c'.repeat(64);
        const mockDecryptedSkHex = '0x' + 'd'.repeat(64); // Mock decrypted 32-byte private key

        it('should correctly derive and hash the decryption value after successful decryption', async () => {
            // Mock aesUtils.decryptWithPassword to return the mock private key
            const { decryptWithPassword } = await import('../../services/utils/aesUtils.js');
            vi.mocked(decryptWithPassword).mockResolvedValue(mockDecryptedSkHex);

            const result = await calculateDecryptionValue(mockPassword, mockEncryptedPayload);

            // Verify the mock was called correctly
            expect(decryptWithPassword).toHaveBeenCalledTimes(1);
            expect(decryptWithPassword).toHaveBeenCalledWith(mockEncryptedPayload, mockPassword);

            // Verify the result is a 32-byte hex string (SHA-256 hash)
            expect(ethers.isHexString(result, 32)).toBe(true);

            // Optional: Verify the exact hash if we know the expected output for '0x' + 'd'.repeat(64)
            // Use Node's crypto to calculate the expected hash, avoiding ethers.sha256 type issues
            const expectedHash = 
              '0x' + 
              createHash('sha256')
                .update(Buffer.from(mockDecryptedSkHex.slice(2), 'hex')) // Use Buffer here is fine
                .digest('hex');
            expect(result).toBe(expectedHash);

        });

        it('should throw an error if decryption fails', async () => {
            // Mock aesUtils.decryptWithPassword to throw an error
            const { decryptWithPassword } = await import('../../services/utils/aesUtils.js');
            const mockDecryptionError = new Error('Decryption failed: Invalid password or data');
            vi.mocked(decryptWithPassword).mockRejectedValue(mockDecryptionError);

            // Expect calculateDecryptionValue to catch and re-throw (or wrap) the error
            await expect(calculateDecryptionValue(mockPassword, mockEncryptedPayload))
                .rejects
                .toThrow(/calculateDecryptionValue failed: Decryption failed/i); // Match the wrapped error message

            // Verify the mock was called
            expect(decryptWithPassword).toHaveBeenCalledTimes(1);
            expect(decryptWithPassword).toHaveBeenCalledWith(mockEncryptedPayload, mockPassword);
        });

        it('should throw an error for invalid password input - empty string', async () => {
            const emptyPassword = '';
            await expect(calculateDecryptionValue(emptyPassword, mockEncryptedPayload))
                .rejects
                .toThrow(/Password must be a non-empty string for calculateDecryptionValue/i);
            
            const { decryptWithPassword } = await import('../../services/utils/aesUtils.js');
            expect(decryptWithPassword).not.toHaveBeenCalled();
        });

        it('should throw an error for invalid password input - non-string', async () => {
            const nonStringPassword = 12345; // Using a number as an example of non-string
            await expect(calculateDecryptionValue(nonStringPassword, mockEncryptedPayload))
                .rejects
                .toThrow(/Password must be a non-empty string for calculateDecryptionValue/i);

            const { decryptWithPassword } = await import('../../services/utils/aesUtils.js');
            expect(decryptWithPassword).not.toHaveBeenCalled();
        });

        it('should throw an error for invalid encryptedSkPayloadHex input', async () => {
            const invalidPayload1 = 'not-a-hex-string';
            const invalidPayload2 = '0x123456'; // Too short, but starts with 0x
            const invalidPayload3 = ''; // Empty

            const { decryptWithPassword } = await import('../../services/utils/aesUtils.js');

            await expect(calculateDecryptionValue(mockPassword, invalidPayload1))
                .rejects
                .toThrow(/Encrypted SK payload must be a hex string starting with '0x'/i);
            expect(decryptWithPassword).not.toHaveBeenCalled(); // Should not be called for this case

            // For invalidPayload2, it passes the first check in calculateDecryptionValue,
            // so decryptWithPassword will be called. We mock it to throw for this specific scenario.
            const malformedDataError = new Error('Malformed payload for decryption');
            vi.mocked(decryptWithPassword).mockRejectedValueOnce(malformedDataError);
            await expect(calculateDecryptionValue(mockPassword, invalidPayload2))
                .rejects
                .toThrow(/calculateDecryptionValue failed: Malformed payload for decryption/i);
            expect(decryptWithPassword).toHaveBeenCalledWith(invalidPayload2, mockPassword); // Corrected: called with invalidPayload2
            vi.mocked(decryptWithPassword).mockClear(); // Clear mock for the next assertion

            await expect(calculateDecryptionValue(mockPassword, invalidPayload3))
                .rejects
                .toThrow(/Encrypted SK payload must be a hex string starting with '0x'/i);
            expect(decryptWithPassword).not.toHaveBeenCalled(); // Should not be called for this case
        });
    });
}); 
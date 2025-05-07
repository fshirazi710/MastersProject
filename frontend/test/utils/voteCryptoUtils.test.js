import { describe, it, expect, vi } from 'vitest';
import { bls12_381 } from '@noble/curves/bls12-381';
import {
    encodeVoteToPoint,
    decodePointToVote,
    encryptVoteData,
    decryptVote
} from '../../services/utils/voteCryptoUtils.js';
import { AESEncrypt, AESDecrypt, randomBytes, deriveKeyFromPassword, importBigIntAsCryptoKey } from '../../services/utils/aesUtils.js';
import { hexToBytes, bytesToHex } from '../../services/utils/conversionUtils.js';

// Mocking blsPointUtils as genR, getG1R, getG2R are used by encryptVoteData
// and we want to control their output for predictable tests.
vi.mock('../../services/utils/blsPointUtils.js', () => ({
    genR: vi.fn(() => BigInt('1234567890123456789012345678901234567890')), // Return a mock BigInt
    getG1R: vi.fn(() => '0x04' + 'a1'.repeat(47)), // Mock G1 point hex
    getG2R: vi.fn(() => '0x05' + 'b2'.repeat(95)), // Mock G2 point hex
}));


describe('voteCryptoUtils', () => {
    describe('encodeVoteToPoint and decodePointToVote', () => {
        const possibleOptions = ["Yes", "No", "Abstain", "Maybe Tomorrow If The Weather Is Nice And I Feel Like It"];

        it('should correctly encode a vote option to a G1 point hex string', () => {
            const option = "Yes";
            const pointRawHex = encodeVoteToPoint(option);
            expect(pointRawHex).toMatch(/^[0-9a-fA-F]+$/); // Expect raw hex
            expect(pointRawHex.length % 2).toBe(0);
            // Check if it's a valid G1 point by attempting to deserialize (noble fromHex for points expects RAW hex)
            expect(() => bls12_381.G1.ProjectivePoint.fromHex(pointRawHex)).not.toThrow();
        });

        it('should throw an error if encoding an empty string option', () => {
            expect(() => encodeVoteToPoint("")).toThrow("Invalid vote option provided. Must be a non-empty string.");
        });

        it('should throw an error if encoding a non-string option', () => {
            // @ts-expect-error - testing invalid type
            expect(() => encodeVoteToPoint(123)).toThrow("Invalid vote option provided. Must be a non-empty string.");
        });

        it('should correctly decode a point hex to its original option string', () => {
            const option = "No";
            const pointRawHex = encodeVoteToPoint(option);
            const decodedOption = decodePointToVote('0x' + pointRawHex, possibleOptions);
            expect(decodedOption).toBe(option);
        });

        it('should return null if the point hex does not match any possible option', () => {
            // Generate a point from an option not in possibleOptions for this test
            const otherOption = "Definitely Not";
            const pointRawHex = encodeVoteToPoint(otherOption);
            const decodedOption = decodePointToVote('0x' + pointRawHex, possibleOptions);
            expect(decodedOption).toBeNull();
        });

        it('should handle various option strings correctly in round trip', () => {
            possibleOptions.forEach(option => {
                const pointRawHex = encodeVoteToPoint(option);
                const decodedOption = decodePointToVote('0x' + pointRawHex, possibleOptions);
                expect(decodedOption).toBe(option);
            });
        });

        it('decodePointToVote should throw for invalid pointHex (not hex)', () => {
            expect(() => decodePointToVote("not-a-hex-string", possibleOptions))
                .toThrow("Invalid pointHex provided. Must be a valid hex string starting with 0x.");
        });
        
        it('decodePointToVote should throw for invalid pointHex (no 0x prefix)', () => {
            const pointRawHex = encodeVoteToPoint("Yes"); // Returns raw hex
            expect(() => decodePointToVote(pointRawHex, possibleOptions)) // Pass raw hex directly
                .toThrow("Invalid pointHex provided. Must be a valid hex string starting with 0x.");
        });

        it('decodePointToVote should throw for invalid possibleOptions (not an array)', () => {
            const pointRawHex = encodeVoteToPoint("Yes");
            // @ts-expect-error - testing invalid type
            expect(() => decodePointToVote('0x' + pointRawHex, "not-an-array"))
                .toThrow("Invalid possibleOptions provided. Must be an array of non-empty strings.");
        });

        it('decodePointToVote should throw for invalid possibleOptions (array with non-string)', () => {
            const pointRawHex = encodeVoteToPoint("Yes");
            // @ts-expect-error - testing invalid type
            expect(() => decodePointToVote('0x' + pointRawHex, ["Yes", 123]))
                .toThrow("Invalid possibleOptions provided. Must be an array of non-empty strings.");
        });
         it('decodePointToVote should throw for invalid possibleOptions (array with empty string)', () => {
            const pointRawHex = encodeVoteToPoint("Yes");
            expect(() => decodePointToVote('0x' + pointRawHex, ["Yes", ""]))
                .toThrow("Invalid possibleOptions provided. Must be an array of non-empty strings.");
        });
    });

    describe('encryptVoteData and decryptVote', () => {
        let aesKey;
        const voteData = "My Super Secret Vote Yes!";
        const activeHolderBlsPublicKeysHex = [
            '0x' + bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt(123)).toHex(),
            '0x' + bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt(456)).toHex(),
            '0x' + bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt(789)).toHex(),
        ];
        const voteEncryptionThreshold = 2;

        beforeAll(async () => {
            // Generate a real AES key for testing encryption/decryption round trip
            const salt = await randomBytes(16); // Generate a new salt for each test run
            const password = "test-password-!@#$";
            // deriveKeyFromPassword now directly returns the CryptoKey for AES-GCM
            aesKey = await deriveKeyFromPassword(password, salt);
        });

        it('should correctly encrypt vote data and prepare parameters for contract submission', async () => {
            const result = await encryptVoteData(
                voteData,
                aesKey,
                activeHolderBlsPublicKeysHex,
                voteEncryptionThreshold
            );

            expect(result).toHaveProperty('ciphertext');
            expect(result.ciphertext).toMatch(/^0x[0-9a-fA-F]+$/); // Should be IV + Ciphertext
            expect(result.ciphertext.length).toBeGreaterThan(66); // 0x + 32 (IV) + at least 2 (ciphertext) + auth tag

            expect(result).toHaveProperty('g1r', '0x04' + 'a1'.repeat(47)); // From mock
            expect(result).toHaveProperty('g2r', '0x05' + 'b2'.repeat(95)); // From mock
            
            expect(result).toHaveProperty('alpha');
            expect(Array.isArray(result.alpha)).toBe(true);
            expect(result.alpha.length).toBe(activeHolderBlsPublicKeysHex.length);
            result.alpha.forEach((alphaElement, index) => {
                expect(alphaElement).toBeInstanceOf(Uint8Array); // hexToBytes output
                expect(bytesToHex(alphaElement)).toEqual(activeHolderBlsPublicKeysHex[index].slice(2)); // Compare raw hex
            });

            expect(result).toHaveProperty('threshold', voteEncryptionThreshold);
        });

        it('should successfully decrypt the encrypted vote data with the correct key', async () => {
            const { ciphertext } = await encryptVoteData(
                voteData,
                aesKey,
                activeHolderBlsPublicKeysHex,
                voteEncryptionThreshold
            );
            const decryptedString = await decryptVote(ciphertext, aesKey);
            expect(decryptedString).toBe(voteData);
        });

        it('decryptVote should throw if using an incorrect AES key', async () => {
            const { ciphertext } = await encryptVoteData(
                voteData,
                aesKey,
                activeHolderBlsPublicKeysHex,
                voteEncryptionThreshold
            );
            // Generate a different key
            const wrongSalt = await randomBytes(16);
            // deriveKeyFromPassword returns a CryptoKey. Use a different password or salt.
            const wrongAesKey = await deriveKeyFromPassword("wrong-password-for-test", wrongSalt);

            await expect(decryptVote(ciphertext, wrongAesKey)).rejects.toThrow('Vote decryption failed'); // General error from AESDecrypt
        });

        it('decryptVote should throw for malformed encryptedVoteHex (e.g., too short)', async () => {
            const malformedCiphertext = "0x123456"; // Too short to be valid IV+Ciphertext
            await expect(decryptVote(malformedCiphertext, aesKey)).rejects.toThrow(); // AESDecrypt should throw
        });

        it('decryptVote should throw if reconstructedKey is not a CryptoKey', async () => {
            const { ciphertext } = await encryptVoteData(
                voteData,
                aesKey,
                activeHolderBlsPublicKeysHex,
                voteEncryptionThreshold
            );
            // @ts-expect-error - testing invalid type
            await expect(decryptVote(ciphertext, "not-a-cryptokey")).rejects.toThrow("Invalid reconstructedKey provided. Must be a CryptoKey.");
        });

        // Input validation tests for encryptVoteData
        it('encryptVoteData should throw for invalid voteData (empty)', async () => {
            await expect(encryptVoteData("", aesKey, activeHolderBlsPublicKeysHex, voteEncryptionThreshold))
                .rejects.toThrow("Invalid voteData: Must be a non-empty string.");
        });

        it('encryptVoteData should throw for invalid aesKey (not CryptoKey)', async () => {
            // @ts-expect-error - testing invalid type
            await expect(encryptVoteData(voteData, "not-a-key", activeHolderBlsPublicKeysHex, voteEncryptionThreshold))
                .rejects.toThrow("Invalid aesKey: Must be an AES-GCM CryptoKey.");
        });
        
        it('encryptVoteData should throw for invalid activeHolderBlsPublicKeysHex (not array)', async () => {
            // @ts-expect-error - testing invalid type
            await expect(encryptVoteData(voteData, aesKey, "not-an-array", voteEncryptionThreshold))
                .rejects.toThrow("Invalid activeHolderBlsPublicKeysHex: Must be an array of hex strings starting with 0x.");
        });

        it('encryptVoteData should throw for invalid activeHolderBlsPublicKeysHex (array with non-string)', async () => {
            // @ts-expect-error - testing invalid type
            await expect(encryptVoteData(voteData, aesKey, ["0x123", 456], voteEncryptionThreshold))
                .rejects.toThrow("Invalid activeHolderBlsPublicKeysHex: Must be an array of hex strings starting with 0x.");
        });
        
        it('encryptVoteData should throw for invalid activeHolderBlsPublicKeysHex (array with non-0x prefix hex)', async () => {
            await expect(encryptVoteData(voteData, aesKey, ["123abc"], voteEncryptionThreshold))
                .rejects.toThrow("Invalid activeHolderBlsPublicKeysHex: Must be an array of hex strings starting with 0x.");
        });

        it('encryptVoteData should throw for invalid voteEncryptionThreshold (zero)', async () => {
            await expect(encryptVoteData(voteData, aesKey, activeHolderBlsPublicKeysHex, 0))
                .rejects.toThrow("Invalid voteEncryptionThreshold: Must be a positive number.");
        });
        
        it('encryptVoteData should throw if activeHolders count is less than threshold', async () => {
            await expect(encryptVoteData(voteData, aesKey, activeHolderBlsPublicKeysHex, activeHolderBlsPublicKeysHex.length + 1))
                .rejects.toThrow(/Insufficient activeHolderBlsPublicKeysHex/);
        });

    });
}); 
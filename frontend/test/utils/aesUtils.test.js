import { describe, it, expect, beforeAll } from 'vitest';
import {
    encryptWithPassword,
    decryptWithPassword,
    randomBytes,
    importBigIntAsCryptoKey,
    AESEncrypt,
    AESDecrypt,
    deriveKeyFromPassword,
    // Import other functions if needed for specific tests
} from '../../services/utils/aesUtils.js';
// Conversion utils might be needed for importBigIntAsCryptoKey tests if we verify intermediates
// import { bytesToHex } from '../../services/utils/conversionUtils.js';

describe('aesUtils', () => {

    describe('encryptWithPassword / decryptWithPassword', () => {
        const password = "correct horse battery staple";
        const plaintext = "This is a secret message.";

        it('should successfully encrypt and decrypt a message', async () => {
            const encryptedDataHex = await encryptWithPassword(plaintext, password);
            
            // Basic format check
            expect(encryptedDataHex).toMatch(/^0x[0-9a-fA-F]+$/);
            // Check length (0x + 16-byte salt + 12-byte IV + ciphertext)
            const saltHexLength = 16 * 2;
            const ivHexLength = 12 * 2;
            expect(encryptedDataHex.length).toBeGreaterThanOrEqual(2 + saltHexLength + ivHexLength);

            const decryptedText = await decryptWithPassword(encryptedDataHex, password);
            expect(decryptedText).toBe(plaintext);
        });

        it('should fail decryption with the wrong password', async () => {
            const encryptedDataHex = await encryptWithPassword(plaintext, password);
            const wrongPassword = "incorrect pony battery staple";

            await expect(decryptWithPassword(encryptedDataHex, wrongPassword))
                .rejects
                .toThrow('Decryption failed. Check password or data integrity.');
        });

        it('should fail decryption if the encrypted data is tampered with (e.g., ciphertext changed)', async () => {
            let encryptedDataHex = await encryptWithPassword(plaintext, password);
            
            // Tamper with the ciphertext part (last few chars)
            const lastChar = encryptedDataHex.slice(-1);
            const tamperedChar = lastChar === 'a' ? 'b' : 'a';
            const tamperedDataHex = encryptedDataHex.slice(0, -1) + tamperedChar;

            await expect(decryptWithPassword(tamperedDataHex, password))
                .rejects
                .toThrow('Decryption failed. Check password or data integrity.');
        });
        
        it('should fail decryption if the encrypted data hex is malformed (too short)', async () => {
            const shortHex = '0x11223344'; // Too short to contain salt+IV
            await expect(decryptWithPassword(shortHex, password))
                .rejects
                .toThrow(/too short/);
        });
        
        it('should fail decryption if the encrypted data hex is malformed (invalid hex)', async () => {
            const encryptedDataHex = await encryptWithPassword(plaintext, password);
            const invalidHex = encryptedDataHex.slice(0, -5) + "XXYYZZ"; // Introduce non-hex chars
            await expect(decryptWithPassword(invalidHex, password))
                .rejects
                .toThrow(/Invalid encrypted data format/); // Error from hexToBytes likely
        });

        it('should throw error for empty password during encryption', async () => {
            await expect(encryptWithPassword(plaintext, ''))
                .rejects
                .toThrow(/Password must be a non-empty string/);
        });
        
        it('should throw error for empty password during decryption', async () => {
            const encryptedDataHex = await encryptWithPassword(plaintext, password);
            await expect(decryptWithPassword(encryptedDataHex, ''))
                .rejects
                .toThrow(/Password must be a non-empty string/);
        });

        it('should encrypt different plaintexts to different ciphertexts with the same password', async () => {
            const plaintext1 = "Message one";
            const plaintext2 = "Message two";

            const encrypted1 = await encryptWithPassword(plaintext1, password);
            const encrypted2 = await encryptWithPassword(plaintext2, password);

            expect(encrypted1).not.toBe(encrypted2);

            // Also check they decrypt correctly
            expect(await decryptWithPassword(encrypted1, password)).toBe(plaintext1);
            expect(await decryptWithPassword(encrypted2, password)).toBe(plaintext2);
        });

        // Note: Testing AESEncrypt/AESDecrypt directly would require managing CryptoKeys separately.
        // Note: Testing deriveKeyFromPassword directly is possible but less useful than testing the wrappers.
        // Note: Testing randomBytes is difficult due to its nature.
        // Note: Testing importBigIntAsCryptoKey would require known input/output vectors or comparing derived keys.
    });

    describe('randomBytes', () => {
        it('should return a Uint8Array of the specified size', () => {
            const size = 16;
            const bytes = randomBytes(size);
            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes.length).toBe(size);
        });

        it('should return different values on subsequent calls', () => {
            const size = 16;
            const bytes1 = randomBytes(size);
            const bytes2 = randomBytes(size);
            // It's statistically highly improbable they are the same for 16 bytes
            expect(bytes1).not.toEqual(bytes2); 
        });

        it('should throw an error if size is not a positive integer', () => {
            expect(() => randomBytes(0)).toThrow('Size must be a positive integer.');
            expect(() => randomBytes(-1)).toThrow('Size must be a positive integer.');
            expect(() => randomBytes(10.5)).toThrow('Size must be a positive integer.');
            expect(() => randomBytes('abc')).toThrow('Size must be a positive integer.');
        });
    });

    describe('importBigIntAsCryptoKey', () => {
        it('should import a BigInt and return a CryptoKey', async () => {
            const testBigInt = 1234567890123456789012345678901234567890n;
            const cryptoKey = await importBigIntAsCryptoKey(testBigInt);

            expect(cryptoKey).toBeInstanceOf(CryptoKey);
            expect(cryptoKey.type).toBe('secret'); // Or 'private' if that's the expected type
            expect(cryptoKey.algorithm.name).toBe('AES-GCM');
            expect(cryptoKey.algorithm.length).toBe(256);
            expect(cryptoKey.extractable).toBe(true); // As set in the function
            expect(cryptoKey.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
        });

        it('should produce the same CryptoKey for the same BigInt', async () => {
            const testBigInt = 9876543210987654321098765432109876543210n;
            const key1 = await importBigIntAsCryptoKey(testBigInt);
            const key2 = await importBigIntAsCryptoKey(testBigInt);

            // Exporting and comparing raw key material is the most reliable way
            // but requires key to be extractable and is a bit more involved.
            // For now, we'll check a few properties.
            // A more thorough test might involve encrypting/decrypting with both keys.
            expect(key1.algorithm.name).toBe(key2.algorithm.name);
            expect(key1.algorithm.length).toBe(key2.algorithm.length);

            // To truly compare, we'd export and compare them:
            const exportedKey1 = await crypto.subtle.exportKey("raw", key1);
            const exportedKey2 = await crypto.subtle.exportKey("raw", key2);
            expect(new Uint8Array(exportedKey1)).toEqual(new Uint8Array(exportedKey2));
        });
        
        it('should throw an error if input is not a BigInt', async () => {
            await expect(importBigIntAsCryptoKey(12345))
                .rejects
                .toThrow(/Invalid input to importBigIntAsCryptoKey: expected bigint, got number/);
            await expect(importBigIntAsCryptoKey('12345n'))
                .rejects
                .toThrow(/Invalid input to importBigIntAsCryptoKey: expected bigint, got string/);
        });

        // Optional: Test with a known BigInt -> SHA256 hash -> AES Key vector if available
        // This would require pre-calculating the expected raw key bytes.
        // For example:
        // it('should correctly derive key from a known BigInt and hash', async () => {
        //     const knownBigInt = 123n;
        //     // Pre-calculate SHA256("0123") -> let's assume it's someKnownHashBytes
        //     // const { bytesToHex, hexToBytes } = await import('../../services/utils/conversionUtils.js');
        //     // const minimalKeyBytes = hexToBytes(knownBigInt.toString(16).padStart(2, '0'));
        //     // const expectedHashBuffer = await crypto.subtle.digest('SHA-256', minimalKeyBytes);
        //     // const expectedKeyBytes = new Uint8Array(expectedHashBuffer);

        //     const cryptoKey = await importBigIntAsCryptoKey(knownBigInt);
        //     const exportedKey = await crypto.subtle.exportKey("raw", cryptoKey);
        //     // expect(new Uint8Array(exportedKey)).toEqual(expectedKeyBytes);
        //     // For now, just log it to see:
        //     // console.log("Expected key bytes for 123n:", bytesToHex(expectedKeyBytes));
        //     // console.log("Actual key bytes for 123n:", bytesToHex(new Uint8Array(exportedKey)));
        //     expect(cryptoKey).toBeDefined(); // Placeholder until we have a known vector
        // });
    });
    
    describe('AESEncrypt / AESDecrypt', () => {
        let testKey;
        const plaintext = "Secret data for direct AES functions.";

        beforeAll(async () => {
            // Generate a fresh AES-GCM key for these tests
            testKey = await crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true, // extractable
                ["encrypt", "decrypt"]
            );
        });

        it('should successfully encrypt and decrypt data with a CryptoKey', async () => {
            const encryptedHex = await AESEncrypt(plaintext, testKey);
            expect(encryptedHex).toMatch(/^0x[0-9a-fA-F]+$/);
            const ivHexLength = 12 * 2; // 12-byte IV
            expect(encryptedHex.length).toBeGreaterThanOrEqual(2 + ivHexLength + 2); // 0x + IV + at least 1 byte ciphertext

            const decryptedText = await AESDecrypt(encryptedHex, testKey);
            expect(decryptedText).toBe(plaintext);
        });

        it('should fail decryption if a different CryptoKey is used', async () => {
            const encryptedHex = await AESEncrypt(plaintext, testKey);

            const wrongKey = await crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );

            await expect(AESDecrypt(encryptedHex, wrongKey))
                .rejects
                .toThrow('Decryption failed. Check password or data integrity.');
        });

        it('should fail decryption if the encrypted hex is tampered (ciphertext part)', async () => {
            let encryptedHex = await AESEncrypt(plaintext, testKey);
            const tamperedHex = encryptedHex.slice(0, -1) + (encryptedHex.endsWith('a') ? 'b' : 'a');
            
            await expect(AESDecrypt(tamperedHex, testKey))
                .rejects
                .toThrow('Decryption failed. Check password or data integrity.');
        });

        it('should fail decryption if the IV part of the encrypted hex is tampered', async () => {
            let encryptedHex = await AESEncrypt(plaintext, testKey);
            // 0x + IV (24 chars) + ciphertext
            const ivPart = encryptedHex.substring(2, 26);
            const tamperedIvChar = ivPart[0] === 'a' ? 'b' : 'a';
            const tamperedIvPart = tamperedIvChar + ivPart.substring(1);
            const tamperedHex = '0x' + tamperedIvPart + encryptedHex.substring(26);

            await expect(AESDecrypt(tamperedHex, testKey))
                .rejects
                .toThrow('Decryption failed. Check password or data integrity.');
        });

        it('should fail decryption for malformed hex string (too short for IV)', async () => {
            const shortHex = '0x1234567890abcdef123456'; // 24 chars after 0x, but ciphertext missing
            await expect(AESDecrypt(shortHex, testKey))
                .rejects
                .toThrow("Invalid arguments for AES decryption. Expected '0x' prefixed hex string.");
        });

        it('should fail decryption for hex string not starting with 0x', async () => {
            const noPrefixHex = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
            await expect(AESDecrypt(noPrefixHex, testKey))
                .rejects
                .toThrow("Invalid arguments for AES decryption. Expected '0x' prefixed hex string.");
        });
        
        it('should fail decryption for hex string with invalid hex characters in IV', async () => {
            const encryptedHex = await AESEncrypt(plaintext, testKey);
            const invalidHex = '0xXXYYZZ' + encryptedHex.substring(8); // Corrupt IV start
            await expect(AESDecrypt(invalidHex, testKey))
                .rejects
                .toThrow('Invalid encrypted data format.'); // from hexToBytes
        });

        it('should fail decryption for hex string with invalid hex characters in ciphertext', async () => {
            const encryptedHex = await AESEncrypt(plaintext, testKey);
            const invalidHex = encryptedHex.slice(0, -4) + 'XXYY'; // Corrupt ciphertext end
            await expect(AESDecrypt(invalidHex, testKey))
                .rejects
                .toThrow('Invalid encrypted data format.'); // from hexToBytes
        });

        it('AESEncrypt should throw if text is not a string', async () => {
            await expect(AESEncrypt(12345, testKey))
                .rejects.toThrow('Invalid arguments for AES encryption.');
        });

        it('AESEncrypt should throw if key is not a CryptoKey', async () => {
            await expect(AESEncrypt(plaintext, {}))
                .rejects.toThrow('Invalid arguments for AES encryption.');
        });

    });
    
    describe('deriveKeyFromPassword', () => {
        const password = "myStrongPassword123!";
        const salt1 = randomBytes(16); // Generate a 16-byte salt
        const salt2 = randomBytes(16); // Generate a different 16-byte salt

        it('should derive a CryptoKey with correct properties', async () => {
            const cryptoKey = await deriveKeyFromPassword(password, salt1);

            expect(cryptoKey).toBeInstanceOf(CryptoKey);
            expect(cryptoKey.type).toBe('secret');
            expect(cryptoKey.algorithm.name).toBe('AES-GCM');
            expect(cryptoKey.algorithm.length).toBe(256);
            expect(cryptoKey.extractable).toBe(true); // As set in the function
            expect(cryptoKey.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
        });

        it('should derive the same key for the same password and salt', async () => {
            const key1 = await deriveKeyFromPassword(password, salt1);
            const key2 = await deriveKeyFromPassword(password, salt1);

            const exportedKey1 = await crypto.subtle.exportKey("raw", key1);
            const exportedKey2 = await crypto.subtle.exportKey("raw", key2);
            expect(new Uint8Array(exportedKey1)).toEqual(new Uint8Array(exportedKey2));
        });

        it('should derive different keys for different salts', async () => {
            const key1 = await deriveKeyFromPassword(password, salt1);
            const key2 = await deriveKeyFromPassword(password, salt2);

            expect(salt1).not.toEqual(salt2); // Ensure salts are indeed different

            const exportedKey1 = await crypto.subtle.exportKey("raw", key1);
            const exportedKey2 = await crypto.subtle.exportKey("raw", key2);
            expect(new Uint8Array(exportedKey1)).not.toEqual(new Uint8Array(exportedKey2));
        });
        
        it('should derive different keys for different passwords with the same salt', async () => {
            const password2 = "anotherPassword456?";
            const key1 = await deriveKeyFromPassword(password, salt1);
            const key2 = await deriveKeyFromPassword(password2, salt1);

            const exportedKey1 = await crypto.subtle.exportKey("raw", key1);
            const exportedKey2 = await crypto.subtle.exportKey("raw", key2);
            expect(new Uint8Array(exportedKey1)).not.toEqual(new Uint8Array(exportedKey2));
        });

        it('should throw an error for an empty password', async () => {
            await expect(deriveKeyFromPassword('', salt1))
                .rejects.toThrow('Password must be a non-empty string.');
        });

        it('should throw an error for an invalid salt (e.g., string)', async () => {
            await expect(deriveKeyFromPassword(password, 'not-a-salt'))
                .rejects.toThrow('Salt must be a Uint8Array of sufficient length');
        });

        it('should throw an error for a salt that is too short', async () => {
            const shortSalt = randomBytes(4); // PBKDF2 usually requires at least 8 bytes
            await expect(deriveKeyFromPassword(password, shortSalt))
                .rejects.toThrow('Salt must be a Uint8Array of sufficient length');
        });
    });

}); 
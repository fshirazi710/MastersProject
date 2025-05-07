import { describe, it, expect } from 'vitest';
import {
    bytesToHex,
    hexToBytes,
    bigIntToHex,
    stringToBigInt,
    bigIntTo32Bytes,
    pointToBigint,
    // Import other functions as needed
} from '../../services/utils/conversionUtils.js';

describe('conversionUtils', () => {

    describe('bytesToHex', () => {
        it('should convert a simple Uint8Array to hex', () => {
            const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
            expect(bytesToHex(bytes)).toBe('deadbeef');
        });

        it('should convert an empty Uint8Array to an empty string', () => {
            const bytes = new Uint8Array([]);
            expect(bytesToHex(bytes)).toBe('');
        });

        it('should convert a Uint8Array with leading/trailing zeros', () => {
            const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x00]);
            expect(bytesToHex(bytes)).toBe('00010200');
        });
        
        it('should convert a standard number array to hex', () => {
            const bytes = [72, 101, 108, 108, 111]; // ASCII for "Hello"
            expect(bytesToHex(bytes)).toBe('48656c6c6f');
        });

        it('should throw an error for invalid input type', () => {
            expect(() => bytesToHex('not an array')).toThrow(/expected Uint8Array or array/);
            expect(() => bytesToHex(null)).toThrow(/expected Uint8Array or array/);
            expect(() => bytesToHex({a: 1})).toThrow(/expected Uint8Array or array/);
        });

        it('should throw an error for array with invalid byte values', () => {
            expect(() => bytesToHex([0, 256])).toThrow(/Invalid byte value/);
            expect(() => bytesToHex([-1, 10])).toThrow(/Invalid byte value/);
            expect(() => bytesToHex(['a', 10])).toThrow(/Invalid byte value/);
        });
    });

    describe('hexToBytes', () => {
        it('should convert a simple hex string to Uint8Array', () => {
            const hex = 'deadbeef';
            expect(hexToBytes(hex)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
        });

        it('should convert a hex string with 0x prefix', () => {
            const hex = '0x48656c6c6f'; // "Hello"
            expect(hexToBytes(hex)).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
        });

        it('should convert an empty hex string to an empty Uint8Array', () => {
            const hex = '';
            expect(hexToBytes(hex)).toEqual(new Uint8Array([]));
        });
        
        it('should convert hex string with leading/trailing zeros', () => {
            const hex = '00010200';
            expect(hexToBytes(hex)).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0x00]));
        });

        it('should throw an error for invalid input type', () => {
            expect(() => hexToBytes(123)).toThrow(/expected string/);
            expect(() => hexToBytes(null)).toThrow(/expected string/);
            expect(() => hexToBytes(undefined)).toThrow(/expected string/);
        });

        it('should throw an error for hex string with odd length', () => {
            expect(() => hexToBytes('abc')).toThrow(/must have an even number of digits/);
        });

        it('should throw an error for hex string with invalid characters', () => {
            expect(() => hexToBytes('00xxzz')).toThrow(/Invalid characters in hex string/);
            expect(() => hexToBytes('efg123')).toThrow(/Invalid characters in hex string/);
        });
    });

    describe('bigIntToHex', () => {
        it('should convert a BigInt to hex', () => {
            expect(bigIntToHex(255n)).toBe('ff');
            expect(bigIntToHex(256n)).toBe('0100');
            expect(bigIntToHex(65535n)).toBe('ffff');
        });

        it('should handle zero', () => {
            expect(bigIntToHex(0n)).toBe('00'); // Should pad to even length
        });

        it('should handle large BigInts', () => {
            const largeNum = 1234567890123456789012345678901234567890n;
            expect(bigIntToHex(largeNum)).toBe('03a0c92075c0dbf3b8acbc5f96ce3f0ad2');
        });

        it('should prepend zero if hex length is odd', () => {
            expect(bigIntToHex(10n)).toBe('0a');
            expect(bigIntToHex(15n)).toBe('0f');
            expect(bigIntToHex(260n)).toBe('0104'); // 0x104
        });

        it('should throw an error for invalid input type', () => {
            expect(() => bigIntToHex(123)).toThrow(/expected bigint/);
            expect(() => bigIntToHex('123')).toThrow(/expected bigint/);
            expect(() => bigIntToHex(null)).toThrow(/expected bigint/);
        });
    });

    describe('stringToBigInt', () => {
        it('should convert decimal strings to BigInt', () => {
            expect(stringToBigInt('123')).toBe(123n);
            expect(stringToBigInt('0')).toBe(0n);
            expect(stringToBigInt('99999999999999999999999')).toBe(99999999999999999999999n);
        });

        it('should convert hex strings with 0x prefix to BigInt', () => {
            expect(stringToBigInt('0xff')).toBe(255n);
            expect(stringToBigInt('0x0100')).toBe(256n);
            expect(stringToBigInt('0x0')).toBe(0n);
        });
        
        it('should convert hex strings without 0x prefix to BigInt', () => {
            expect(stringToBigInt('ff')).toBe(255n);
            expect(stringToBigInt('0100')).toBe(100n);
            expect(stringToBigInt('aBcD')).toBe(0xabcdn);
        });
        
        it('should handle strings with whitespace', () => {
             expect(stringToBigInt(' 123 ')).toBe(123n);
             expect(stringToBigInt(' 0xff ')).toBe(255n);
        });

        it('should throw an error for invalid input type', () => {
            expect(() => stringToBigInt(123)).toThrow(/expected string/);
            expect(() => stringToBigInt(null)).toThrow(/expected string/);
            expect(() => stringToBigInt(undefined)).toThrow(/expected string/);
        });

        it('should throw an error for empty or invalid strings', () => {
            expect(() => stringToBigInt('')).toThrow(/received empty string/);
            expect(() => stringToBigInt(' ')).toThrow(/received empty string/);
            expect(() => stringToBigInt('hello')).toThrow(/Could not parse string as BigInt/);
            expect(() => stringToBigInt('0xgg')).toThrow(/Could not parse string as BigInt/);
        });
    });

    describe('bigIntTo32Bytes', () => {
        it('should convert a small BigInt to 32 bytes (padded)', () => {
            const expected = new Uint8Array(32).fill(0);
            expected[31] = 0xff; // Set last byte
            expect(bigIntTo32Bytes(255n)).toEqual(expected);
        });

        it('should convert zero to 32 zero bytes', () => {
            expect(bigIntTo32Bytes(0n)).toEqual(new Uint8Array(32).fill(0));
        });

        it('should convert a BigInt that fits exactly in 32 bytes', () => {
            const val = (1n << 256n) - 1n; // Max value for 32 bytes (2^256 - 1)
            const expected = new Uint8Array(32).fill(0xff);
            expect(bigIntTo32Bytes(val)).toEqual(expected);
        });
        
        it('should convert a BigInt needing multiple bytes', () => {
             const val = 0xabcdef123456n;
             const expected = new Uint8Array(32).fill(0);
             expected[32 - 6] = 0xab;
             expected[32 - 5] = 0xcd;
             expected[32 - 4] = 0xef;
             expected[32 - 3] = 0x12;
             expected[32 - 2] = 0x34;
             expected[32 - 1] = 0x56;
             expect(bigIntTo32Bytes(val)).toEqual(expected);
        });

        it('should truncate BigInts larger than 32 bytes (take least significant bytes)', () => {
            const largeVal = (1n << 256n) + 123n; // 2^256 + 123
            const expected = new Uint8Array(32).fill(0);
            expected[31] = 123;
            expect(bigIntTo32Bytes(largeVal)).toEqual(expected);
        });

        it('should throw an error for invalid input type', () => {
            expect(() => bigIntTo32Bytes(123)).toThrow(/expected bigint/);
            expect(() => bigIntTo32Bytes('123')).toThrow(/expected bigint/);
        });
    });

    describe('pointToBigint', () => {
        // Mock point class
        class MockPoint {
            constructor(hex) {
                this._hex = hex.startsWith('0x') ? hex.slice(2) : hex;
            }
            toHex() {
                return this._hex;
            }
        }

        it('should convert a mock point\'s hex to BigInt mod FIELD_ORDER', () => {
            // FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001")
            const point1 = new MockPoint('ff');
            expect(pointToBigint(point1)).toBe(255n);
            
            const point2 = new MockPoint('0x0100');
            expect(pointToBigint(point2)).toBe(256n);
            
            // Example slightly larger than field order
            const largeHex = '73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000005'; // FIELD_ORDER + 4
            const pointLarge = new MockPoint(largeHex);
            expect(pointToBigint(pointLarge)).toBe(4n); // Should be reduced modulo FIELD_ORDER
        });
        
        it('should throw an error for invalid input', () => {
             expect(() => pointToBigint(null)).toThrow(/expected point object with toHex method/);
             expect(() => pointToBigint({})).toThrow(/expected point object with toHex method/);
             expect(() => pointToBigint({ toHex: 'not a function' })).toThrow(/expected point object with toHex method/);
        });
    });

}); 
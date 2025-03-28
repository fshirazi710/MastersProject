import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";

const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

function randomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}

export function generateBLSKeyPair() {
    const skBytes = randomBytes(32);
    const sk = BigInt("0x" + Buffer.from(skBytes).toString("hex"));
    const pk = bls12_381.getPublicKey(sk);
    console.log("PK:", pk);
    const isValid = bls12_381.G1.ProjectivePoint.fromHex(pk) !== null;
    console.log("Is valid G1 point:", isValid);
    return { sk, pk };
}

export function getPublicKeyFromPrivate(privateKey) {
    const sk = typeof privateKey === 'string' ? BigInt("0x" + privateKey) : privateKey;
    const pk = bls12_381.getPublicKey(sk);
    console.log("PK:", pk);
    const isValid = bls12_381.G1.ProjectivePoint.fromHex(pk) !== null;
    console.log("Is valid G1 point:", isValid);
    return pk;
}

export async function getKAndSecretShares(pubkeys, threshold, total) {
    const indexes = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    const tIndexes = indexes.slice(0, threshold);
    const restIndexes = indexes.slice(threshold);
    const tPubkeys = pubkeys.slice(0, threshold);
    const restPubkeys = pubkeys.slice(threshold);

    const r = genR();
    const [k, alphas] = await getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys);

    const g1r = getG1R(r)

    const g2r = getG2R(r)

    return [k, g1r, g2r, alphas];
}

function getG1R(r) {
    const g1 = bls12_381.G1.ProjectivePoint.BASE;
    const result = g1.multiply(r);
    return result.toHex();
}

function getG2R(r) {
    const g2 = bls12_381.G2.ProjectivePoint.BASE;
    const result = g2.multiply(r);
    return result.toHex();
}

export function generateShares(g1r_hex, privateKey) {
    const bigIntPrivateKey = BigInt("0x" + privateKey); 
    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);
    const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
    const result = g1r_point.multiply(modBigIntPrivateKey);
    return pointToBigint(result)
}

export async function recomputeKey(indexes, shares, alphas, threshold) {
    const bigIntIndexes = indexes.map(index => BigInt(index));

    const tIndexes = bigIntIndexes.slice(0, threshold);
    const basis = lagrangeBasis(tIndexes, BigInt(0));
    console.log("Lagrange Basis:", basis);

    const terms = [];

    for (let i = 0; i < indexes.length; i++) {
        if (indexes[i] <= threshold) {
            terms.push(shares[i]);            
        } else {
            const alphaBigInt = stringToBigInt(alphas[(indexes[i] - 1) - threshold]);

            const shareHex = bigIntToHex(shares[i]);
            const alphaHex = bigIntToHex(alphaBigInt);

            const alphaBytes = hexToBytes(alphaHex);
            const shareBytes = hexToBytes(shareHex);
        
            const xorResult = [];
            for (let i = 0; i < alphaBytes.length; i++) {
                xorResult.push(alphaBytes[i] ^ shareBytes[i]);
            }
                
            const term = BigInt('0x' + Buffer.from(xorResult).toString('hex'));
            terms.push(term);
        }
    }

    const k = lagrangeInterpolate(basis, terms);
    const key = await importBigIntAsCryptoKey(k);

    return key;
}

function bigIntToHex(bigInt) {
    let hex = bigInt.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hex;
}

function stringToBigInt(str) {
    return BigInt(str);
}

export async function AESEncrypt(text, key) {
    try {
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Generate IV
        const encodedText = new TextEncoder().encode(text);
        const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedText);

        return bytesToHex(iv) + bytesToHex(new Uint8Array(ciphertext));
    } catch (error) {
        console.error("Encryption failed:", error);
        throw error;
    }
}

export async function AESDecrypt(encryptedHex, key) {
    const iv = hexToBytes(encryptedHex.slice(0, 24)); // Extract IV (assuming 12-byte IV for AES-GCM)
    const ciphertext = hexToBytes(encryptedHex.slice(24)); // Extract Ciphertext

    try {
        // Decrypting using the AES-GCM algorithm
        const decryptedBuffer = await window.crypto.subtle.decrypt({ 
            name: "AES-GCM", 
            iv 
        }, key, ciphertext);

        // Decode and return the decrypted text
        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Decryption failed");
    }
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function computePkRValue(pubkey, r) {
    const pkArray = Uint8Array.from(Buffer.from(pubkey, "hex"));
    const pkPoint = bls12_381.G1.ProjectivePoint.fromHex(pkArray);
    return pkPoint.multiply(r);
}

function lagrangeBasis(indexes, x) {
    return indexes.map((i) => {
      let numerator = BigInt(1);
      let denominator = BigInt(1);
  
      for (const j of indexes) {
        if (i !== j) {
          numerator = mod(numerator * (x - j), FIELD_ORDER);
          denominator = mod(denominator * (i - j), FIELD_ORDER);
        }
      }
  
      return mod(numerator * modInverse(denominator, FIELD_ORDER), FIELD_ORDER);
    });
}

// Helper function to convert bytes to hex
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function modInverse(a, m) {
    a = (a % m + m) % m; // Ensure a is positive

    // Find the gcd using the Extended Euclidean Algorithm
    const s = [];
    let b = m;

    while (b) {
        [a, b] = [b, a % b];
        s.push({ a, b });
    }

    // Find the modular inverse
    let x = BigInt(1);
    let y = BigInt(0);

    for (let i = s.length - 2; i >= 0; --i) {
        [x, y] = [y, x - y * BigInt(s[i].a / s[i].b)];
    }

    return (y % m + m) % m; // Ensure result is positive
}

function lagrangeInterpolate(basis, shares) {
    return shares.reduce((acc, share, i) => 
        mod(acc + mod(share * basis[i], FIELD_ORDER), FIELD_ORDER), 
        BigInt(0)
    );
}


function genR() {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    const hexString = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return mod(BigInt("0x" + hexString), FIELD_ORDER);
}

async function getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys) {
    const tShares = tPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });
    console.log("T Shares:", tShares)


    const basis = lagrangeBasis(tIndexes, BigInt(0));
    console.log("Basis: ", basis)
    console.log("T Indexes: ", tIndexes)
    const k = lagrangeInterpolate(basis, tShares);
    console.log("Key:", k)
    const key = await importBigIntAsCryptoKey(k);

    const restShares = restPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });
    console.log("Rest Shares:", restShares)


    let alphas = [];
    for (let counter = 0; counter < restIndexes.length; counter++) {
        const i = restIndexes[counter];
        const i_basis = lagrangeBasis(tIndexes, i);
        const i_point = lagrangeInterpolate(i_basis, tShares);

        const i_point_bytes = Uint8Array.from(Buffer.from(i_point.toString(16), "hex"));
        const i_share_bytes = Uint8Array.from(Buffer.from(restShares[counter].toString(16), "hex"));

        // XOR the point and share
        const i_alpha = BigInt("0x" + Buffer.from(i_point_bytes.map((byte, i) => byte ^ i_share_bytes[i])).toString("hex"));
        alphas.push(i_alpha.toString());
    }

    return [key, alphas];
}

async function importBigIntAsCryptoKey(bigintKey) {
    try {
        // Convert BigInt to a hex string and pad to at least 64 chars (256-bit)
        let hexKey = bigintKey.toString(16).padStart(64, '0'); 
        
        // Convert hex string to a Uint8Array
        const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        console.log("Generated Key Bytes:", keyBytes);

        // Import key into Web Crypto API as AES-GCM key
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM", length: 256 }, // AES-256
            true,
            ["encrypt", "decrypt"]
        );

        console.log("CryptoKey imported successfully:", cryptoKey);
        return cryptoKey;
    } catch (error) {
        console.error("Error importing CryptoKey:", error);
        throw error;
    }
}

function pointToBigint(point) {
    return mod(BigInt("0x" + point.toHex()), FIELD_ORDER);
}
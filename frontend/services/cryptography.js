import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";

const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffffffffff");

function randomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}

export function generateBLSKeyPair() {
    const skBytes = randomBytes(32);
    const sk = BigInt("0x" + Buffer.from(skBytes).toString("hex")); // Private key
    const pk = bls12_381.G1.ProjectivePoint.fromPrivateKey(sk); // Public key
    return { sk, pk };
}

export function getPublicKeyFromPrivate(privateKey) {
    const sk = typeof privateKey === 'string' ? BigInt("0x" + privateKey) : privateKey;
    const publicKey = bls12_381.G1.ProjectivePoint.fromPrivateKey(sk);
    return publicKey.toHex(true);
}

export function getG1PointsFromPublicKey(publicKey) {
    const compressedPkBytes = Uint8Array.from(Buffer.from(publicKey, "hex"));
    const g1Point = bls12_381.G1.ProjectivePoint.fromHex(compressedPkBytes);
    const px = g1Point.px;
    const py = g1Point.py;
    return [px, py];
}

export function generateEncryptionKey() {
    const privateKey = bls12_381.utils.randomPrivateKey();
    const privateKeyHex = Buffer.from(privateKey).toString('hex');
    return privateKeyHex
}

export async function getKAndSecretShares(pubkeys, threshold, total) {
    const indexes = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    const tIndexes = indexes.slice(0, threshold);
    const restIndexes = indexes.slice(threshold);
    const tPubkeys = pubkeys.slice(0, threshold);
    const restPubkeys = pubkeys.slice(threshold);

    const r = genR();
    const [k, alphas] = await getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys);

    // const shares = pubkeys.map((pubkey) => {
    //     const pkr = computePkRValue(pubkey, r);
    //     return pointToBigint(pkr).toString();
    // });

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

export async function generateSecret(share, privateKey) {
    // Convert share and private key to BigInt

    const shareBigIntValue = BigInt('0x' + share);
    const keyBigIntValue = BigInt('0x' + privateKey);

    const privateKeyBigInt = BigInt(keyBigIntValue);
    const shareBigInt = BigInt(shareBigIntValue);
    const secrets = []
    secrets.push(shareBigInt * privateKeyBigInt);
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

    const basis = lagrangeBasis(tIndexes, BigInt(0));
    const k = lagrangeInterpolate(basis, tShares);
    const key = await importBigIntAsCryptoKey(k);

    const restShares = restPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

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
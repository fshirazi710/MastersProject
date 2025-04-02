import { bls12_381 } from "@noble/curves/bls12-381";
import { mod } from "@noble/curves/abstract/modular";
import { Buffer } from "buffer";
import { bls } from "@noble/curves/abstract/bls";
import { babelParse } from "vue/compiler-sfc";

const FIELD_ORDER = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

export function generateBLSKeyPair() {
    // Use the library utility to generate a cryptographically secure private key (Uint8Array)
    // This ensures the key is valid and < CURVE_ORDER, preventing scalar errors.
    const skBytes = bls12_381.utils.randomPrivateKey(); 
    // Convert the valid private key bytes to a BigInt for multiplication
    const skBigInt = BigInt("0x" + Buffer.from(skBytes).toString("hex")); 
    // Calculate the public key Point object
    const pkPoint = bls12_381.G1.ProjectivePoint.BASE.multiply(skBigInt); 
    // Return the BigInt secret key and the ProjectivePoint public key object
    // (Changed from returning raw Uint8Array public key)
    return { sk: skBigInt, pk: pkPoint }; 
}

export function getPublicKeyFromPrivate(privateKey) {
    // Ensure private key is a BigInt
    const sk = typeof privateKey === 'string' ? BigInt("0x" + privateKey) : privateKey;
    // Calculate the public key Point object
    const pkPoint = bls12_381.G1.ProjectivePoint.BASE.multiply(sk);
    // Return the standard hexadecimal string representation of the public key
    // (Changed from returning raw Uint8Array to ensure consistency)
    return pkPoint.toHex(); 
}

function genR() {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    const hexString = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return mod(BigInt("0x" + hexString), FIELD_ORDER);
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

function randomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
}

function bigIntToHex(bigInt) {
    let hex = bigInt.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hex;
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function pointToBigint(point) {
    return mod(BigInt("0x" + point.toHex()), FIELD_ORDER);
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
    const iv = hexToBytes(encryptedHex.slice(0, 24));
    const ciphertext = hexToBytes(encryptedHex.slice(24));

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt({ 
            name: "AES-GCM", 
            iv 
        }, key, ciphertext);

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Decryption failed");
    }
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

export function generateShares(g1r_hex, privateKey) {
    const bigIntPrivateKey = BigInt("0x" + privateKey); 
    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);
    const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
    const result = g1r_point.multiply(modBigIntPrivateKey);
    return bigIntToHex(pointToBigint(result))
}

export function generateShares2(g1r_hex, privateKey) {
    const bigIntPrivateKey = BigInt("0x" + privateKey); 
    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);
    const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
    const result = g1r_point.multiply(modBigIntPrivateKey);
    console.log(result.toRawBytes(true))
    return bytesToHex(result.toRawBytes(true)); // Compressed form (48 bytes)
}

export function verifyShares(share, share2, publicKey, g2r) {
    // const sharePoint = bls12_381.G1.ProjectivePoint.BASE.multiply(BigInt("0x" + share2))
    // const shareBytes = hexToBytes(bigIntToHex(pointToBigint(sharePoint)))

    const publicKeyAffine = bls12_381.G1.ProjectivePoint.fromHex(publicKey);
    const shareAffine = bls12_381.G1.ProjectivePoint.fromHex(share2);
    const g2rAffine = bls12_381.G2.ProjectivePoint.fromHex(g2r);

    const pairing1 = bls12_381.pairing(shareAffine, bls12_381.G2.ProjectivePoint.BASE);
    const pairing2 = bls12_381.pairing(publicKeyAffine, g2rAffine);

    console.log(pairing1)
    console.log(pairing2)

    return pairing1 === pairing2;
}

export async function recomputeKey(indexes, shares, alphas, threshold) {
    const bigIntIndexes = indexes.map(index => BigInt(index));

    const tIndexes = bigIntIndexes.slice(0, threshold);
    const basis = lagrangeBasis(tIndexes, BigInt(0));

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
    console.log(k)
    const key = await importBigIntAsCryptoKey(k);

    return key;
}

function computePkRValue(pubkey, r) {
    // Remove "0x" prefix if present, as fromHex expects raw hex digits
    const hexString = pubkey.startsWith('0x') ? pubkey.slice(2) : pubkey;
    // Pass the raw hex string to fromHex
    const pkPoint = bls12_381.G1.ProjectivePoint.fromHex(hexString); 
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

function modInverse(a, m) {
    a = (a % m + m) % m;

    const s = [];
    let b = m;

    while (b) {
        [a, b] = [b, a % b];
        s.push({ a, b });
    }

    let x = BigInt(1);
    let y = BigInt(0);

    for (let i = s.length - 2; i >= 0; --i) {
        [x, y] = [y, x - y * BigInt(s[i].a / s[i].b)];
    }

    return (y % m + m) % m;
}

function lagrangeInterpolate(basis, shares) {
    return shares.reduce((acc, share, i) => 
        mod(acc + mod(share * basis[i], FIELD_ORDER), FIELD_ORDER), 
        BigInt(0)
    );
}

async function getKAndAlphas(r, tIndexes, tPubkeys, restIndexes, restPubkeys) {
    const tShares = tPubkeys.map((pubkey) => {
        const pkr = computePkRValue(pubkey, r);
        return pointToBigint(pkr);
    });

    console.log(tShares)
    const basis = lagrangeBasis(tIndexes, BigInt(0));
    const k = lagrangeInterpolate(basis, tShares);
    console.log(k)
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

        const i_alpha = BigInt("0x" + Buffer.from(i_point_bytes.map((byte, i) => byte ^ i_share_bytes[i])).toString("hex"));
        alphas.push(i_alpha.toString());
    }

    return [key, alphas];
}

async function importBigIntAsCryptoKey(bigintKey) {
    try {
        let hexKey = bigintKey.toString(16).padStart(64, '0'); 
        
        const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM", length: 256 }, // AES-256
            true,
            ["encrypt", "decrypt"]
        );

        return cryptoKey;
    } catch (error) {
        console.error("Error importing CryptoKey:", error);
        throw error;
    }
}

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

    const g1r = getG1R(r)

    const g2r = getG2R(r)

    return [k, g1r, g2r, alphas];
}

function getG1R(r) {
    const g1 = bls12_381.G1.ProjectivePoint.BASE;
    const result = g1.multiply(r);
    return result.toHex();
}

export function hexToG1R(hex, privateKey) {
    const r = BigInt("0x" + privateKey); 
    const r2 = mod(r, FIELD_ORDER);
    const g1r = bls12_381.G1.ProjectivePoint.fromHex(hex);
    const result = g1r.multiply(r2);
    return result;
}

export function generateShares(g1r_hex, privateKey) {
    const bigIntPrivateKey = BigInt("0x" + privateKey); 
    const modBigIntPrivateKey = mod(bigIntPrivateKey, FIELD_ORDER);
    const g1r_point = bls12_381.G1.ProjectivePoint.fromHex(g1r_hex);
    const result = g1r_point.multiply(modBigIntPrivateKey);
    return pointToBigint(result)
}

// export function getShares(g1r, sk) {
//      const scalar = Uint8Array.from(Buffer.from(sk, 'hex'));
//      const modScalar = mod(scalar, FIELD_ORDER);
//      const point = bls12_381.G1.ProjectivePoint.fromHex(g1r);
//      const result = point.multiply(scalar);
//      return result.toHex(); // Return the result as a hex string
// }

function getG2R(r) {
    const g2 = bls12_381.G2.ProjectivePoint.BASE;
    const result = g2.multiply(r);
    return result.toHex();
}

function xorBytes(arr1, arr2) {
    return arr1.map((byte, i) => byte ^ arr2[i]);
}

export async function recomputeKey(indexes, shares, alphas, threshold) {
    // Convert indexes to BigInt for Lagrange basis computation
    const bigIntIndexes = indexes.map(index => BigInt(index));

    // Step 1: Compute the Lagrange basis for x = 0 using the indexes above the threshold
    const tIndexes = bigIntIndexes.slice(0, threshold);  // Only indexes above the threshold
    const basis = lagrangeBasis(tIndexes, BigInt(0));  // Compute the Lagrange basis at x = 0
    console.log("Lagrange Basis:", basis);

    const terms = [];

    // Step 2: Only process shares above the threshold
    for (let i = 0; i < threshold; i++) {
        // console.log("Processing share", i);
        // console.log("Shares[i]:", shares[i])

        // // const term = pointToBigint(shares[i])
        // // console.log(pointToBigint(shares[i]))

        // const shareBytes = Uint8Array.from(Buffer.from(shares[i].toString(16), "hex"));
        // // // const shareBytes = scalarToBytes(shares[i]);
        // console.log("Shares[i] bytes:", shareBytes)
        // const term = BigInt('0x' + Buffer.from(shareBytes).toString('hex'));
        terms.push(shares[i])

    }

    for (let i = threshold; i < shares.length; i++) {
        console.log("Processing share", i);

        // Convert Scalar (share) to bytes (we assume a function scalarToBytes exists)
        const alphaBytes = hexToBytes(alphas[i - threshold]); // Alphas start from the threshold
        const shareBytes = hexToBytes(shares[i]);

        console.log(alphaBytes)
        console.log(shareBytes)
        // XOR the two byte arrays to mask/unmask the share with the alpha
        const xorResult = xorBytes(alphaBytes, shareBytes);

        // Convert XOR result back to BigInt (equivalent to Scalar::from_bytes in Rust)
        const term = BigInt('0x' + Buffer.from(xorResult).toString('hex')); // Convert to BigInt from XORed bytes
        terms.push(term);
    }

    console.log("Transformed Shares:", terms);

    // Step 3: Perform Lagrange interpolation using the basis and transformed shares
    const k = lagrangeInterpolate(basis, terms); // Interpolate to find the key
    console.log("Reconstructed Key (k):", k);
    const key = await importBigIntAsCryptoKey(k);

    return key; // Return the reconstructed key (k)
}

function scalarToBytes(scalar) {
    // Convert the scalar (BigInt) to a byte array
    const hexString = scalar.toString(16); // Convert BigInt to a hexadecimal string
    const hexLength = hexString.length;

    // Ensure the length is even by padding with a leading zero if necessary
    const paddedHex = hexLength % 2 === 0 ? hexString : '0' + hexString;

    // Convert the hex string to a byte array
    const byteArray = new Uint8Array(paddedHex.length / 2);
    for (let i = 0; i < paddedHex.length; i += 2) {
        byteArray[i / 2] = parseInt(paddedHex.slice(i, i + 2), 16); // Convert each pair of hex digits to a byte
    }

    return byteArray;
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
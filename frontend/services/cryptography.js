import { bls12_381 } from "@noble/curves/bls12-381";
import { Buffer } from "buffer"; // Needed for conversion

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
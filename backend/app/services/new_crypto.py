import functools
from Crypto.Cipher import AES
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from Crypto.Random import get_random_bytes
from typing import List
import hashlib
import logging

# Configure logging
logger = logging.getLogger(__name__)
FIELD_ORDER = int("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001", 16)

# Convert string to BigInt (in Python, it's just int)
def string_to_bigint(s: str) -> int:
    return int(s, 16)

# Convert BigInt (in Python, it's just int) to hex string
def bigint_to_hex(x: int) -> str:
    return hex(x)[2:]  # remove the '0x' prefix

# Convert hex string to bytes
def hex_to_bytes(hex_str: str) -> bytes:
    return bytes.fromhex(hex_str)

# XOR operation on two byte arrays
def xor_bytes(bytes1: bytes, bytes2: bytes) -> bytes:
    return bytes(a ^ b for a, b in zip(bytes1, bytes2))

# Utility function for modular arithmetic
def mod(x: int, mod_value: int) -> int:
    return x % mod_value

# Modular inverse using Python's pow function (using extended Euclidean algorithm)
def mod_inverse(a: int, m: int) -> int:
    return pow(a, m - 2, m)  # Assuming m is prime

# Example point-to-bigint function (using your custom logic)
def point_to_bigint(point):
    return mod(int(point, 16), FIELD_ORDER)  # Assuming `point` is in hex string format for simplicity

# Lagrange basis calculation (modular)
def lagrange_basis(indexes: List[int], x: int) -> List[int]:
    basis = []
    for i in indexes:
        numerator = 1
        denominator = 1

        for j in indexes:
            if i != j:
                numerator = mod(numerator * (x - j), FIELD_ORDER)
                denominator = mod(denominator * (i - j), FIELD_ORDER)

        # Modular inverse of denominator and multiplying with numerator
        basis_value = mod(numerator * mod_inverse(denominator, FIELD_ORDER), FIELD_ORDER)
        basis.append(basis_value)

    return basis

# Lagrange interpolation to get the key
def lagrange_interpolate(basis: List[int], shares: List[int]) -> int:
    result = 0
    for i in range(len(shares)):
        result = mod(result + mod(shares[i] * basis[i], FIELD_ORDER), FIELD_ORDER)

    return result

# Recompute Key function
async def recompute_key(indexes: List[int], shares: List[int], alphas: List[int], threshold: int):
    # Convert indexes to BigInt (int in Python)
    big_int_indexes = [int(index) for index in indexes]

    t_indexes = big_int_indexes[:threshold]
    basis = lagrange_basis(t_indexes, 0)

    terms = []

    for i in range(len(indexes)):
        if indexes[i] <= threshold:
            terms.append(shares[i])
        else:
            alpha_big_int = string_to_bigint(alphas[indexes[i] - 1 - threshold])
            share_hex = bigint_to_hex(shares[i])
            alpha_hex = bigint_to_hex(alpha_big_int)

            # Convert share and alpha to bytes
            alpha_bytes = hex_to_bytes(alpha_hex)
            share_bytes = hex_to_bytes(share_hex)

            # Perform XOR between the alpha and share
            xor_result = xor_bytes(alpha_bytes, share_bytes)

            # Convert XOR result back to BigInt
            term = int.from_bytes(xor_result, byteorder='big')
            terms.append(term)

    # Perform Lagrange interpolation
    k = lagrange_interpolate(basis, terms)
    # Assuming you have a function to import the BigInt as a crypto key
    key = import_bigint_as_crypto_key(k)

    return key

def import_bigint_as_crypto_key(bigint_key):
    try:
        hex_key = hex(bigint_key)[2:].zfill(64)
        
        key_bytes = bytes.fromhex(hex_key)

        return key_bytes
    except Exception as e:
        print(f"Error importing CryptoKey: {e}")
        raise

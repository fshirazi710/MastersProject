from typing import List, Tuple, Optional
import secrets
from py_ecc.bn128 import G1, G2, multiply, add, curve_order, pairing
from py_ecc.fields import optimized_bn128_FQ as FQ
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.exceptions import InvalidTag
import hashlib
import os
import time
import struct
import logging

logger = logging.getLogger(__name__)

class CryptoService:
    def __init__(self):
        # Initialize BLS12-381 curve parameters
        self.curve_order = curve_order
        self.g1_generator = G1
        self.g2_generator = G2
        # Initialize AESGCM with a salt for key derivation
        self.salt = os.urandom(16)
        # Initialize nonce counter
        self._nonce_counter = 0


    # def decrypt_vote(self, ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
    #     """Decrypt vote data using AES-GCM.
    #     Args:
    #         ciphertext: The encrypted vote data
    #         key: The decryption key
    #         nonce: The nonce used for encryption
    #     Returns: The decrypted vote data"""
    #     # Derive the key
    #     derived_key = self._derive_key(key)
        
    #     # Create AES-GCM instance
    #     aesgcm = AESGCM(derived_key)
        
    #     try:
    #         # Decrypt the vote
    #         return aesgcm.decrypt(nonce, ciphertext, None)
    #     except InvalidTag:
    #         raise ValueError("Invalid key or corrupted ciphertext")

    # def verify_share(self, share: Tuple[FQ, FQ], public_key: Tuple[FQ, FQ], g2r: Tuple[FQ, FQ]) -> bool:
    #     """Verify a share using BLS12-381 pairing.
    #     Args:
    #         share: The share to verify (G1 point)
    #         public_key: The public key of the share holder (G1 point)
    #         g2r: The G2 point used for verification
    #     Returns: True if share is valid, False otherwise"""
    #     try:
    #         # Ensure points are in the correct format
    #         if not isinstance(share[0], FQ) or not isinstance(share[1], FQ):
    #             share = (FQ(share[0]), FQ(share[1]))
                
    #         if not isinstance(public_key[0], FQ) or not isinstance(public_key[1], FQ):
    #             public_key = (FQ(public_key[0]), FQ(public_key[1]))
                
    #         if not isinstance(g2r[0], FQ) or not isinstance(g2r[1], FQ):
    #             g2r = (FQ(g2r[0]), FQ(g2r[1]))
            
    #         # Perform pairing check: e(share, G2) = e(PK, g2r)
    #         left_pairing = pairing(share, self.g2_generator)
    #         right_pairing = pairing(public_key, g2r)
            
    #         return left_pairing == right_pairing
    #     except Exception as e:
    #         logger.error(f"Error in share verification: {e}")
    #         return False

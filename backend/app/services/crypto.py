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

    def _derive_key(self, key: bytes) -> bytes:
        """Derive a key suitable for AES-GCM using PBKDF2.
        Args:
            key: The input key
        Returns: A derived key"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits
            salt=self.salt,
            iterations=100000,
        )
        return kdf.derive(key)

    def _generate_nonce(self) -> bytes:
        """Generate a unique nonce for AES-GCM encryption.
        The nonce is composed of:
        - 4 bytes timestamp (seconds since epoch)
        - 4 bytes counter
        - 4 bytes random bytes
        Returns: A 12-byte nonce"""
        # Get current timestamp (4 bytes)
        timestamp = struct.pack('>I', int(time.time()))
        
        # Increment and get counter (4 bytes)
        self._nonce_counter = (self._nonce_counter + 1) % (1 << 32)
        counter = struct.pack('>I', self._nonce_counter)
        
        # Generate random bytes (4 bytes)
        random_bytes = os.urandom(4)
        
        # Combine all components
        return timestamp + counter + random_bytes

    def scalar_to_g1_point(self, scalar: int) -> Tuple[FQ, FQ]:
        """Convert a scalar to a G1 point.
        Args:
            scalar: The scalar to convert
        Returns: A G1 point"""
        return multiply(self.g1_generator, scalar)

    def scalar_to_g2_point(self, scalar: int) -> Tuple[FQ, FQ]:
        """Convert a scalar to a G2 point.
        Args:
            scalar: The scalar to convert
        Returns: A G2 point"""
        return multiply(self.g2_generator, scalar)

    def generate_keypair(self) -> Tuple[int, Tuple[FQ, FQ]]:
        """Generate a BLS12-381 keypair.
        Returns: (private_key, public_key)"""
        private_key = secrets.randbelow(self.curve_order)
        public_key = multiply(self.g1_generator, private_key)
        return private_key, public_key

    def generate_shares(self, secret: int, num_shares: int, threshold: int) -> List[Tuple[int, int]]:
        """Generate shares of a secret using Lagrange interpolation.
        Args:
            secret: The secret to share
            num_shares: Number of shares to generate
            threshold: Number of shares needed to reconstruct
        Returns: List of (index, share) tuples"""
        if threshold > num_shares:
            raise ValueError("Threshold cannot be greater than number of shares")
            
        # Generate random polynomial coefficients
        coeffs = [secret] + [secrets.randbelow(self.curve_order) for _ in range(threshold - 1)]
        
        # Generate shares
        shares = []
        for i in range(1, num_shares + 1):
            share = 0
            for j, coeff in enumerate(coeffs):
                share = (share + coeff * pow(i, j, self.curve_order)) % self.curve_order
            shares.append((i, share))
        
        return shares

    def reconstruct_secret(self, shares: List[Tuple[int, int]]) -> int:
        """Reconstruct secret from shares using Lagrange interpolation.
        Args:
            shares: List of (index, share) tuples
        Returns: The reconstructed secret"""
        if not shares:
            raise ValueError("No shares provided")
            
        # Check if we have enough shares
        if len(shares) < 2:  # Need at least 2 shares for reconstruction
            raise ValueError("Insufficient shares for reconstruction")
            
        secret = 0
        for i, (xi, yi) in enumerate(shares):
            numerator = 1
            denominator = 1
            for j, (xj, _) in enumerate(shares):
                if i != j:
                    numerator = (numerator * (-xj)) % self.curve_order
                    denominator = (denominator * (xi - xj)) % self.curve_order
            
            # Compute Lagrange coefficient
            lagrange_coeff = (numerator * pow(denominator, -1, self.curve_order)) % self.curve_order
            secret = (secret + (yi * lagrange_coeff) % self.curve_order) % self.curve_order
            
        return secret

    def encrypt_vote(self, vote_data: bytes, key: bytes) -> Tuple[bytes, bytes]:
        """Encrypt vote data using AES-GCM.
        Args:
            vote_data: The vote data to encrypt
            key: The encryption key
        Returns: (ciphertext, nonce)"""
        # Derive a key suitable for AES-GCM
        derived_key = self._derive_key(key)
        
        # Create AES-GCM instance
        aesgcm = AESGCM(derived_key)
        
        # Generate a unique nonce
        nonce = self._generate_nonce()
        
        # Encrypt the vote
        ciphertext = aesgcm.encrypt(nonce, vote_data, None)
        
        return ciphertext, nonce

    def decrypt_vote(self, ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
        """Decrypt vote data using AES-GCM.
        Args:
            ciphertext: The encrypted vote data
            key: The decryption key
            nonce: The nonce used for encryption
        Returns: The decrypted vote data"""
        # Derive the key
        derived_key = self._derive_key(key)
        
        # Create AES-GCM instance
        aesgcm = AESGCM(derived_key)
        
        try:
            # Decrypt the vote
            return aesgcm.decrypt(nonce, ciphertext, None)
        except InvalidTag:
            raise ValueError("Invalid key or corrupted ciphertext")

    def verify_share(self, share: Tuple[FQ, FQ], public_key: Tuple[FQ, FQ], g2r: Tuple[FQ, FQ]) -> bool:
        """Verify a share using BLS12-381 pairing.
        Args:
            share: The share to verify
            public_key: The public key of the share holder
            g2r: The G2 point used for verification
        Returns: True if share is valid, False otherwise"""
        try:
            # Convert points to the correct format for pairing
            share_point = (FQ(share[0]), FQ(share[1]))
            public_key_point = (FQ(public_key[0]), FQ(public_key[1]))
            g2r_point = (FQ(g2r[0]), FQ(g2r[1]))
            
            # Perform pairing check
            return pairing(share_point, self.g2_generator) == pairing(public_key_point, g2r_point)
        except (TypeError, ValueError):
            return False

    def hash_to_scalar(self, data: bytes) -> int:
        """Hash data to a scalar value.
        Args:
            data: The data to hash
        Returns: A scalar value"""
        hash_bytes = hashlib.sha256(data).digest()
        return int.from_bytes(hash_bytes, 'big') % self.curve_order 
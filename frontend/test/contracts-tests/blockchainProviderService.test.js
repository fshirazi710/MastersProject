import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { blockchainProviderService } from '../../services/blockchainProvider.js';
import { provider, deployerSigner, userSigner } from '../setup.js';

describe('BlockchainProviderService', () => {
    beforeEach(async () => {
        // Directly set the provider for testing purposes
        blockchainProviderService.provider = provider;
        // Manually set chainId as the constructor's async call might not complete in time for sync tests
        const network = await provider.getNetwork();
        blockchainProviderService.chainId = network.chainId.toString();
        // Ensure signer is reset before each test
        await blockchainProviderService.setSigner(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Provider and Signer Management', () => {
        it('should have an initialized provider', () => {
            expect(blockchainProviderService.getProvider()).toBeDefined();
            expect(blockchainProviderService.getProvider()).toBe(provider);
        });

        it('should allow setting and getting a signer', async () => {
            await blockchainProviderService.setSigner(deployerSigner);
            expect(blockchainProviderService.getSigner()).toBe(deployerSigner);
            expect(blockchainProviderService.getAccount()).toBe(deployerSigner.address);
        });

        it('should return the correct signer address', async () => {
            await blockchainProviderService.setSigner(userSigner);
            const address = blockchainProviderService.getAccount();
            expect(address).toBe(userSigner.address);
        });

        it('should return undefined if no signer is set', async () => {
            await blockchainProviderService.setSigner(null); // Explicitly set to null
            expect(blockchainProviderService.getSigner()).toBeNull();
            const address = blockchainProviderService.getAccount(); // Should be null after signer is cleared
            expect(address).toBeNull(); // Changed from toBeUndefined to toBeNull as per setSigner logic
        });

        it('should return the connected chain ID', async () => {
            const chainId = blockchainProviderService.getChainId(); // getChainId is synchronous
            // Hardhat default chain ID is 31337
            expect(chainId).toBe("31337"); // Compare string to string
        });
    });

    describe('Utility Functions', () => {
        it('hashMessage should correctly hash a string message', () => {
            const message = "Hello Vitest";
            const expectedHash = ethers.id(message); // ethers.id is equivalent to keccak256(ethers.toUtf8Bytes(message))
            expect(blockchainProviderService.hashMessage(message)).toBe(expectedHash);
        });

        it('formatEther should correctly format Wei to Ether string', () => {
            const weiValue = ethers.parseEther("1.234"); // 1.234 ETH in Wei
            expect(blockchainProviderService.formatEther(weiValue)).toBe("1.234");
        });

        it('formatEther should handle zero Wei', () => {
            expect(blockchainProviderService.formatEther(0n)).toBe("0.0");
        });

        it('parseEther should correctly parse an Ether string to Wei BigInt', () => {
            const etherString = "0.5";
            const expectedWei = ethers.parseEther(etherString);
            expect(blockchainProviderService.parseEther(etherString)).toBe(expectedWei);
        });

        it('parseEther should handle whole numbers', () => {
            const etherString = "10";
            const expectedWei = ethers.parseEther(etherString);
            expect(blockchainProviderService.parseEther(etherString)).toBe(expectedWei);
        });

        it('parseEther should throw for invalid ether string', () => {
            expect(() => blockchainProviderService.parseEther("invalid-ether-string")).toThrow();
        });
    });

    // More tests to come for:
    // - Network change detection
    // - Contract interaction utilities (getContractInstance, readContract, sendTransaction)
    // - Event handling helpers
    // - Utility functions (hashMessage, Wei/Ether conversions)
}); 
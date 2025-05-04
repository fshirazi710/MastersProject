import { defineConfig } from 'vitest/config'
import path from 'path'
// import tsconfigPaths from 'vite-tsconfig-paths' // Remove plugin import

// Remove logging
// const resolvedBasePath = path.resolve(__dirname);
// console.log('[vitest.config.js] Resolved Base Path (__dirname):', resolvedBasePath);
// const aliasConfig = [
//   { find: '~', replacement: resolvedBasePath },
//   { find: '@', replacement: resolvedBasePath }
// ];
// console.log('[vitest.config.js] Alias Config:', JSON.stringify(aliasConfig));

export default defineConfig({
  // plugins: [tsconfigPaths()], // Remove plugin
  root: __dirname, // Explicitly set the root directory
  test: {
    environment: 'node', // Use Node.js environment for backend/ethers interaction
    globals: true, // Use global APIs like describe, it, expect
    setupFiles: ['./test/setup.js'], // Optional setup file (we'll create this next)
    // alias: aliasConfig, // Remove alias config
    deps: {
      // Try inlining local service files
      inline: [
        // Match files within the services directory
        /\/services\//, 
        // Or be more specific if needed:
        // /\/services\/ethersBase\.js/,
        // /\/services\/contracts\//,
      ],
    }
  },
}) 
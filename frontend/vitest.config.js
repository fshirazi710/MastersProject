import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue' // Required for Vue 3 Single File Components

export default defineConfig({
  plugins: [
    vue(), // Use the Vue plugin
  ],
  test: {
    globals: true, // Use Vitest global APIs (describe, it, expect, etc.)
    environment: 'jsdom', // Use jsdom environment for browser-like testing (or 'happy-dom')
    // Optional: Configure coverage reporting
    // coverage: {
    //   provider: 'v8', // or 'istanbul'
    //   reporter: ['text', 'json', 'html'],
    // },
    // Optional: Set up files
    // setupFiles: ['./test/setup.js'], // Example setup file path
  },
  server: {
    deps: {
      inline: ['ethers'],
    },
  },
})
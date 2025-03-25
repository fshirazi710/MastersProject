export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['@/assets/styles/main.scss'],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use '@/assets/styles/_variables' as *;
            @use '@/assets/styles/_mixins' as *;
          `
        }
      }
    },
    build: {
      rollupOptions: {
        external: ['js-cookie'],
      },
    },
  },
});

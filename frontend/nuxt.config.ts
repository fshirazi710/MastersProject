// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['@/assets/styles/main.scss'],
  vite: {
    plugins: [],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use '@/assets/styles/_variables' as *;
            @use '@/assets/styles/_mixins' as *;
          `
        }
      }
    }
  }
})

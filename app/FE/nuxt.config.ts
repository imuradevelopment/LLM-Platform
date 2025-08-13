// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'src',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.API_BASE_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
      basicAuthUser: process.env.BASIC_AUTH_USER || '',
      basicAuthPass: process.env.BASIC_AUTH_PASS || '',
    },
  },
});



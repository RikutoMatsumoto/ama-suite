// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
  ],

  // Rails APIのベースURL（環境変数で切り替え可能）
  runtimeConfig: {
    // ここ（publicの外）に書いたものはサーバー側でしか見えない「秘密の設定」
    // .env の NUXT_STRIPE_SECRET_KEY / NUXT_STRIPE_WEBHOOK_SECRET が自動で入る
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      // Firebase設定（.envから読み込む）
      // apiKeyという名前だが「公開してよい識別子」であり秘密鍵ではない
      // 注意：Cloud Functionsの環境変数は "FIREBASE_" プレフィックスを予約語として
      // 使えないため、Nuxt標準の "NUXT_PUBLIC_" 命名規則に合わせている
      firebase: {
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
      },
    },
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})

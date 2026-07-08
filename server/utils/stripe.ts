// ============================================================
// Stripeクライアント（サーバー専用）
//
// 【シークレットキーの扱い】
// sk_test_... / sk_live_... のキーは絶対にブラウザに渡さない。
// runtimeConfig（publicの外）に置いているので、
// サーバー側のコードからしか参照できない。
// ============================================================

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function stripe() {
  if (!stripeClient) {
    const config = useRuntimeConfig()

    if (!config.stripeSecretKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Stripeの設定がされていません',
      })
    }

    stripeClient = new Stripe(config.stripeSecretKey)
  }
  return stripeClient
}

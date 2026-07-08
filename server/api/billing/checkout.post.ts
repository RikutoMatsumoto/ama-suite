// ============================================================
// Stripe Checkout Session 作成API
//
// 【流れ】
// ① ログイン済みユーザーがプランを選ぶ（認可チェック付き）
// ② StripeにCheckout Session（決済ページ）を作ってもらう
// ③ そのページのURLを返す → フロントがリダイレクト
// ④ カード入力などはStripeのページ側で完結
//    （カード情報がうちのサーバーを通らない＝PCI DSS対応不要）
// ============================================================

// プラン定義（LPの料金表と対応）
// 金額をフロントから受け取らずサーバー側に持つのがポイント
// （フロントから金額を送らせると改ざんされる恐れがある）
const PLANS = {
  starter: { name: 'スタータープラン', amount: 3000 },
  standard: { name: 'スタンダードプラン', amount: 5000 },
  pro: { name: 'プロプラン', amount: 9800 },
} as const

type PlanId = keyof typeof PLANS

export default defineEventHandler(async (event) => {
  // ログイン必須（未ログインは401）
  const uid = await requireAuth(event)

  const body = await readBody<{ plan: PlanId }>(event)
  const plan = PLANS[body.plan]

  if (!plan) {
    throw createError({ statusCode: 400, statusMessage: '不正なプランです' })
  }

  // リダイレクト先URL（現在のホストから組み立てる）
  const origin = getHeader(event, 'origin') ?? 'http://localhost:3000'

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription', // サブスク（月額課金）
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          unit_amount: plan.amount,
          recurring: { interval: 'month' },
          product_data: { name: `AmaSuite ${plan.name}` },
        },
        quantity: 1,
      },
    ],
    // 決済完了/キャンセル時に戻ってくるURL
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#pricing`,
    // どのユーザーの決済か、Webhookで特定するための紐付け
    client_reference_id: uid,
    metadata: { uid, plan: body.plan },
  })

  return { url: session.url }
})

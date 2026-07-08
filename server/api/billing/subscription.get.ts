// ============================================================
// 契約状態の取得API（認可チェック付き）
//
// GET /api/billing/subscription
// Stripe決済後にWebhookがFirestoreへ保存した契約状態を返す。
// 未契約なら status: 'none' を返す。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('billing').doc('subscription')
    .get()

  if (!doc.exists) {
    return { status: 'none', plan: null }
  }

  const data = doc.data()!
  return {
    status: data.status ?? 'none',
    plan: data.plan ?? null,
  }
})

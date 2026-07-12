// ============================================================
// 契約状態の取得API（認可チェック付き）
//
// GET /api/billing/subscription
// ・status / plan … Stripe契約の生の状態（従来互換）
// ・resolved      … トライアル判定込みの「実際に適用されるプランと制限」
//                   フロントはこちらを見て表示・案内する
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('billing').doc('subscription')
    .get()

  const data = doc.exists ? doc.data()! : null

  // トライアル・期限切れも含めた最終的なプラン判定（server/utils/plan.ts）
  const resolved = await resolvePlan(uid)

  return {
    status: data?.status ?? 'none',
    plan: data?.plan ?? null,
    resolved,
  }
})

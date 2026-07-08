// ============================================================
// 注文一覧取得API（認可チェック付き）
//
// GET /api/orders
// 自分の注文履歴を新しい順に最大50件返す。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const snap = await adminFirestore()
    .collection('users').doc(uid)
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  const orders = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }))

  return { orders }
})

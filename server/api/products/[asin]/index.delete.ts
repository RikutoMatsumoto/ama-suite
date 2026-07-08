// ============================================================
// 商品削除API（認可チェック付き）
//
// DELETE /api/products/:asin
// 本人の商品だけを削除できる。商品に紐づくメモも一緒に削除する。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const userRef = adminFirestore().collection('users').doc(uid)

  // 商品本体と、紐づくメモをまとめて削除
  await Promise.all([
    userRef.collection('products').doc(asin).delete(),
    userRef.collection('memos').doc(asin).delete(),
  ])

  return { deleted: asin }
})

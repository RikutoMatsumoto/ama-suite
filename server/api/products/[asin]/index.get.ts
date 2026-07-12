// ============================================================
// 商品1件の取得API（認可チェック付き）
//
// GET /api/products/:asin
//
// 商品詳細ページのヘッダー（商品名・現在価格）に使う。
// 一覧APIを全件取って探すより、1件だけ読む方が速くて安い。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)
    .get()

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }

  return { asin, ...doc.data() }
})

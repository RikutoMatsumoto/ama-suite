// ============================================================
// 商品の部分更新API（認可チェック付き）
//
// PATCH /api/products/:asin
// body: { stock?: number }
//
// 【PATCHとは？】
// 「一部だけ更新する」ためのHTTPメソッド。
// POST=作成 / GET=取得 / PATCH=部分更新 / DELETE=削除
// という使い分けが一般的（RESTの慣習）。
// 今は在庫数（stock）の更新に使っている。
// ============================================================

interface PatchBody {
  stock?: number
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const body = await readBody<PatchBody>(event)

  // 更新できる項目をホワイトリスト方式で絞る
  // （送られてきたものを何でも保存すると、profitなどを改ざんされ得るため）
  const updates: Record<string, unknown> = {}

  if (body.stock !== undefined) {
    const stock = Number(body.stock)
    if (!Number.isInteger(stock) || stock < 0) {
      throw createError({ statusCode: 400, statusMessage: '在庫数は0以上の整数で入力してください' })
    }
    updates.stock = stock
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '更新する項目がありません' })
  }

  const docRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)

  // 存在しない商品への更新は404
  const doc = await docRef.get()
  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }

  await docRef.update(updates)

  return { asin, ...doc.data(), ...updates }
})

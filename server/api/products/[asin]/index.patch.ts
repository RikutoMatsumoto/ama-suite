// ============================================================
// 商品の部分更新API（認可チェック付き）
//
// PATCH /api/products/:asin
// body: { stock?: number, costPrice?: number }
//
// 【PATCHとは？】
// 「一部だけ更新する」ためのHTTPメソッド。
// POST=作成 / GET=取得 / PATCH=部分更新 / DELETE=削除
// という使い分けが一般的（RESTの慣習）。
// 在庫数（stock）と仕入れ値（costPrice）の更新に使っている。
// 仕入れ値が変わると利益も変わるので、サーバー側で再計算して保存する
// （フロントからprofitを送らせない＝改ざん防止）。
// ============================================================

// 商品登録API（products/index.post.ts）と同じ手数料率
const FBA_FEE_RATE = 0.10
const AMAZON_FEE_RATE = 0.08

interface PatchBody {
  stock?: number
  costPrice?: number
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const body = await readBody<PatchBody>(event)

  const docRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)

  // 存在しない商品への更新は404（利益の再計算に既存データも必要なので先に取得）
  const doc = await docRef.get()
  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
  }
  const current = doc.data()!

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

  if (body.costPrice !== undefined) {
    const costPrice = Number(body.costPrice)
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw createError({ statusCode: 400, statusMessage: '仕入れ値は0以上の数値で入力してください' })
    }
    updates.costPrice = costPrice

    // 仕入れ値が変わったら利益を再計算（販売価格は既存の値を使う）
    const currentPrice = Number(current.currentPrice ?? 0)
    const fbaFee = Math.round(currentPrice * FBA_FEE_RATE)
    const amazonFee = Math.round(currentPrice * AMAZON_FEE_RATE)
    updates.profit = currentPrice - costPrice - fbaFee - amazonFee
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '更新する項目がありません' })
  }

  await docRef.update(updates)

  return { asin, ...current, ...updates }
})

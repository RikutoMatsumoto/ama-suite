// ============================================================
// 注文記録API（認可チェック付き）
//
// POST /api/orders
// body: { asin, quantity, salePrice }
//
// 【やること】
// ① 登録済み商品かを確認（自分の商品しか記録できない）
// ② 利益を計算（販売価格 − 手数料 − 仕入れ値）× 個数
// ③ 注文として保存
// ④ 在庫を売れた分だけ減らす（0未満にはしない）
// ============================================================

const FBA_FEE_RATE = 0.10
const AMAZON_FEE_RATE = 0.08

interface OrderBody {
  asin: string
  quantity: number
  salePrice: number
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)
  const body = await readBody<OrderBody>(event)

  const asin = (body.asin ?? '').trim().toUpperCase()
  const quantity = Number(body.quantity)
  const salePrice = Number(body.salePrice)

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createError({ statusCode: 400, statusMessage: '個数は1以上の整数で入力してください' })
  }
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw createError({ statusCode: 400, statusMessage: '販売価格は正の数値で入力してください' })
  }

  // ① 自分の商品として登録済みかチェック
  const userRef = adminFirestore().collection('users').doc(uid)
  const productDoc = await userRef.collection('products').doc(asin).get()
  if (!productDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: 'この商品は登録されていません' })
  }
  const product = productDoc.data()!

  // ② 利益計算（1個あたり × 個数）
  const fbaFee = Math.round(salePrice * FBA_FEE_RATE)
  const amazonFee = Math.round(salePrice * AMAZON_FEE_RATE)
  const profitPerUnit = salePrice - Number(product.costPrice ?? 0) - fbaFee - amazonFee
  const profit = profitPerUnit * quantity
  const total = salePrice * quantity

  // ③ 注文を保存（IDは自動採番）
  const order = {
    asin,
    productName: product.productName ?? '',
    quantity,
    salePrice,
    total,
    profit,
    createdAt: new Date().toISOString(),
  }
  const orderRef = await userRef.collection('orders').add(order)

  // ④ 在庫を減らす（0未満にはしない）
  const currentStock = Number(product.stock ?? 0)
  const newStock = Math.max(0, currentStock - quantity)
  await userRef.collection('products').doc(asin).update({ stock: newStock })

  return { id: orderRef.id, ...order, newStock }
})

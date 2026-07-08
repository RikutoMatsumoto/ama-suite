// ============================================================
// 商品登録API（認可チェック付き）
//
// POST /api/products
// body: { asin, productName, currentPrice, costPrice }
//
// 【設計メモ】
// 本来、商品名・現在価格・ランキングは Amazon SP-API / Keepa から
// 自動取得する想定。API連携までは手入力とし、
// 「保存の器（Firestore構造と認可）」を先に完成させている。
//
// 利益はフロントで計算せず、サーバー側で計算して保存する
// （利益計算APIと同じ手数料率を使用）
// ============================================================

const FBA_FEE_RATE = 0.10
const AMAZON_FEE_RATE = 0.08

interface ProductBody {
  asin: string
  productName: string
  currentPrice: number
  costPrice: number
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)
  const body = await readBody<ProductBody>(event)

  // --- バリデーション ---
  const asin = (body.asin ?? '').trim().toUpperCase()
  // ASINは「B0」で始まる10桁の英数字（例: B08N5WRWNW）
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    throw createError({ statusCode: 400, statusMessage: 'ASINは10桁の英数字で入力してください' })
  }

  const productName = (body.productName ?? '').trim()
  if (!productName) {
    throw createError({ statusCode: 400, statusMessage: '商品名を入力してください' })
  }

  const currentPrice = Number(body.currentPrice)
  const costPrice = Number(body.costPrice)
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw createError({ statusCode: 400, statusMessage: '現在価格は正の数値で入力してください' })
  }
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw createError({ statusCode: 400, statusMessage: '仕入れ値は0以上の数値で入力してください' })
  }

  // --- 利益計算（サーバー側で確定させる） ---
  const fbaFee = Math.round(currentPrice * FBA_FEE_RATE)
  const amazonFee = Math.round(currentPrice * AMAZON_FEE_RATE)
  const profit = currentPrice - costPrice - fbaFee - amazonFee

  const product = {
    productName,
    currentPrice,
    costPrice,
    profit,
    createdAt: new Date().toISOString(),
  }

  // ASINをドキュメントIDにする → 同じ商品の二重登録を自然に防げる
  await adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)
    .set(product)

  return { asin, ...product }
})

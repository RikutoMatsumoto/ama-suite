// ============================================================
// 価格履歴取得API（現在はモックデータ／将来Keepa APIに差し替え）
//
// GET /api/products/:asin/price-history?days=90
//
// 【設計意図】
// フロントはこのAPIの形（labels/prices）だけに依存する。
// 将来Keepa連携する時は、この中身をKeepa呼び出しに
// 差し替えるだけで、フロントは一切変更不要になる。
//
// 【モックの作り方】
// ASINの文字から数値の種（シード）を作り、それを元に
// 疑似ランダムな価格変動を生成する。
// → 同じASINなら何度開いても同じグラフになる（デモとして自然）
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  // 期間（90 / 180 / 365日）。不正値は90に丸める
  const query = getQuery(event)
  const days = [90, 180, 365].includes(Number(query.days)) ? Number(query.days) : 90

  // 登録済み商品なら現在価格を基準にする（未登録なら3980円を基準）
  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)
    .get()
  const basePrice = Number(doc.data()?.currentPrice ?? 3980)

  // --- ASINから決定的な疑似乱数を作る ---
  // 文字コードを合計してシードにする → 同じASINは常に同じ変動パターン
  let seed = 0
  for (const ch of asin) seed = (seed * 31 + ch.charCodeAt(0)) % 233280

  // 線形合同法：シンプルな疑似乱数生成器（0〜1を返す）
  function random() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  // --- ランダムウォークで価格系列を生成 ---
  const labels: string[] = []
  const prices: number[] = []
  const now = new Date()

  let price = basePrice * (0.9 + random() * 0.2) // 開始価格は基準の±10%

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)

    // 日々±2%くらい上下しつつ、基準価格に緩やかに引き戻す
    const drift = (basePrice - price) * 0.02
    price = price * (0.98 + random() * 0.04) + drift
    // たまにセール（5%の確率で10%オフ）
    if (random() < 0.05) price = price * 0.9

    prices.push(Math.round(price))
  }

  // 最終日は登録した現在価格に合わせる（画面上の整合性のため）
  if (doc.exists) prices[prices.length - 1] = basePrice

  return {
    labels,
    prices,
    source: 'mock', // フロントで「サンプルデータ」表示に使う。Keepa連携後は 'keepa' に
  }
})

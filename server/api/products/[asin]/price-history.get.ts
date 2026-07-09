// ============================================================
// 価格履歴取得API（Keepa連携・複数系列版）
//
// GET /api/products/:asin/price-history?days=90
//
// 【返すデータ（Keepa本家のグラフに倣った3系列）】
// ・newPrice … マーケットプレイス新品価格（メインの線）
// ・amazon   … Amazon本体の販売価格（本体が売っていない期間は欠損）
// ・rank     … 売れ筋ランキング（右軸・小さいほど売れている）
//
// 【取得の優先順位】
// ① Firestoreキャッシュ（24時間）→ ② Keepa API → ③ モック
// ============================================================

const KEEPA_EPOCH_OFFSET = 21564000 // Keepa時間 → UNIX時間の変換オフセット（分）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_VERSION = 2 // データ形式を変えたらここを上げる（古いキャッシュを無効化）

type Daily = (number | null)[]

interface KeepaSeries {
  labels: string[]
  newPrice: Daily
  amazon: Daily
  rank: Daily
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const query = getQuery(event)
  const days = [90, 180, 365].includes(Number(query.days)) ? Number(query.days) : 90

  // ---------------------------------------------------------
  // ① キャッシュ確認
  // ---------------------------------------------------------
  const cacheRef = adminFirestore().collection('keepaCache').doc(asin)
  const cacheDoc = await cacheRef.get()

  let series: KeepaSeries | null = null

  if (cacheDoc.exists) {
    const cached = cacheDoc.data()!
    const age = Date.now() - new Date(cached.updatedAt).getTime()
    if (age < CACHE_TTL_MS && cached.v === CACHE_VERSION) {
      series = cached as unknown as KeepaSeries
    }
  }

  // ---------------------------------------------------------
  // ② Keepaに問い合わせ
  // ---------------------------------------------------------
  if (!series) {
    series = await fetchFromKeepa(asin)
    if (series) {
      await cacheRef.set({
        v: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        ...series,
      })
    }
  }

  if (series) {
    return {
      labels: series.labels.slice(-days),
      newPrice: forwardFill(series.newPrice.slice(-days)),
      amazon: series.amazon.slice(-days), // 欠損はそのまま（本体が売っていない期間）
      rank: forwardFill(series.rank.slice(-days), true),
      source: 'keepa',
    }
  }

  // ---------------------------------------------------------
  // ③ フォールバック：モック
  // ---------------------------------------------------------
  return generateMock(uid, asin, days)
})

// ============================================================
// Keepa APIから365日分の日次3系列を取得（失敗時 null）
// ============================================================
async function fetchFromKeepa(asin: string): Promise<KeepaSeries | null> {
  const config = useRuntimeConfig()
  if (!config.keepaApiKey) return null

  try {
    const res = await $fetch<{ products?: { csv?: (number[] | null)[] }[] }>(
      'https://api.keepa.com/product',
      {
        query: { key: config.keepaApiKey, domain: 5, asin, history: 1 },
        timeout: 10_000,
      },
    )

    const csv = res.products?.[0]?.csv ?? []
    // Keepaのcsvインデックス: 0=Amazon本体, 1=マケプレ新品, 3=売れ筋ランキング
    const newPrice = toDaily(csv[1])
    const amazon = toDaily(csv[0])
    const rank = toDaily(csv[3])

    // メインの新品価格が無い商品はKeepaデータなしと判断
    if (!newPrice) return null

    // ラベル（365日分の日付）
    const labels: string[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000)
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    }

    return {
      labels,
      newPrice,
      amazon: amazon ?? new Array(365).fill(null),
      rank: rank ?? new Array(365).fill(null),
    }
  } catch {
    return null
  }
}

// [時刻, 値, 時刻, 値, ...] の交互配列 → 365日分の日次配列に変換
// その日の最後の値を採用。値がない日は null
function toDaily(raw: number[] | null | undefined): Daily | null {
  if (!raw || raw.length < 4) return null

  const points: { t: number, v: number }[] = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const t = (raw[i]! + KEEPA_EPOCH_OFFSET) * 60_000
    const v = raw[i + 1]!
    if (v > 0) points.push({ t, v })
  }
  if (points.length === 0) return null

  const daily: Daily = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let idx = 0
  let last: number | null = null
  for (let i = 364; i >= 0; i--) {
    const dayEnd = today.getTime() - i * 86_400_000 + 86_400_000
    while (idx < points.length && points[idx]!.t < dayEnd) {
      last = points[idx]!.v
      idx++
    }
    daily.push(last)
  }
  return daily
}

// null を直前の値で埋める（roundRank=true ならランキング用に整数化）
function forwardFill(values: Daily, roundRank = false): Daily {
  const firstReal = values.find(v => v !== null) ?? null
  let last = firstReal
  return values.map((v) => {
    if (v !== null) last = v
    return last !== null && roundRank ? Math.round(last) : last
  })
}

// ============================================================
// モックデータ生成（Keepaが使えない時の保険）
// ============================================================
async function generateMock(uid: string, asin: string, days: number) {
  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('products').doc(asin)
    .get()
  const basePrice = Number(doc.data()?.currentPrice ?? 3980)

  let seed = 0
  for (const ch of asin) seed = (seed * 31 + ch.charCodeAt(0)) % 233280
  function random() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  const labels: string[] = []
  const prices: number[] = []
  const now = new Date()
  let price = basePrice * (0.9 + random() * 0.2)

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    const drift = (basePrice - price) * 0.02
    price = price * (0.98 + random() * 0.04) + drift
    if (random() < 0.05) price = price * 0.9
    prices.push(Math.round(price))
  }
  if (doc.exists) prices[prices.length - 1] = basePrice

  return {
    labels,
    newPrice: prices,
    amazon: new Array(days).fill(null),
    rank: new Array(days).fill(null),
    source: 'mock',
  }
}

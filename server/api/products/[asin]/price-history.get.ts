// ============================================================
// 価格履歴取得API（Keepa連携版）
//
// GET /api/products/:asin/price-history?days=90
//
// 【データ取得の優先順位】
// ① Firestoreキャッシュ（24時間以内に取得済みならそれを返す）
//    → Keepaトークンの節約。何度開いても消費しない
// ② Keepa API（キャッシュがない/古い時だけ呼ぶ。1商品=1トークン）
// ③ モックデータ（Keepaが使えない・商品が見つからない時の保険）
//    → ユーザーにエラー画面は絶対に見せない
//
// 【Keepaのデータ形式メモ】
// ・csv[0]=Amazon本体価格, csv[1]=マーケットプレイス新品価格
// ・[時刻, 価格, 時刻, 価格, ...] の交互の配列
// ・時刻は「Keepa時間（分）」: 実時間(ms) = (keepaTime + 21564000) * 60000
// ・価格 -1 は「データなし」。日本(domain=5)は円の整数
// ============================================================

const KEEPA_EPOCH_OFFSET = 21564000 // Keepa時間 → UNIX時間の変換オフセット（分）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // キャッシュ有効期間：24時間

interface DayPoint {
  label: string
  price: number | null
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
  // ① キャッシュ確認（価格履歴はユーザー固有ではないので全体で共有）
  // ---------------------------------------------------------
  const cacheRef = adminFirestore().collection('keepaCache').doc(asin)
  const cacheDoc = await cacheRef.get()

  let series: DayPoint[] | null = null

  if (cacheDoc.exists) {
    const cached = cacheDoc.data()!
    const age = Date.now() - new Date(cached.updatedAt).getTime()
    if (age < CACHE_TTL_MS) {
      series = cached.series as DayPoint[]
    }
  }

  // ---------------------------------------------------------
  // ② キャッシュがなければKeepaに問い合わせ
  // ---------------------------------------------------------
  if (!series) {
    series = await fetchFromKeepa(asin)
    if (series) {
      // 取得できたらキャッシュに保存（次回からトークン消費ゼロ）
      await cacheRef.set({
        updatedAt: new Date().toISOString(),
        series,
      })
    }
  }

  if (series) {
    const sliced = series.slice(-days)
    return {
      labels: sliced.map(p => p.label),
      prices: fillNulls(sliced.map(p => p.price)),
      source: 'keepa',
    }
  }

  // ---------------------------------------------------------
  // ③ フォールバック：モックデータ（Keepa障害・商品未発見時の保険）
  // ---------------------------------------------------------
  return generateMock(uid, asin, days)
})

// ============================================================
// Keepa APIから365日分の日次価格系列を取得
// 失敗時は null を返す（呼び出し側でモックに切り替え）
// ============================================================
async function fetchFromKeepa(asin: string): Promise<DayPoint[] | null> {
  const config = useRuntimeConfig()
  if (!config.keepaApiKey) return null

  try {
    const res = await $fetch<{ products?: { csv?: (number[] | null)[] }[] }>(
      'https://api.keepa.com/product',
      {
        query: {
          key: config.keepaApiKey,
          domain: 5, // 5 = Amazon.co.jp
          asin,
          history: 1,
        },
        timeout: 10_000,
      },
    )

    const csv = res.products?.[0]?.csv ?? []
    // マーケットプレイス新品価格を優先、なければAmazon本体価格
    const raw = (csv[1]?.length ? csv[1] : csv[0]) ?? null
    if (!raw || raw.length < 4) return null

    // [時刻, 価格, ...] の交互配列を時系列の点に変換
    const points: { t: number, p: number }[] = []
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const t = (raw[i]! + KEEPA_EPOCH_OFFSET) * 60_000
      const p = raw[i + 1]!
      if (p > 0) points.push({ t, p })
    }
    if (points.length === 0) return null

    // 365日分の「1日1点」に変換（その日までの最後の価格を採用 = forward fill）
    const series: DayPoint[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let idx = 0
    let last: number | null = null
    for (let i = 364; i >= 0; i--) {
      const dayStart = today.getTime() - i * 86_400_000
      const dayEnd = dayStart + 86_400_000
      while (idx < points.length && points[idx]!.t < dayEnd) {
        last = points[idx]!.p
        idx++
      }
      const d = new Date(dayStart)
      series.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, price: last })
    }
    return series
  } catch {
    return null // 通信失敗・トークン切れ等 → モックへフォールバック
  }
}

// 先頭のnull（履歴開始前の期間）を最初の実価格で埋める
function fillNulls(prices: (number | null)[]): number[] {
  const firstReal = prices.find(p => p !== null) ?? 0
  let last = firstReal
  return prices.map((p) => {
    if (p !== null) last = p
    return last
  })
}

// ============================================================
// モックデータ生成（Keepaが使えない時の保険。従来のロジック）
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

  return { labels, prices, source: 'mock' }
}

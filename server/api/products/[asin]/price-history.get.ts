// ============================================================
// 価格履歴取得API（Keepa連携・複数系列版）
//
// GET /api/products/:asin/price-history?days=90
//
// 【返すデータ（Keepa本家のグラフに倣った8系列）】
// ・newPrice    … マーケットプレイス新品価格（メインの線）
// ・amazon      … Amazon本体の販売価格（本体が売っていない期間は欠損）
// ・buyBox      … カートボックス価格＋送料（カート無し期間は欠損）
// ・rank        … 売れ筋ランキング＝総合（右軸・小さいほど売れている）
// ・subRank     … カテゴリ別売れ筋ランキング（右軸。subRankLabel=カテゴリ名）
// ・sellerCount … 新品出品者数（別グラフで表示。ライバルの増減がわかる）
// ・rating      … 評価（★1.0〜5.0。売れ行きの質がわかる）
// ・reviewCount … レビュー数（伸び＝売れ続けている裏付け）
//
// 【取得の優先順位】
// ① Firestoreキャッシュ（24時間）→ ② Keepa API → ③ モック
// ============================================================

const KEEPA_EPOCH_OFFSET = 21564000 // Keepa時間 → UNIX時間の変換オフセット（分）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_VERSION = 5 // データ形式を変えたらここを上げる（古いキャッシュを無効化）

type Daily = (number | null)[]

interface KeepaSeries {
  labels: string[]
  newPrice: Daily
  amazon: Daily
  buyBox: Daily
  rank: Daily
  subRank: Daily
  subRankLabel: string
  sellerCount: Daily
  rating: Daily
  reviewCount: Daily
}

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const query = getQuery(event)
  const requestedDays = [90, 180, 365].includes(Number(query.days)) ? Number(query.days) : 90

  // プラン別の閲覧期間制限（スターター: 90日まで）
  // 365日を要求されてもプラン上限で頭打ちにする
  const plan = await resolvePlan(uid)
  const days = Math.min(requestedDays, plan.maxHistoryDays)

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
      buyBox: series.buyBox.slice(-days), // 欠損はそのまま（カートが無い期間）
      rank: forwardFill(series.rank.slice(-days), true),
      subRank: forwardFill(series.subRank.slice(-days), true),
      subRankLabel: series.subRankLabel,
      sellerCount: forwardFill(series.sellerCount.slice(-days), true),
      rating: forwardFill(series.rating.slice(-days)),
      reviewCount: forwardFill(series.reviewCount.slice(-days), true),
      source: 'keepa',
    }
  }

  // ---------------------------------------------------------
  // ③ フォールバック：モック
  // ---------------------------------------------------------
  return generateMock(uid, asin, days)
})

// ============================================================
// Keepa APIから365日分の日次データを取得（失敗時 null）
// ============================================================

// Keepaのレスポンスのうち使う部分だけ型定義
interface KeepaProduct {
  csv?: (number[] | null)[]
  salesRanks?: Record<string, number[]>
  rootCategory?: number
  categoryTree?: { catId: number, name: string }[]
}

async function fetchFromKeepa(asin: string): Promise<KeepaSeries | null> {
  const config = useRuntimeConfig()
  if (!config.keepaApiKey) return null

  try {
    const res = await $fetch<{ products?: KeepaProduct[] }>(
      'https://api.keepa.com/product',
      {
        // buybox=1 でカート価格、rating=1 で評価・レビュー数の履歴も取得
        // （合計4トークン/商品。24hキャッシュするので許容）
        query: { key: config.keepaApiKey, domain: 5, asin, history: 1, buybox: 1, rating: 1 },
        timeout: 10_000,
      },
    )

    const product = res.products?.[0]
    const csv = product?.csv ?? []
    // Keepaのcsvインデックス: 0=Amazon本体, 1=マケプレ新品, 3=売れ筋ランキング, 11=新品出品者数, 18=カート価格
    const newPrice = toDaily(csv[1])
    const amazon = toDaily(csv[0])
    const rank = toDaily(csv[3])
    // 出品者数は「0人」も意味のある値なので allowZero で残す（価格の0円はありえないが出品者0人はありえる）
    const sellerCount = toDaily(csv[11], { allowZero: true })
    // カート価格は [時刻, 価格, 送料] の3つ組形式（送料込みの支払額に合算する）
    const buyBox = toDaily(csv[18], { stride: 3 })
    // 評価はKeepa上で10倍の整数（46=★4.6）なので10で割って小数1桁に戻す
    const rating = toDaily(csv[16])?.map(v => (v === null ? null : v / 10)) ?? null
    const reviewCount = toDaily(csv[17], { allowZero: true })
    // カテゴリ別ランキング（総合とは別に、最も細かいカテゴリの順位を取る）
    const { subRank, subRankLabel } = pickSubRank(product)

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

    const empty = () => new Array(365).fill(null)
    return {
      labels,
      newPrice,
      amazon: amazon ?? empty(),
      buyBox: buyBox ?? empty(),
      rank: rank ?? empty(),
      subRank: subRank ?? empty(),
      subRankLabel,
      sellerCount: sellerCount ?? empty(),
      rating: rating ?? empty(),
      reviewCount: reviewCount ?? empty(),
    }
  } catch {
    return null
  }
}

// カテゴリ別ランキングを選ぶ：
// salesRanksには「総合（rootCategory）」と「所属カテゴリ」の順位履歴が入っている。
// categoryTreeを深い方（=より細かいカテゴリ）から探して、履歴がある最初のものを採用
function pickSubRank(product: KeepaProduct | undefined): { subRank: Daily | null, subRankLabel: string } {
  const ranks = product?.salesRanks
  const tree = product?.categoryTree
  if (!ranks || !tree) return { subRank: null, subRankLabel: '' }

  for (let i = tree.length - 1; i >= 0; i--) {
    const cat = tree[i]!
    if (cat.catId === product?.rootCategory) continue // 総合はrankとして表示済み
    const history = ranks[String(cat.catId)]
    if (history) {
      return { subRank: toDaily(history), subRankLabel: cat.name }
    }
  }
  return { subRank: null, subRankLabel: '' }
}

// Keepaの履歴配列 → 365日分の日次配列に変換（その日の最後の値を採用）
//
// 形式は2種類ある：
// ・通常   [時刻, 値, 時刻, 値, ...]        → stride: 2（デフォルト）
// ・カート [時刻, 価格, 送料, 時刻, ...]     → stride: 3（価格+送料を合算）
//
// Keepaは「その時点で販売が無くなった」ことを -1 で表す。
// -1 は null（欠損）として日次配列に反映する。こうしないと
// Amazon本体が撤退した期間に古い価格が引き継がれてしまう。
// 出品者数のような「0が正常値」の系列は allowZero: true で 0 を残す
function toDaily(
  raw: number[] | null | undefined,
  opts: { allowZero?: boolean, stride?: 2 | 3 } = {},
): Daily | null {
  const stride = opts.stride ?? 2
  if (!raw || raw.length < stride * 2) return null

  const points: { t: number, v: number | null }[] = []
  for (let i = 0; i + stride - 1 < raw.length; i += stride) {
    const t = (raw[i]! + KEEPA_EPOCH_OFFSET) * 60_000
    const v = raw[i + 1]!
    if (v === -1) {
      points.push({ t, v: null }) // 販売終了マーカー → 欠損
    }
    else if (v > 0 || (opts.allowZero && v === 0)) {
      const shipping = stride === 3 ? Math.max(raw[i + 2]!, 0) : 0
      points.push({ t, v: v + shipping })
    }
  }
  if (!points.some(p => p.v !== null)) return null

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
  const sellers: number[] = []
  const now = new Date()
  let price = basePrice * (0.9 + random() * 0.2)
  let sellerCount = 3 + Math.floor(random() * 10) // 出品者数は3〜12人からスタート

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    const drift = (basePrice - price) * 0.02
    price = price * (0.98 + random() * 0.04) + drift
    if (random() < 0.05) price = price * 0.9
    prices.push(Math.round(price))

    // 出品者数：たまに±1人だけ増減するランダムウォーク（0人未満にはしない）
    if (random() < 0.15) sellerCount += random() < 0.5 ? 1 : -1
    if (sellerCount < 0) sellerCount = 0
    sellers.push(sellerCount)
  }
  if (doc.exists) prices[prices.length - 1] = basePrice

  return {
    labels,
    newPrice: prices,
    amazon: new Array(days).fill(null),
    buyBox: new Array(days).fill(null),
    rank: new Array(days).fill(null),
    subRank: new Array(days).fill(null),
    subRankLabel: '',
    sellerCount: sellers,
    rating: new Array(days).fill(null),
    reviewCount: new Array(days).fill(null),
    source: 'mock',
  }
}

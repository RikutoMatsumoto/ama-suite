// ============================================================
// Amazon FBA実在庫の取得API（オーナー認可＋キャッシュ付き）
//
// GET /api/spapi/inventory?refresh=1
//
// FBA Inventory API（getInventorySummaries）でAmazon倉庫にある
// 実在庫を取得して返す。
//
// 【startDateTimeで絞る理由】
// 何も指定しないと過去に出品した全SKU（在庫0含む）が返ってきて、
// 実測で2,141SKU=43ページもあった。「直近1年で在庫変動があったSKU」に
// 絞ると6ページ程度になり、在庫ありSKUは全て捕捉できる
// （1年以上動きのない在庫はFBA長期保管手数料的にほぼ存在しない）。
// 一覧はさらに「在庫あり or 納品中」のSKUだけにする。
//
// 【在庫の内訳】
// ・fulfillable … 今すぐ販売できる在庫
// ・inbound     … Amazon倉庫へ納品中（輸送中〜受領処理中）
// ・reserved    … 予約済み（注文処理中・倉庫内移動中など一時的に確保されている分）
// ============================================================

const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_PAGES = 20 // 1ページ50SKU × 20 = 最大1,000SKUまで追いかける（安全弁）
const ACTIVITY_WINDOW_DAYS = 365 // 直近1年で変動のあったSKUだけ取得

interface InventorySummary {
  asin?: string
  sellerSku?: string
  productName?: string
  totalQuantity?: number
  inventoryDetails?: {
    fulfillableQuantity?: number
    inboundShippedQuantity?: number
    inboundWorkingQuantity?: number
    inboundReceivingQuantity?: number
    reservedQuantity?: { totalReservedQuantity?: number }
  }
}

interface InventoryResponse {
  payload?: { inventorySummaries: InventorySummary[] }
  pagination?: { nextToken?: string }
}

export default defineEventHandler(async (event) => {
  // オーナーのアカウント以外は403（デモに実データは見せない）
  const uid = await requireSpApiOwner(event)

  const forceRefresh = getQuery(event).refresh === '1'

  // ---------------------------------------------------------
  // ① キャッシュ確認（15分以内ならそれを返す）
  // ---------------------------------------------------------
  const cacheRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('spapiCache').doc('inventory')

  if (!forceRefresh) {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data()!
      if (Date.now() - new Date(data.updatedAt).getTime() < CACHE_TTL_MS) {
        return data
      }
    }
  }

  // ---------------------------------------------------------
  // ② FBA Inventory APIから全SKUを取得（nextTokenでページをめくる）
  // ---------------------------------------------------------
  const startDateTime = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000).toISOString()

  const summaries: InventorySummary[] = []
  let nextToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const query: Record<string, string> = {
      granularityType: 'Marketplace',
      granularityId: JP_MARKETPLACE_ID,
      marketplaceIds: JP_MARKETPLACE_ID,
      details: 'true', // 在庫の内訳（販売可能・納品中など）も取得
      startDateTime,
    }
    if (nextToken) query.nextToken = nextToken

    const res = await callSpApi<InventoryResponse>('/fba/inventory/v1/summaries', query)
    summaries.push(...(res.payload?.inventorySummaries ?? []))
    nextToken = res.pagination?.nextToken
    if (!nextToken) break

    // レートリミット対策（getInventorySummariesは2回/秒まで）
    await new Promise(resolve => setTimeout(resolve, 600))
  }

  // ---------------------------------------------------------
  // ③ 整形：在庫あり or 納品中のSKUだけを一覧にする
  // ---------------------------------------------------------
  const items = summaries
    .map((s) => {
      const d = s.inventoryDetails
      const inbound = (d?.inboundShippedQuantity ?? 0)
        + (d?.inboundWorkingQuantity ?? 0)
        + (d?.inboundReceivingQuantity ?? 0)
      return {
        asin: s.asin ?? '',
        sku: s.sellerSku ?? '',
        productName: s.productName ?? '(商品名なし)',
        total: s.totalQuantity ?? 0,
        fulfillable: d?.fulfillableQuantity ?? 0,
        inbound,
        reserved: d?.reservedQuantity?.totalReservedQuantity ?? 0,
      }
    })
    .filter(i => i.total > 0 || i.inbound > 0)
    .sort((a, b) => b.total - a.total) // 在庫が多い順

  const summary = {
    allSkus: summaries.length, // 直近1年で変動のあったSKU数
    activeSkus: items.length, // 在庫あり or 納品中のSKU数
    totalUnits: items.reduce((sum, i) => sum + i.total, 0),
    inboundUnits: items.reduce((sum, i) => sum + i.inbound, 0),
  }

  const result = { items, summary, updatedAt: new Date().toISOString() }

  // ---------------------------------------------------------
  // ④ キャッシュ保存
  // ---------------------------------------------------------
  await cacheRef.set(result)

  return result
})

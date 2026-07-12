// ============================================================
// FBA実在庫の取得ロジック（共通化）
//
// /api/spapi/inventory（在庫管理ページ）と
// /api/spapi/import-products（商品取り込み）の両方で使うため、
// amazon-orders.ts と同じパターンでここに切り出している。
//
// 【startDateTimeで絞る理由】
// 無指定だと過去出品の全SKU（在庫0含む）が返り、実測で2,141SKU=43ページ。
// 「直近1年で在庫変動があったSKU」に絞ると6ページ程度で、
// 在庫ありSKUは全て捕捉できる（1年以上不動の在庫はFBA長期保管手数料的にほぼ無い）
// ============================================================

const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_PAGES = 20 // 1ページ50SKU × 20 = 最大1,000SKUまで追いかける（安全弁）
const ACTIVITY_WINDOW_DAYS = 365

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

export interface FbaItem {
  asin: string
  sku: string
  productName: string
  total: number
  fulfillable: number
  inbound: number
  reserved: number
}

export interface FbaInventoryData {
  items: FbaItem[] // 在庫あり or 納品中のSKUのみ
  summary: { allSkus: number, activeSkus: number, totalUnits: number, inboundUnits: number }
  updatedAt: string
}

// FBA実在庫を取得する（Firestoreに15分キャッシュ）
export async function fetchFbaInventory(uid: string, forceRefresh = false): Promise<FbaInventoryData> {
  // ---------------------------------------------------------
  // ① キャッシュ確認
  // ---------------------------------------------------------
  const cacheRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('spapiCache').doc('inventory')

  if (!forceRefresh) {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data()!
      if (Date.now() - new Date(data.updatedAt).getTime() < CACHE_TTL_MS) {
        return data as FbaInventoryData
      }
    }
  }

  // ---------------------------------------------------------
  // ② FBA Inventory APIからページをめくりながら取得
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
  const items: FbaItem[] = summaries
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
    activeSkus: items.length,
    totalUnits: items.reduce((sum, i) => sum + i.total, 0),
    inboundUnits: items.reduce((sum, i) => sum + i.inbound, 0),
  }

  const result: FbaInventoryData = { items, summary, updatedAt: new Date().toISOString() }

  // ---------------------------------------------------------
  // ④ キャッシュ保存
  // ---------------------------------------------------------
  await cacheRef.set(result)

  return result
}

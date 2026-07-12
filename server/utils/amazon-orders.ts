// ============================================================
// Amazon実注文の取得ロジック（共通化）
//
// 【なぜ server/utils に置くのか？】
// 最初は /api/spapi/orders 専用だったが、ダッシュボードのKPIと
// 売上グラフでも同じデータを使うことになった。
// APIルートに書いたロジックは他のルートから呼びにくいので、
// 「取得＋整形＋キャッシュ」をここに切り出して全員で使い回す。
// ============================================================

const CACHE_TTL_MS = 15 * 60 * 1000
const DAYS = 30

// SP-APIが返す注文オブジェクト（使うフィールドだけ型定義）
interface SpApiOrder {
  AmazonOrderId: string
  PurchaseDate: string
  OrderStatus: 'Pending' | 'Unshipped' | 'PartiallyShipped' | 'Shipped' | 'Canceled' | string
  OrderTotal?: { CurrencyCode: string, Amount: string }
  NumberOfItemsShipped?: number
  NumberOfItemsUnshipped?: number
  FulfillmentChannel?: 'AFN' | 'MFN' // AFN=FBA（Amazon倉庫から発送）/ MFN=自己発送
}

interface OrdersResponse {
  payload: { Orders: SpApiOrder[], NextToken?: string }
}

export interface AmazonOrder {
  orderId: string
  purchaseDate: string
  status: string
  total: number | null
  itemCount: number
  fulfillment: string
}

export interface AmazonOrdersData {
  orders: AmazonOrder[]
  summary: {
    days: number
    orderCount: number
    totalSales: number
    itemCount: number
    pendingCount: number
    canceledCount: number
  }
  updatedAt: string
}

// 直近30日の実注文を取得する（Firestoreに15分キャッシュ）
export async function fetchAmazonOrders(uid: string, forceRefresh = false): Promise<AmazonOrdersData> {
  // ---------------------------------------------------------
  // ① キャッシュ確認（15分以内ならそれを返す）
  // ---------------------------------------------------------
  const cacheRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('spapiCache').doc('orders30')

  if (!forceRefresh) {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data()!
      if (Date.now() - new Date(data.updatedAt).getTime() < CACHE_TTL_MS) {
        return data as AmazonOrdersData
      }
    }
  }

  // ---------------------------------------------------------
  // ② Orders APIから直近30日を取得（NextTokenで最大3ページ追いかける）
  // ---------------------------------------------------------
  const createdAfter = new Date(Date.now() - DAYS * 86_400_000).toISOString()

  const rawOrders: SpApiOrder[] = []
  let nextToken: string | undefined
  for (let page = 0; page < 3; page++) {
    const res = await callSpApi<OrdersResponse>('/orders/v0/orders', nextToken
      ? { MarketplaceIds: JP_MARKETPLACE_ID, NextToken: nextToken }
      : { MarketplaceIds: JP_MARKETPLACE_ID, CreatedAfter: createdAfter })

    rawOrders.push(...(res.payload.Orders ?? []))
    nextToken = res.payload.NextToken
    if (!nextToken) break
  }

  // ---------------------------------------------------------
  // ③ フロントで使いやすい形に整形＋集計
  // ---------------------------------------------------------
  const orders: AmazonOrder[] = rawOrders
    .map(o => ({
      orderId: o.AmazonOrderId,
      purchaseDate: o.PurchaseDate,
      status: o.OrderStatus,
      // Pending・Canceledでは OrderTotal が無いことがある → null
      total: o.OrderTotal ? Number(o.OrderTotal.Amount) : null,
      itemCount: (o.NumberOfItemsShipped ?? 0) + (o.NumberOfItemsUnshipped ?? 0),
      fulfillment: o.FulfillmentChannel === 'AFN' ? 'FBA' : '自己発送',
    }))
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)) // 新しい順

  // 売上集計はキャンセルを除く（保留中は金額が出てから含まれる）
  const active = orders.filter(o => o.status !== 'Canceled')
  const summary = {
    days: DAYS,
    orderCount: active.length,
    totalSales: active.reduce((sum, o) => sum + (o.total ?? 0), 0),
    itemCount: active.reduce((sum, o) => sum + o.itemCount, 0),
    pendingCount: orders.filter(o => o.status === 'Pending').length,
    canceledCount: orders.filter(o => o.status === 'Canceled').length,
  }

  const result: AmazonOrdersData = { orders, summary, updatedAt: new Date().toISOString() }

  // ---------------------------------------------------------
  // ④ キャッシュ保存
  // ---------------------------------------------------------
  await cacheRef.set(result)

  return result
}

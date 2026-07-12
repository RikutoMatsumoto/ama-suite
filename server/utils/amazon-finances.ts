// ============================================================
// Amazon入金明細の取得ロジック（Finances API）
//
// 【何が取れるのか？】
// 「注文ごとにAmazonが実際にいくら入金してくれるか」の明細。
// ・charges … 買い手が払った金額（商品代金・税など。プラス）
// ・fees    … Amazonに引かれる手数料（販売手数料・FBA配送料など。マイナス）
// charges + fees = 実際の入金額。
// 商品登録時の「10%+8%の目安計算」と違い、実際に引かれた手数料そのもの。
//
// 【注意】
// 入金イベントは「発送されて売上が確定した時」に発生する。
// 注文日（purchaseDate）ではなく確定日（postedDate）ベースなので、
// Orders APIの売上集計とは日付が少しズレるのが正常。
// ============================================================

const CACHE_TTL_MS = 15 * 60 * 1000
const DAYS = 30
const MAX_PAGES = 5

// Finances APIのレスポンス（使うフィールドだけ型定義）
interface MoneyAmount {
  CurrencyAmount?: number
}

interface ChargeOrFee {
  ChargeType?: string
  FeeType?: string
  ChargeAmount?: MoneyAmount
  FeeAmount?: MoneyAmount
}

interface ShipmentItem {
  SellerSKU?: string
  QuantityShipped?: number
  ItemChargeList?: ChargeOrFee[]
  ItemFeeList?: ChargeOrFee[]
}

interface ShipmentEvent {
  AmazonOrderId?: string
  PostedDate?: string
  ShipmentItemList?: ShipmentItem[]
}

interface FinancialEventsResponse {
  payload?: {
    NextToken?: string
    FinancialEvents?: {
      ShipmentEventList?: ShipmentEvent[]
      RefundEventList?: ShipmentEvent[] // 返金も同じ形（金額がマイナスで入る）
    }
  }
}

// 1商品分の確定明細（フロント・集計で使いやすい形）
export interface SettledItem {
  orderId: string
  postedDate: string
  sku: string
  quantity: number
  charges: number // 買い手支払額の合計（返金ならマイナス）
  fees: number // 手数料の合計（通常マイナス）
  isRefund: boolean
}

export interface AmazonFinancesData {
  items: SettledItem[]
  updatedAt: string
}

// 直近30日の入金明細を取得する（Firestoreに15分キャッシュ）
export async function fetchAmazonFinances(uid: string, forceRefresh = false): Promise<AmazonFinancesData> {
  // ---------------------------------------------------------
  // ① キャッシュ確認
  // ---------------------------------------------------------
  const cacheRef = adminFirestore()
    .collection('users').doc(uid)
    .collection('spapiCache').doc('finances30')

  if (!forceRefresh) {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data()!
      if (Date.now() - new Date(data.updatedAt).getTime() < CACHE_TTL_MS) {
        return data as AmazonFinancesData
      }
    }
  }

  // ---------------------------------------------------------
  // ② Finances APIから直近30日の確定イベントを取得
  // ---------------------------------------------------------
  const postedAfter = new Date(Date.now() - DAYS * 86_400_000).toISOString()

  const shipments: ShipmentEvent[] = []
  const refunds: ShipmentEvent[] = []
  let nextToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await callSpApi<FinancialEventsResponse>('/finances/v0/financialEvents', nextToken
      ? { NextToken: nextToken }
      : { PostedAfter: postedAfter, MaxResultsPerPage: 100 })

    shipments.push(...(res.payload?.FinancialEvents?.ShipmentEventList ?? []))
    refunds.push(...(res.payload?.FinancialEvents?.RefundEventList ?? []))
    nextToken = res.payload?.NextToken
    if (!nextToken) break

    // レートリミット対策（financialEventsは0.5回/秒）
    await new Promise(resolve => setTimeout(resolve, 2_100))
  }

  // ---------------------------------------------------------
  // ③ 商品単位の明細に整形（金額リストを合算）
  // ---------------------------------------------------------
  const sumAmounts = (list: ChargeOrFee[] | undefined) =>
    (list ?? []).reduce((sum, entry) =>
      sum + (entry.ChargeAmount?.CurrencyAmount ?? entry.FeeAmount?.CurrencyAmount ?? 0), 0)

  const toItems = (events: ShipmentEvent[], isRefund: boolean): SettledItem[] =>
    events.flatMap(event =>
      (event.ShipmentItemList ?? []).map(item => ({
        orderId: event.AmazonOrderId ?? '',
        postedDate: event.PostedDate ?? '',
        sku: item.SellerSKU ?? '',
        quantity: item.QuantityShipped ?? 0,
        charges: sumAmounts(item.ItemChargeList),
        fees: sumAmounts(item.ItemFeeList),
        isRefund,
      })),
    )

  const items = [...toItems(shipments, false), ...toItems(refunds, true)]
    .sort((a, b) => b.postedDate.localeCompare(a.postedDate))

  const result: AmazonFinancesData = { items, updatedAt: new Date().toISOString() }

  // ---------------------------------------------------------
  // ④ キャッシュ保存
  // ---------------------------------------------------------
  await cacheRef.set(result)

  return result
}

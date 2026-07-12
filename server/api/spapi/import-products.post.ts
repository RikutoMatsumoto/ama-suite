// ============================================================
// Amazon出品商品の自動取り込みAPI（オーナー認可付き）
//
// POST /api/spapi/import-products
//
// 【流れ】
// ① FBA実在庫から「在庫あり or 納品中」の商品を取得
// ② Product Pricing APIで自分の出品価格をまとめて取得（最大20ASIN/回）
// ③ 商品管理（users/{uid}/products）に未登録のものだけ登録
//    ・在庫数はFBAの販売可能数をそのままセット
//    ・仕入れ値は0で登録（あとで本人が入力する想定）
//
// 手入力していた商品登録が「ワンクリックで実在庫から取り込み」になる。
// ============================================================

// 商品登録API（products/index.post.ts）と同じ手数料率
const FBA_FEE_RATE = 0.10
const AMAZON_FEE_RATE = 0.08

interface PricingResponse {
  payload?: {
    ASIN?: string
    status?: string
    Product?: {
      Offers?: { BuyingPrice?: { ListingPrice?: { Amount?: number } } }[]
    }
  }[]
}

export default defineEventHandler(async (event) => {
  // オーナーのアカウント以外は403（デモには実データを触らせない）
  const uid = await requireSpApiOwner(event)

  // ---------------------------------------------------------
  // ① FBA実在庫から取り込み対象を集める（ASINで重複をまとめる）
  // ---------------------------------------------------------
  const inventory = await fetchFbaInventory(uid)

  const byAsin = new Map<string, { productName: string, stock: number }>()
  for (const item of inventory.items) {
    if (!item.asin) continue
    const current = byAsin.get(item.asin)
    byAsin.set(item.asin, {
      productName: item.productName,
      // 同じASINに複数SKUがある場合は販売可能数を合算
      stock: (current?.stock ?? 0) + item.fulfillable,
    })
  }

  if (byAsin.size === 0) {
    return { importedCount: 0, skippedCount: 0, imported: [] }
  }

  // ---------------------------------------------------------
  // ② 自分の出品価格をまとめて取得（20ASINずつ）
  //    カートに出ていない商品などは価格が取れないことがある → 0円で登録
  // ---------------------------------------------------------
  const asins = [...byAsin.keys()]
  const prices = new Map<string, number>()

  for (let i = 0; i < asins.length; i += 20) {
    const batch = asins.slice(i, i + 20)
    try {
      const res = await callSpApi<PricingResponse>('/products/pricing/v0/price', {
        MarketplaceId: JP_MARKETPLACE_ID,
        ItemType: 'Asin',
        Asins: batch.join(','),
      })
      for (const p of res.payload ?? []) {
        const amount = p.Product?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount
        if (p.ASIN && amount) prices.set(p.ASIN, amount)
      }
    } catch {
      // 価格取得に失敗しても取り込み自体は続行（0円で登録される）
    }
  }

  // ---------------------------------------------------------
  // ③ 未登録の商品だけ登録（create()は既存IDだとエラー=スキップ）
  // ---------------------------------------------------------
  const imported: { asin: string, productName: string }[] = []
  let skippedCount = 0

  for (const [asin, info] of byAsin) {
    const currentPrice = prices.get(asin) ?? 0
    const fbaFee = Math.round(currentPrice * FBA_FEE_RATE)
    const amazonFee = Math.round(currentPrice * AMAZON_FEE_RATE)

    try {
      await adminFirestore()
        .collection('users').doc(uid)
        .collection('products').doc(asin)
        .create({
          productName: info.productName,
          currentPrice,
          costPrice: 0, // 仕入れ値はAmazonにはないデータなので本人が後から入力
          profit: currentPrice - 0 - fbaFee - amazonFee,
          stock: info.stock,
          source: 'amazon', // 取り込み由来だとわかるように印を付けておく
          createdAt: new Date().toISOString(),
        })
      imported.push({ asin, productName: info.productName })
    } catch (err: unknown) {
      const firestoreError = err as { code?: number }
      if (firestoreError.code === 6) {
        skippedCount++ // 既に登録済み → スキップ
      } else {
        throw err
      }
    }
  }

  return { importedCount: imported.length, skippedCount, imported }
})

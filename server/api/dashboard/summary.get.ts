// ============================================================
// ダッシュボードKPI取得API（認可チェック付き・実データ集計）
//
// 【売上・利益の出どころは2系統】
// ・オーナーアカウント … SP-APIの実データから集計（source: 'amazon'）
//   売上 = Orders API（注文日ベース）
//   利益 = Finances API（入金確定ベース）− 仕入れ値
//          仕入れ値はSKU→ASIN→商品のcostPriceで紐付け（未入力なら0円扱い）
// ・それ以外（デモ等） … 手動記録の注文から集計（source: 'manual'）
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  // ログインユーザーの商品を全件取得
  const snap = await adminFirestore()
    .collection('users').doc(uid)
    .collection('products')
    .get()

  // 想定利益の合計と在庫切れ数を集計
  let totalExpectedProfit = 0
  let outOfStockCount = 0
  snap.forEach((doc) => {
    const data = doc.data()
    totalExpectedProfit += Number(data.profit ?? 0)
    // 在庫数が0（または未設定）の商品を在庫切れとして数える
    if (Number(data.stock ?? 0) === 0) {
      outOfStockCount++
    }
  })

  // 今月の注文を集計（売上と確定利益）
  // ISO形式の日付文字列は文字列比較でも時系列順になるのを利用
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // -------------------------------------------------------
  // オーナーはAmazon実注文から集計
  // -------------------------------------------------------
  if (await isSpApiOwner(uid)) {
    const amazon = await fetchAmazonOrders(uid)
    // 今月分（キャンセル除く）の売上を合算
    // ※取得ウィンドウは直近30日なので、31日ある月の1日分だけ端が欠ける可能性あり
    const monthlySales = amazon.orders
      .filter(o => o.status !== 'Canceled' && o.purchaseDate >= monthStart)
      .reduce((sum, o) => sum + (o.total ?? 0), 0)

    // ---------------------------------------------------
    // 今月の実利益 = 入金確定額（実手数料引き後）− 仕入れ値
    // ---------------------------------------------------
    const [finances, inventory] = await Promise.all([
      fetchAmazonFinances(uid),
      fetchFbaInventory(uid), // SKU→ASINの対応表に使う
    ])

    // 仕入れ値の対応表（ASIN→costPrice）を商品データから作る
    const costByAsin = new Map<string, number>()
    snap.forEach((doc) => {
      costByAsin.set(doc.id, Number(doc.data().costPrice ?? 0))
    })

    let monthlyProfit = 0
    for (const item of finances.items) {
      if (item.postedDate < monthStart) continue
      // charges（買い手支払額）+ fees（手数料・マイナス値）= 実入金額
      let profit = item.charges + item.fees
      // 仕入れ値を引く（返金イベントは商品が戻ってくるので仕入れ値は引かない）
      if (!item.isRefund) {
        const asin = inventory.skuAsinMap[item.sku]
        const cost = asin ? (costByAsin.get(asin) ?? 0) : 0
        profit -= cost * item.quantity
      }
      monthlyProfit += profit
    }

    return {
      monthlySales,
      monthlyProfit: Math.round(monthlyProfit),
      totalExpectedProfit,
      productCount: snap.size,
      outOfStockCount,
      source: 'amazon',
      updatedAt: new Date().toISOString(),
    }
  }

  // -------------------------------------------------------
  // それ以外は手動記録の注文から集計（従来どおり）
  // -------------------------------------------------------
  const ordersSnap = await adminFirestore()
    .collection('users').doc(uid)
    .collection('orders')
    .where('createdAt', '>=', monthStart)
    .get()

  let monthlySales = 0
  let monthlyProfit = 0
  ordersSnap.forEach((doc) => {
    const data = doc.data()
    monthlySales += Number(data.total ?? 0)
    monthlyProfit += Number(data.profit ?? 0)
  })

  return {
    monthlySales, // 今月の売上（注文の合計）
    monthlyProfit, // 今月の確定利益
    totalExpectedProfit, // 登録商品の想定利益合計
    productCount: snap.size, // 登録商品数
    outOfStockCount, // 在庫切れ商品数
    source: 'manual',
    updatedAt: new Date().toISOString(),
  }
})

// ============================================================
// ダッシュボードKPI取得API（認可チェック付き・実データ集計）
//
// 【売上の出どころは2系統】
// ・オーナーアカウント … SP-APIのAmazon実注文から集計（source: 'amazon'）
//   利益は手数料連携（財務会計ロール）が未実装のため null を返す
//   （手動記録の想定利益と混ぜて嘘の数字を出さないための判断）
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

    return {
      monthlySales,
      monthlyProfit: null, // 手数料連携（財務会計ロール）までは算出しない
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

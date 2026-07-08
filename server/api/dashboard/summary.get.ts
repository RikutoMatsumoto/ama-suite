// ============================================================
// ダッシュボードKPI取得API（認可チェック付き・実データ集計）
//
// 【変更履歴】
// 旧: 固定のダミー数値を返すだけだった
// 新: ログインユーザーの商品データをFirestoreから集計して返す
//
// 売上・注文はAmazon SP-API連携後に実装予定のため、
// 現時点で集計できる「登録商品数」「想定利益の合計」を返す。
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
    updatedAt: new Date().toISOString(),
  }
})

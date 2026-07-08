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

  // 想定利益の合計：各商品の profit を足し合わせる
  let totalExpectedProfit = 0
  snap.forEach((doc) => {
    totalExpectedProfit += Number(doc.data().profit ?? 0)
  })

  return {
    monthlySales: 0, // SP-API連携後に実装
    totalExpectedProfit, // 登録商品の想定利益合計
    productCount: snap.size, // 登録商品数
    outOfStockCount: 0, // 在庫管理実装後に集計
    updatedAt: new Date().toISOString(),
  }
})

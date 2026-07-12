// ============================================================
// Amazon実注文の取得API（オーナー認可付き）
//
// GET /api/spapi/orders?refresh=1
//
// 取得・整形・キャッシュの本体は server/utils/amazon-orders.ts に共通化
// （ダッシュボードのKPI・売上グラフでも同じデータを使うため）。
// このルートは「認可チェック＋呼び出し」だけの薄い入り口。
// ============================================================

export default defineEventHandler(async (event) => {
  // オーナーのアカウント以外は403（デモに実データは見せない）
  const uid = await requireSpApiOwner(event)

  const forceRefresh = getQuery(event).refresh === '1'
  return fetchAmazonOrders(uid, forceRefresh)
})

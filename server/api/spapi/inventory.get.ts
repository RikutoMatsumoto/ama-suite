// ============================================================
// Amazon FBA実在庫の取得API（オーナー認可付き）
//
// GET /api/spapi/inventory?refresh=1
//
// 取得・整形・キャッシュの本体は server/utils/fba-inventory.ts に共通化
// （商品の自動取り込みでも同じデータを使うため）。
// このルートは「認可チェック＋呼び出し」だけの薄い入り口。
// ============================================================

export default defineEventHandler(async (event) => {
  // オーナーのアカウント以外は403（デモに実データは見せない）
  const uid = await requireSpApiOwner(event)

  const forceRefresh = getQuery(event).refresh === '1'
  return fetchFbaInventory(uid, forceRefresh)
})

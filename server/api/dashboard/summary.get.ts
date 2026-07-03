// ============================================================
// ダッシュボードKPI取得API
//
// 【GETリクエストのAPI】
// ファイル名の .get が「GETメソッドで呼ぶAPI」という意味。
// フォルダを切って server/api/dashboard/summary.get.ts と置くと
// URLは /api/dashboard/summary になる（フォルダ構造 = URL構造）。
//
// 【今はダミーデータ、将来はRailsから取得】
// 今は仮の数値を返しているが、将来はここで
// Rails APIを呼び出して実データに差し替える想定。
// フロント側は「どこからデータが来るか」を気にせず
// 同じ /api/dashboard/summary を呼び続けられる。
// ============================================================

export default defineEventHandler(() => {
  return {
    monthlySales: 0,
    monthlyProfit: 0,
    productCount: 0,
    outOfStockCount: 0,
    updatedAt: new Date().toISOString(),
  }
})

// ============================================================
// 利益計算API（Nitro server/api）
//
// 【server/api/ とは？】
// Nuxtに標準搭載されているバックエンド機能（Nitro）。
// このファイルを置くだけで、Node.jsで動くAPIエンドポイントが
// 自動で作られる。フロントと同じNuxtプロジェクト内に
// バックエンド処理を書けるのが特徴。
//
// 【なぜ計算をサーバー側に持ってきたか？】
// ブラウザ側の computed() で計算していたが、
// 手数料率などのロジックはサーバー側に置くことで
// 「フロントを見ればロジックが盗める」状態を避けられる。
// 将来、料率が変わってもフロントの再デプロイが不要になる。
//
// 呼び出し方（フロントから）：
// const result = await $fetch('/api/profit-calculator', {
//   method: 'POST',
//   body: { sellingPrice: 3980, costPrice: 1500 }
// })
// ============================================================

// 手数料率（本来は商品カテゴリごとに変わるが、ここでは固定値の目安）
const FBA_FEE_RATE = 0.10
const AMAZON_FEE_RATE = 0.08

interface ProfitCalculatorBody {
  sellingPrice: number
  costPrice: number
}

export default defineEventHandler(async (event) => {
  // readBody：POSTで送られてきたJSONを取り出す（Rails の params 相当）
  const body = await readBody<ProfitCalculatorBody>(event)

  const sellingPrice = Number(body.sellingPrice)
  const costPrice = Number(body.costPrice)

  // バリデーション：不正な値ならエラーを返す
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'sellingPrice は正の数値で指定してください',
    })
  }
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'costPrice は0以上の数値で指定してください',
    })
  }

  const fbaFee = Math.round(sellingPrice * FBA_FEE_RATE)
  const amazonFee = Math.round(sellingPrice * AMAZON_FEE_RATE)
  const profit = sellingPrice - costPrice - fbaFee - amazonFee
  const profitRate = Math.round((profit / sellingPrice) * 100)

  return {
    sellingPrice,
    costPrice,
    fbaFee,
    amazonFee,
    profit,
    profitRate,
  }
})

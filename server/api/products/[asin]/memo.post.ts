// ============================================================
// 商品メモ保存API
//
// 【[asin] とは？】
// ファイル名を [ ] で囲むと「動的パラメータ」になる。
// /api/products/B08XXXXX/memo のように、ASINの部分が
// どんな文字列でも同じファイルで受け取れる。
// event.context.params.asin でその値を取り出せる。
//
// 【今回は保存先が未接続】
// 本来はRailsのDB（またはFirestore）に保存するが、
// ここではNitro側のAPI設計だけを示すため、
// 受け取った内容をそのまま返すにとどめている。
// 認可チェック（このユーザーの商品か）はRails側実装時に必須。
// ============================================================

interface MemoBody {
  supplier: string
  note: string
}

export default defineEventHandler(async (event) => {
  const asin = getRouterParam(event, 'asin')
  const body = await readBody<MemoBody>(event)

  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  // TODO: Rails APIまたはFirestoreへの保存処理を実装
  // 保存時はFirebaseのIDトークンを検証し、user_idで認可チェックすること

  return {
    asin,
    supplier: body.supplier,
    note: body.note,
    savedAt: new Date().toISOString(),
  }
})

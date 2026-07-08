// ============================================================
// 商品メモ保存API（認可チェック付き）
//
// 【セキュリティの要点】
// ① requireAuth() でIDトークンを検証し、本人のuidを特定
// ② 保存先を users/{uid}/memos/{asin} にする
//    → 保存先が「検証済みの本人のフォルダ」に固定されるので、
//      他人のメモを上書き・閲覧することが構造上できない
//    → これが「user_idによる認可チェック」
//
// クライアントが「自分は誰か」を自己申告するのではなく、
// サーバー側がトークンから本人を特定するのがポイント。
// ============================================================

interface MemoBody {
  supplier: string
  note: string
}

export default defineEventHandler(async (event) => {
  // ① 認証チェック：未ログイン・偽トークンならここで401になる
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  const body = await readBody<MemoBody>(event)

  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  // ② 検証済みのuid配下にだけ保存する（認可チェックの実体）
  const memoData = {
    supplier: body.supplier ?? '',
    note: body.note ?? '',
    updatedAt: new Date().toISOString(),
  }

  await adminFirestore()
    .collection('users').doc(uid)
    .collection('memos').doc(asin)
    .set(memoData)

  return { asin, ...memoData }
})

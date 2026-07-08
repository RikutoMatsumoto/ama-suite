// ============================================================
// 商品メモ取得API（認可チェック付き）
//
// 保存API（memo.post.ts）と対になる読み込み用。
// ここでも「検証済みの本人のuid」のフォルダからしか読まないので、
// 他人のメモは絶対に返らない。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const asin = getRouterParam(event, 'asin')
  if (!asin) {
    throw createError({ statusCode: 400, statusMessage: 'ASINが指定されていません' })
  }

  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('memos').doc(asin)
    .get()

  // まだメモを保存したことがなければ空を返す
  if (!doc.exists) {
    return { asin, supplier: '', note: '', updatedAt: null }
  }

  return { asin, ...doc.data() }
})

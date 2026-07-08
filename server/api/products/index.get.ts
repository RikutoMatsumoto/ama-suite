// ============================================================
// 商品一覧取得API（認可チェック付き）
//
// GET /api/products
// ログイン中のユーザーが登録した商品だけを返す。
// メモ機能と同じく users/{検証済みuid}/products/ から読むので、
// 他人の商品リストは構造上見えない。
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  const snap = await adminFirestore()
    .collection('users').doc(uid)
    .collection('products')
    .orderBy('createdAt', 'desc')
    .get()

  // Firestoreのドキュメント一覧を、フロントで使いやすい配列に変換
  const products = snap.docs.map(doc => ({
    asin: doc.id,
    ...doc.data(),
  }))

  return { products }
})

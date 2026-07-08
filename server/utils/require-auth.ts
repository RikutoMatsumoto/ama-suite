// ============================================================
// 認証チェックの共通処理
//
// 【何をする関数？】
// リクエストの Authorization ヘッダーからIDトークンを取り出し、
// Firebaseに「これは本物のトークン？」と検証してもらう。
// 本物なら「そのユーザーのuid」を返し、偽物・無しなら401エラーを投げる。
//
// 【使い方（各APIの先頭に1行書くだけ）】
// const uid = await requireAuth(event)
// ============================================================

import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event): Promise<string> {
  // Authorizationヘッダーは「Bearer トークン文字列」という形式で届く
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'ログインが必要です',
    })
  }

  // "Bearer " の後ろの部分（トークン本体）を取り出す
  const idToken = authHeader.slice('Bearer '.length)

  try {
    // Firebaseにトークンを検証してもらう
    // 改ざんされていたり期限切れならここで例外が発生する
    const decoded = await adminAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: '認証情報が無効です。再度ログインしてください',
    })
  }
}

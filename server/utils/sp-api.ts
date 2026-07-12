// ============================================================
// Amazon SP-API 接続ユーティリティ
//
// 【認証の仕組み（LWA = Login with Amazon）】
// SP-APIは「リフレッシュトークン → アクセストークン」の2段階。
// ・リフレッシュトークン … セルフ認可で1回だけ発行される長命の鍵（.envに保管）
// ・アクセストークン     … 上の鍵と引き換えに毎回もらう短命の鍵（1時間で失効）
// Stripeのように1本のキーで済まない分、キーが漏れても
// 「シークレットとリフレッシュトークンの両方」が無いと悪用できない設計。
//
// ※ 2023年10月以降、AWSのIAM署名（SigV4）は不要になり、
//    LWAアクセストークンだけで呼び出せるようになった（実装が大幅に簡単に）
// ============================================================

// 日本のマーケットプレイス情報
export const JP_MARKETPLACE_ID = 'A1VC38T7YXB528'
// SP-APIのエンドポイントは地域ごとに分かれている。日本は極東（Far East）
const SPAPI_ENDPOINT = 'https://sellingpartnerapi-fe.amazon.com'
// LWAのトークン発行はグローバル共通
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

// ------------------------------------------------------------
// オーナー認可チェック
//
// 【なぜ必要か？】
// SP-APIの認証情報はサーバー全体で1セット＝「オーナーのセラーアカウントの鍵」。
// 何もチェックしないと、デモアカウントを含む全ログインユーザーから
// オーナーの実注文・実在庫が見えてしまう。
// そこで「.envに書いたメールアドレスのアカウントだけ」に実データを許可する。
// ------------------------------------------------------------
import type { H3Event } from 'h3'

// このuidがオーナー（実データを見てよいアカウント）かどうか
// 認証情報が未設定の場合も false（=実データ機能は無効）
export async function isSpApiOwner(uid: string): Promise<boolean> {
  const config = useRuntimeConfig()
  if (!config.spapiOwnerEmail || !config.spapiClientId
    || !config.spapiClientSecret || !config.spapiRefreshToken) {
    return false
  }

  const user = await adminAuth().getUser(uid)
  return (user.email ?? '').toLowerCase() === config.spapiOwnerEmail.toLowerCase()
}

export async function requireSpApiOwner(event: H3Event): Promise<string> {
  const uid = await requireAuth(event)

  if (!(await isSpApiOwner(uid))) {
    throw createError({ statusCode: 403, statusMessage: 'Amazon実データはオーナーアカウントのみ閲覧できます' })
  }
  return uid
}

// ------------------------------------------------------------
// アクセストークンの取得（メモリキャッシュ付き）
// 1時間有効なので、失効5分前まで使い回してAPI呼び出しを節約する
// ------------------------------------------------------------
let cachedToken: { token: string, expiresAt: number } | null = null

export async function getSpApiAccessToken(): Promise<string> {
  const config = useRuntimeConfig()
  if (!config.spapiClientId || !config.spapiClientSecret || !config.spapiRefreshToken) {
    throw createError({ statusCode: 503, statusMessage: 'SP-APIの認証情報が設定されていません' })
  }

  // キャッシュが生きていればそれを返す
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  // リフレッシュトークンと引き換えにアクセストークンをもらう
  const res = await $fetch<{ access_token: string, expires_in: number }>(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.spapiRefreshToken,
      client_id: config.spapiClientId,
      client_secret: config.spapiClientSecret,
    }).toString(),
  })

  cachedToken = {
    token: res.access_token,
    expiresAt: Date.now() + (res.expires_in - 300) * 1000, // 失効5分前に更新
  }
  return res.access_token
}

// ------------------------------------------------------------
// SP-API呼び出しの共通ヘルパー
// 例: callSpApi('/orders/v0/orders', { MarketplaceIds: JP_MARKETPLACE_ID })
// ------------------------------------------------------------
export async function callSpApi<T>(
  path: string,
  query: Record<string, string | number> = {},
): Promise<T> {
  const token = await getSpApiAccessToken()

  return $fetch<T>(`${SPAPI_ENDPOINT}${path}`, {
    query,
    headers: {
      'x-amz-access-token': token, // これが「本人のセラーデータにアクセスできる証明」
    },
    timeout: 15_000,
  })
}

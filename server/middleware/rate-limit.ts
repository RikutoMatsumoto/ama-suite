// ============================================================
// レートリミット（Nitroミドルウェア）
//
// 【server/middleware/ とは？】
// ここに置いたファイルは「全てのリクエストが来るたびに」
// APIの処理より先に自動実行される。
// Railsで使ったrack-attackと同じ「検問所」の役割。
//
// 【仕組み】
// IPアドレスごとに「直近60秒間のアクセス回数」をメモリ上で数え、
// 上限を超えたら429エラーを返す。
//
// 【制限事項（実務メモ）】
// メモリ上のカウントなので、サーバーが複数台に増えた場合は
// 台数分だけ上限が緩くなる。厳密にやるならRedis等の
// 共有ストアに載せ替える（rack-attackも同じ構造）。
// ============================================================

const WINDOW_MS = 60_000 // 60秒間
const MAX_REQUESTS = 60  // 1分あたり60回まで（通常操作では到達しない値）

// IPごとのアクセス記録（メモリ上）
const hits = new Map<string, number[]>()

export default defineEventHandler((event) => {
  // 対象は /api/ 配下だけ（画面表示は制限しない）
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  // Stripe Webhookは除外（Stripe側の再送も正当なアクセスのため）
  if (path === '/api/billing/webhook') return

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const now = Date.now()

  // このIPの記録から、60秒より古いものを捨てて数え直す
  const timestamps = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  timestamps.push(now)
  hits.set(ip, timestamps)

  if (timestamps.length > MAX_REQUESTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'リクエストが多すぎます。しばらく待ってから再度お試しください',
    })
  }
})

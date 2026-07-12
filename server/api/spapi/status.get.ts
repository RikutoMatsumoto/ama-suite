// ============================================================
// SP-API接続テストAPI（認可チェック付き）
//
// GET /api/spapi/status
//
// Sellers API の getMarketplaceParticipations を呼ぶ。
// 「このセラーアカウントがどのマーケットプレイスに参加しているか」を
// 返すだけの一番シンプルなAPIなので、疎通確認にちょうどいい。
// これが通れば LWA認証（リフレッシュトークン→アクセストークン）が
// 正しく機能している証明になる。
// ============================================================

interface MarketplaceParticipations {
  payload: {
    marketplace: {
      id: string
      name: string
      countryCode: string
      domainName: string
    }
    participation: {
      isParticipating: boolean
    }
  }[]
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const config = useRuntimeConfig()
  const configured = Boolean(
    config.spapiClientId && config.spapiClientSecret && config.spapiRefreshToken,
  )
  if (!configured) {
    return { connected: false, reason: '認証情報が未設定です（.envのNUXT_SPAPI_*）' }
  }

  try {
    const res = await callSpApi<MarketplaceParticipations>('/sellers/v1/marketplaceParticipations')

    // 参加しているマーケットプレイス一覧（日本が含まれているはず）
    const marketplaces = res.payload
      .filter(p => p.participation.isParticipating)
      .map(p => ({
        id: p.marketplace.id,
        name: p.marketplace.name,
        country: p.marketplace.countryCode,
      }))

    return {
      connected: true,
      marketplaces,
      joinedJapan: marketplaces.some(m => m.id === JP_MARKETPLACE_ID),
    }
  } catch (err: unknown) {
    // 失敗理由をそのまま返す（デバッグしやすくする。秘密情報は含まれない）
    const fetchError = err as { status?: number, statusMessage?: string, message?: string }
    return {
      connected: false,
      reason: `SP-API呼び出しに失敗しました（${fetchError.status ?? '?'}）: ${fetchError.statusMessage ?? fetchError.message ?? '不明なエラー'}`,
    }
  }
})

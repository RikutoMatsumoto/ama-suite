// ============================================================
// 現在のプラン情報を取得・共有するコンポーザブル
//
// 【コンポーザブルとは？】
// Vueの「ページやコンポーネントをまたいで使い回すロジック」の置き場。
// app/composables/ に置くと importなしでどこからでも呼べる（Nuxtの規約）。
//
// useState はNuxt版のグローバルな ref。
// 一度取得したプラン情報をページ間で共有できるので、
// 商品一覧→商品詳細と移動してもAPIを何度も叩かずに済む。
// ============================================================

export interface PlanInfo {
  plan: 'starter' | 'standard' | 'pro' | null
  status: 'active' | 'trial' | 'expired'
  label: string
  maxProducts: number | null
  maxHistoryDays: number
  trialDaysLeft: number | null
}

export function usePlan() {
  const planInfo = useState<PlanInfo | null>('plan-info', () => null)

  // プラン情報をAPIから読み込む（取得済みならそれを返す）
  async function loadPlan(force = false): Promise<PlanInfo | null> {
    if (planInfo.value && !force) return planInfo.value

    try {
      const token = await useAuthStore().getIdToken()
      const res = await $fetch<{ resolved: PlanInfo }>('/api/billing/subscription', {
        headers: { Authorization: `Bearer ${token}` },
      })
      planInfo.value = res.resolved
    }
    catch {
      // 取得失敗時はnullのまま（制限表示なしで動作は継続）
    }
    return planInfo.value
  }

  return { planInfo, loadPlan }
}

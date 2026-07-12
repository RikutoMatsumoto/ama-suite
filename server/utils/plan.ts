// ============================================================
// プラン判定と機能制限の定義（サーバー側の唯一の正解）
//
// 【なぜサーバー側に持つのか？】
// フロントで「あなたはスターターだから50件まで」と表示するのは
// あくまで案内。本当の制限はサーバー側でチェックしないと、
// APIを直接叩かれたときに制限を回避されてしまう。
// （checkout.post.tsで金額をサーバー側に持つのと同じ発想）
//
// 【プランの決まり方】
// ① Stripeで契約中（status: 'active'）→ そのプランの制限
// ② 未契約でアカウント作成から14日以内 → 無料トライアル
//    （LPの「14日間無料」の実装。スタンダード相当の機能が使える）
// ③ トライアル終了後 → スターター相当の制限で閲覧は継続できる
//    （突然何も見えなくなるより、制限付きで残して課金導線につなげる）
// ============================================================

export type PlanId = 'starter' | 'standard' | 'pro'

export interface PlanLimits {
  label: string
  maxProducts: number | null // 商品登録の上限（null = 無制限）
  maxHistoryDays: number // 価格グラフで見られる最大日数
}

// LPの料金表と対応（変えるときはLP側も揃えること）
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: { label: 'スタータープラン', maxProducts: 50, maxHistoryDays: 90 },
  standard: { label: 'スタンダードプラン', maxProducts: null, maxHistoryDays: 365 },
  pro: { label: 'プロプラン', maxProducts: null, maxHistoryDays: 365 },
}

const TRIAL_DAYS = 14

export interface ResolvedPlan extends PlanLimits {
  plan: PlanId | null // 契約中のプランID（トライアル・期限切れは null）
  status: 'active' | 'trial' | 'expired'
  trialDaysLeft: number | null // トライアル残日数（トライアル中のみ）
}

// ユーザーの現在のプランと制限を判定する
export async function resolvePlan(uid: string): Promise<ResolvedPlan> {
  // ① 有効なStripe契約があるか（Webhookが保存した契約状態を見る）
  const doc = await adminFirestore()
    .collection('users').doc(uid)
    .collection('billing').doc('subscription')
    .get()

  const data = doc.exists ? doc.data()! : null
  if (data?.status === 'active' && (data.plan as string) in PLAN_LIMITS) {
    const planId = data.plan as PlanId
    return { plan: planId, status: 'active', trialDaysLeft: null, ...PLAN_LIMITS[planId] }
  }

  // ② 未契約 → アカウント作成日からトライアル判定
  // （作成日はFirebase Authが持っているので、自前で保存しなくてよい）
  const user = await adminAuth().getUser(uid)
  const createdAt = new Date(user.metadata.creationTime).getTime()
  const daysUsed = (Date.now() - createdAt) / 86_400_000

  if (daysUsed <= TRIAL_DAYS) {
    return {
      plan: null,
      status: 'trial',
      trialDaysLeft: Math.max(0, Math.ceil(TRIAL_DAYS - daysUsed)),
      ...PLAN_LIMITS.standard, // トライアル中はスタンダード相当
      label: '無料トライアル',
    }
  }

  // ③ トライアル終了 → スターター相当の制限
  return {
    plan: null,
    status: 'expired',
    trialDaysLeft: 0,
    ...PLAN_LIMITS.starter,
    label: '無料プラン（トライアル終了）',
  }
}

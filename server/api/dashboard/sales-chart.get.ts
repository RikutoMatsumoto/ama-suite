// ============================================================
// 売上推移グラフ用データAPI（認可チェック付き）
//
// GET /api/dashboard/sales-chart
// 直近30日間の注文を日別に集計して返す。
//
// レスポンス例:
// {
//   labels: ["6/10", "6/11", ..., "7/9"],   ← 30日分の日付
//   sales:  [0, 11000, 0, ...],             ← 日別売上
//   profit: [0, 6020, 0, ...]               ← 日別利益
// }
// 注文がない日も0で埋める（グラフの横軸を揃えるため）
// ============================================================

export default defineEventHandler(async (event) => {
  const uid = await requireAuth(event)

  // 30日前の0時を起点にする
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)

  const snap = await adminFirestore()
    .collection('users').doc(uid)
    .collection('orders')
    .where('createdAt', '>=', start.toISOString())
    .get()

  // 日付キー（"YYYY-M-D"）ごとに売上・利益を合算する箱を用意
  const salesByDay = new Map<string, { sales: number, profit: number }>()

  snap.forEach((doc) => {
    const data = doc.data()
    const d = new Date(data.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const current = salesByDay.get(key) ?? { sales: 0, profit: 0 }
    current.sales += Number(data.total ?? 0)
    current.profit += Number(data.profit ?? 0)
    salesByDay.set(key, current)
  })

  // 30日分の配列を作る（データがない日は0）
  const labels: string[] = []
  const sales: number[] = []
  const profit: number[] = []

  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const day = salesByDay.get(key)

    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    sales.push(day?.sales ?? 0)
    profit.push(day?.profit ?? 0)
  }

  return { labels, sales, profit }
})

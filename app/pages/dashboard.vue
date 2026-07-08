<template>
  <div class="space-y-8">

    <!-- ページタイトル -->
    <div>
      <h2 class="text-2xl font-black" style="color: #1B2A4A;">ダッシュボード</h2>
      <p class="text-sm text-gray-500 mt-1">AmaSuite へようこそ。ビジネスの状況を一目で確認できます。</p>
    </div>

    <!-- KPIカード -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      <div
        v-for="kpi in kpiCards"
        :key="kpi.label"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4"
      >
        <!-- アイコン背景 -->
        <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" :style="`background-color: ${kpi.bgColor}`">
          <UIcon :name="kpi.icon" class="text-xl" :style="`color: ${kpi.iconColor}`" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-500 truncate">{{ kpi.label }}</p>
          <p class="text-2xl font-black mt-0.5" style="color: #1B2A4A;">{{ kpi.value }}</p>
          <p class="text-xs mt-1 font-medium" :class="kpi.change >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ kpi.change >= 0 ? '▲' : '▼' }} 先月比 {{ Math.abs(kpi.change) }}%
          </p>
        </div>
      </div>
    </div>

    <!-- グラフ + 要対応 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- 売上グラフ -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-bold text-base" style="color: #1B2A4A;">売上推移</h3>
            <p class="text-xs text-gray-400 mt-0.5">直近30日間</p>
          </div>
          <UBadge label="更新: 1時間前" color="neutral" variant="subtle" size="sm" />
        </div>
        <div class="h-64 flex flex-col items-center justify-center text-gray-300 gap-3">
          <UIcon name="i-lucide-bar-chart-2" class="text-5xl" />
          <p class="text-sm text-gray-400">APIと接続後にグラフが表示されます</p>
        </div>
      </div>

      <!-- 要対応リスト -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="px-6 py-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-base" style="color: #1B2A4A;">要対応</h3>
            <span
              v-if="alerts.length > 0"
              class="text-xs font-bold text-white px-2 py-0.5 rounded-full"
              style="background-color: #F7931E;"
            >{{ alerts.length }}</span>
          </div>
        </div>
        <div class="p-4 space-y-3">
          <div
            v-for="alert in alerts"
            :key="alert.id"
            class="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
          >
            <div
              class="w-2 h-2 rounded-full mt-1.5 shrink-0"
              :class="alert.color === 'error' ? 'bg-red-500' : alert.color === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'"
            />
            <div class="min-w-0">
              <p class="text-xs font-semibold text-gray-700">{{ alert.type }}</p>
              <p class="text-xs text-gray-500 mt-0.5">{{ alert.message }}</p>
            </div>
          </div>
          <p v-if="alerts.length === 0" class="text-sm text-gray-400 text-center py-6">
            対応が必要な項目はありません ✅
          </p>
        </div>
      </div>
    </div>

    <!-- 最近の注文 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h3 class="font-bold text-base" style="color: #1B2A4A;">最近の注文</h3>
          <p class="text-xs text-gray-400 mt-0.5">直近の取引履歴</p>
        </div>
        <UButton
          to="/orders"
          variant="outline"
          label="すべて見る"
          size="sm"
          icon="i-lucide-arrow-right"
          trailing
        />
      </div>
      <div class="p-4">
        <div v-if="recentOrders.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-300 gap-3">
          <UIcon name="i-lucide-shopping-bag" class="text-5xl" />
          <p class="text-sm text-gray-400">注文データはAPIと接続後に表示されます</p>
        </div>
        <UTable v-else :data="recentOrders" :columns="orderColumns" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

// -------------------------------------------------------
// KPIデータの取得
// 認証（IDトークン）が必要になったため、useFetchではなく
// 「画面表示後にトークン付きで取得する」方式に変更
// -------------------------------------------------------
const authStore = useAuthStore()

interface Summary {
  monthlySales: number
  monthlyProfit: number
  totalExpectedProfit: number
  productCount: number
  outOfStockCount: number
}

interface Order {
  id: string
  productName: string
  quantity: number
  total: number
  profit: number
  createdAt: string
}

const summary = ref<Summary | null>(null)
const recentOrders = ref<Order[]>([])

onMounted(async () => {
  try {
    const token = await authStore.getIdToken()
    const headers = { Authorization: `Bearer ${token}` }

    // KPIと最近の注文を並行して取得
    // Promise.all：複数の通信を同時に投げて、両方終わるのを待つ
    const [summaryRes, ordersRes] = await Promise.all([
      $fetch<Summary>('/api/dashboard/summary', { headers }),
      $fetch<{ orders: Order[] }>('/api/orders', { headers }),
    ])
    summary.value = summaryRes
    recentOrders.value = ordersRes.orders.slice(0, 5) // 直近5件だけ表示
  }
  catch {
    // 取得失敗時は0のまま表示
  }
})

const kpiCards = computed(() => [
  {
    label: '今月の売上',
    value: `¥${(summary.value?.monthlySales ?? 0).toLocaleString()}`,
    change: 0,
    icon: 'i-lucide-trending-up',
    bgColor: '#EFF6FF',
    iconColor: '#3B82F6',
  },
  {
    label: '今月の利益',
    value: `¥${(summary.value?.monthlyProfit ?? 0).toLocaleString()}`,
    change: 0,
    icon: 'i-lucide-circle-dollar-sign',
    bgColor: '#F0FDF4',
    iconColor: '#22C55E',
  },
  {
    label: '登録商品数',
    value: `${summary.value?.productCount ?? 0}件`,
    change: 0,
    icon: 'i-lucide-package',
    bgColor: '#FFF7ED',
    iconColor: '#F7931E',
  },
  {
    label: '在庫切れ',
    value: `${summary.value?.outOfStockCount ?? 0}件`,
    change: 0,
    icon: 'i-lucide-alert-triangle',
    bgColor: '#FFF1F2',
    iconColor: '#EF4444',
  },
])

// 要対応リスト：在庫切れがあれば表示
const alerts = computed(() => {
  const count = summary.value?.outOfStockCount ?? 0
  if (count === 0) return []
  return [
    { id: 1, type: '在庫切れ', color: 'error' as const, message: `${count}件の商品が在庫切れです。在庫管理から補充しましょう` },
  ]
})

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const orderColumns = [
  {
    accessorKey: 'createdAt',
    header: '日時',
    cell: ({ row }: { row: { getValue: <T>(key: string) => T } }) => formatDate(row.getValue<string>('createdAt')),
  },
  { accessorKey: 'productName', header: '商品名' },
  {
    accessorKey: 'total',
    header: '売上',
    cell: ({ row }: { row: { getValue: <T>(key: string) => T } }) => `¥${row.getValue<number>('total').toLocaleString()}`,
  },
  {
    accessorKey: 'profit',
    header: '利益',
    cell: ({ row }: { row: { getValue: <T>(key: string) => T } }) => `¥${row.getValue<number>('profit').toLocaleString()}`,
  },
]
</script>

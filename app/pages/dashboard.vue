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
// useFetch：Nuxt標準のデータ取得関数
// $fetchとの違いは「ページ表示と同時に自動で呼ばれる」こと
// ここでは Nitro の server/api/dashboard/summary を呼んでいる
// -------------------------------------------------------
const { data: summary } = await useFetch('/api/dashboard/summary')

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
    label: '在庫商品数',
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

const alerts = [
  { id: 1, type: '在庫切れ', color: 'error' as const, message: 'API接続後に表示されます' },
]

const orderColumns = [
  { accessorKey: 'date', header: '日付' },
  { accessorKey: 'productName', header: '商品名' },
  { accessorKey: 'price', header: '売上' },
  { accessorKey: 'profit', header: '利益' },
  { accessorKey: 'status', header: 'ステータス' },
]

const recentOrders: never[] = []
</script>

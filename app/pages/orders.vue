<template>
  <div class="space-y-4">
    <!-- ================================================== -->
    <!-- Amazon実注文（SP-API・オーナーアカウントのみ表示） -->
    <!-- ================================================== -->
    <UCard v-if="amazonData">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-shopping-cart" />
            Amazon実注文（直近{{ amazonData.summary.days }}日）
            <UBadge label="SP-API" color="success" variant="subtle" size="sm" />
          </h2>
          <UButton
            icon="i-lucide-refresh-cw"
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="amazonLoading"
            @click="loadAmazonOrders(true)"
          />
        </div>
      </template>

      <!-- サマリー -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500">売上合計</p>
          <p class="text-xl font-bold">¥{{ amazonData.summary.totalSales.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">注文数</p>
          <p class="text-xl font-bold">{{ amazonData.summary.orderCount }}件</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">保留中</p>
          <p class="text-xl font-bold">{{ amazonData.summary.pendingCount }}件</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">キャンセル</p>
          <p class="text-xl font-bold text-gray-400">{{ amazonData.summary.canceledCount }}件</p>
        </div>
      </div>

      <!-- 実注文テーブル -->
      <UTable :data="amazonData.orders" :columns="amazonColumns" />
      <p class="text-right text-xs text-gray-400 mt-2">
        最終更新: {{ formatDate(amazonData.updatedAt) }}（15分キャッシュ）
      </p>
    </UCard>

    <!-- ================================================== -->
    <!-- 手動の注文記録（従来機能） -->
    <!-- ================================================== -->
    <!-- 操作バー -->
    <div class="flex items-center justify-end">
      <UButton icon="i-lucide-plus" label="注文を記録" @click="showAddModal = true" />
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />

    <!-- 注文テーブル -->
    <UCard>
      <UTable :data="orders" :columns="columns" :loading="loading" />
      <p v-if="!loading && orders.length === 0" class="text-center text-sm text-gray-400 py-8">
        まだ注文がありません。「注文を記録」から売上を記録してみましょう。
      </p>
    </UCard>

    <!-- 注文記録モーダル -->
    <UModal v-model:open="showAddModal" title="注文を記録">
      <template #body>
        <UForm :state="newOrder" class="space-y-4" @submit="addOrder">
          <UFormField label="商品" name="asin" required>
            <USelect
              v-model="newOrder.asin"
              :items="productOptions"
              placeholder="商品を選択"
              class="w-full"
            />
          </UFormField>
          <UFormField label="販売価格 (円)" name="salePrice" required>
            <UInput v-model="newOrder.salePrice" type="number" placeholder="3980" class="w-full" />
          </UFormField>
          <UFormField label="個数" name="quantity" required>
            <UInput v-model="newOrder.quantity" type="number" placeholder="1" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton label="キャンセル" color="neutral" variant="ghost" @click="showAddModal = false" />
            <UButton type="submit" label="記録する" :loading="adding" />
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()

// -------------------------------------------------------
// Amazon実注文（SP-API）
// オーナーアカウント以外は403が返るので、その場合はセクションごと非表示
// -------------------------------------------------------
type AmazonOrder = {
  orderId: string
  purchaseDate: string
  status: string
  total: number | null
  itemCount: number
  fulfillment: string
}

interface AmazonOrdersData {
  orders: AmazonOrder[]
  summary: {
    days: number
    orderCount: number
    totalSales: number
    itemCount: number
    pendingCount: number
    canceledCount: number
  }
  updatedAt: string
}

const amazonData = ref<AmazonOrdersData | null>(null)
const amazonLoading = ref(false)

async function loadAmazonOrders(refresh = false) {
  amazonLoading.value = true
  try {
    amazonData.value = await $fetch<AmazonOrdersData>('/api/spapi/orders', {
      query: refresh ? { refresh: '1' } : {},
      headers: await authHeaders(),
    })
  }
  catch {
    // 403（オーナー以外）や未設定の場合は何も表示しない
    amazonData.value = null
  }
  finally {
    amazonLoading.value = false
  }
}

// 注文ステータスの日本語表示とバッジ色
const statusLabels: Record<string, { label: string, color: 'success' | 'warning' | 'neutral' | 'error' }> = {
  Shipped: { label: '発送済み', color: 'success' },
  Pending: { label: '保留中', color: 'warning' },
  Unshipped: { label: '未発送', color: 'warning' },
  PartiallyShipped: { label: '一部発送', color: 'warning' },
  Canceled: { label: 'キャンセル', color: 'neutral' },
}

const UBadge = resolveComponent('UBadge')

const amazonColumns: TableColumn<AmazonOrder>[] = [
  {
    accessorKey: 'purchaseDate',
    header: '注文日時',
    cell: ({ row }) => formatDate(row.getValue<string>('purchaseDate')),
  },
  {
    accessorKey: 'orderId',
    header: '注文番号',
  },
  {
    accessorKey: 'status',
    header: '状態',
    cell: ({ row }) => {
      const s = statusLabels[row.getValue<string>('status')] ?? { label: row.getValue<string>('status'), color: 'neutral' as const }
      return h(UBadge, { label: s.label, color: s.color, variant: 'subtle', size: 'sm' })
    },
  },
  {
    accessorKey: 'fulfillment',
    header: '配送',
  },
  {
    accessorKey: 'itemCount',
    header: '商品数',
    cell: ({ row }) => `${row.getValue<number>('itemCount')}点`,
  },
  {
    accessorKey: 'total',
    header: '合計',
    cell: ({ row }) => {
      const total = row.getValue<number | null>('total')
      return total === null ? '—' : `¥${total.toLocaleString()}`
    },
  },
]

type Order = {
  id: string
  asin: string
  productName: string
  quantity: number
  salePrice: number
  total: number
  profit: number
  createdAt: string
}

const orders = ref<Order[]>([])
const loading = ref(false)
const showAddModal = ref(false)
const adding = ref(false)
const errorMessage = ref('')
const newOrder = reactive({ asin: '', salePrice: 0, quantity: 1 })

// 商品選択のプルダウン用（登録済み商品から選ぶ）
const productOptions = ref<{ label: string, value: string }[]>([])

async function authHeaders() {
  const token = await authStore.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await $fetch<{ orders: Order[] }>('/api/orders', {
      headers: await authHeaders(),
    })
    orders.value = res.orders
  }
  catch {
    errorMessage.value = '注文一覧の取得に失敗しました'
  }
  finally {
    loading.value = false
  }
}

async function loadProducts() {
  try {
    const res = await $fetch<{ products: { asin: string, productName: string, currentPrice: number }[] }>('/api/products', {
      headers: await authHeaders(),
    })
    productOptions.value = res.products.map(p => ({
      label: `${p.productName}（${p.asin}）`,
      value: p.asin,
    }))
  }
  catch {
    // 商品が読めなくても注文一覧は表示する
  }
}

onMounted(() => {
  loadOrders()
  loadProducts()
  loadAmazonOrders() // オーナーの場合のみ実注文セクションが表示される
})

async function addOrder() {
  adding.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/orders', {
      method: 'POST',
      headers: await authHeaders(),
      body: {
        asin: newOrder.asin,
        salePrice: Number(newOrder.salePrice),
        quantity: Number(newOrder.quantity),
      },
    })
    showAddModal.value = false
    Object.assign(newOrder, { asin: '', salePrice: 0, quantity: 1 })
    await loadOrders()
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string } }
    errorMessage.value = fetchError.data?.statusMessage ?? '注文の記録に失敗しました'
    showAddModal.value = false
  }
  finally {
    adding.value = false
  }
}

// 日付を「2026/07/08 10:30」形式にする
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const columns: TableColumn<Order>[] = [
  {
    accessorKey: 'createdAt',
    header: '日時',
    cell: ({ row }) => formatDate(row.getValue<string>('createdAt')),
  },
  {
    accessorKey: 'productName',
    header: '商品名',
  },
  {
    accessorKey: 'quantity',
    header: '個数',
    cell: ({ row }) => `${row.getValue<number>('quantity')}個`,
  },
  {
    accessorKey: 'total',
    header: '売上',
    cell: ({ row }) => `¥${row.getValue<number>('total').toLocaleString()}`,
  },
  {
    accessorKey: 'profit',
    header: '利益',
    cell: ({ row }) => {
      const profit = row.getValue<number>('profit')
      return h('span', {
        class: profit >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold',
      }, `¥${profit.toLocaleString()}`)
    },
  },
]
</script>

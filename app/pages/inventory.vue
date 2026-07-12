<template>
  <div class="space-y-4">
    <!-- ================================================== -->
    <!-- Amazon FBA実在庫（SP-API・オーナーアカウントのみ表示） -->
    <!-- ================================================== -->
    <UCard v-if="fbaData">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-warehouse" />
            Amazon FBA実在庫
            <UBadge label="SP-API" color="success" variant="subtle" size="sm" />
          </h2>
          <UButton
            icon="i-lucide-refresh-cw"
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="fbaLoading"
            @click="loadFbaInventory(true)"
          />
        </div>
      </template>

      <!-- サマリー -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500">総在庫数</p>
          <p class="text-xl font-bold">{{ fbaData.summary.totalUnits.toLocaleString() }}個</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">在庫ありSKU</p>
          <p class="text-xl font-bold">{{ fbaData.summary.activeSkus }}件</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">納品中</p>
          <p class="text-xl font-bold">{{ fbaData.summary.inboundUnits.toLocaleString() }}個</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">全SKU（直近1年）</p>
          <p class="text-xl font-bold text-gray-400">{{ fbaData.summary.allSkus }}件</p>
        </div>
      </div>

      <!-- FBA在庫テーブル -->
      <UTable :data="fbaData.items" :columns="fbaColumns" />
      <p v-if="fbaData.items.length === 0" class="text-center text-sm text-gray-400 py-4">
        現在、在庫あり・納品中のSKUはありません。
      </p>
      <p class="text-right text-xs text-gray-400 mt-2">
        最終更新: {{ formatFbaDate(fbaData.updatedAt) }}（15分キャッシュ）
      </p>
    </UCard>

    <!-- ================================================== -->
    <!-- 手動の在庫管理（従来機能） -->
    <!-- ================================================== -->
    <!-- 在庫サマリー -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard>
        <p class="text-xs text-gray-500">総在庫数</p>
        <p class="text-2xl font-black" style="color: #1B2A4A;">{{ totalStock }}個</p>
      </UCard>
      <UCard>
        <p class="text-xs text-gray-500">在庫あり商品</p>
        <p class="text-2xl font-black text-emerald-600">{{ inStockCount }}件</p>
      </UCard>
      <UCard>
        <p class="text-xs text-gray-500">在庫切れ商品</p>
        <p class="text-2xl font-black" :class="outOfStockCount > 0 ? 'text-red-500' : 'text-gray-400'">
          {{ outOfStockCount }}件
        </p>
      </UCard>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />

    <!-- 在庫テーブル -->
    <UCard>
      <UTable :data="products" :columns="columns" :loading="loading" />
      <p v-if="!loading && products.length === 0" class="text-center text-sm text-gray-400 py-8">
        商品が登録されていません。先に「商品管理」から商品を登録してください。
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()

type Product = {
  asin: string
  productName: string
  currentPrice: number
  stock?: number
}

const products = ref<Product[]>([])
const loading = ref(false)
const errorMessage = ref('')

// -------------------------------------------------------
// Amazon FBA実在庫（SP-API）
// オーナーアカウント以外は403が返るので、その場合はセクションごと非表示
// -------------------------------------------------------
type FbaItem = {
  asin: string
  sku: string
  productName: string
  total: number
  fulfillable: number
  inbound: number
  reserved: number
}

interface FbaData {
  items: FbaItem[]
  summary: { allSkus: number, activeSkus: number, totalUnits: number, inboundUnits: number }
  updatedAt: string
}

const fbaData = ref<FbaData | null>(null)
const fbaLoading = ref(false)

async function loadFbaInventory(refresh = false) {
  fbaLoading.value = true
  try {
    fbaData.value = await $fetch<FbaData>('/api/spapi/inventory', {
      query: refresh ? { refresh: '1' } : {},
      headers: await authHeaders(),
    })
  }
  catch {
    // 403（オーナー以外）や未設定の場合は何も表示しない
    fbaData.value = null
  }
  finally {
    fbaLoading.value = false
  }
}

function formatFbaDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fbaColumns: TableColumn<FbaItem>[] = [
  {
    accessorKey: 'productName',
    header: '商品名',
  },
  {
    accessorKey: 'asin',
    header: 'ASIN',
  },
  {
    accessorKey: 'fulfillable',
    header: '販売可能',
    cell: ({ row }) => h('span', { class: 'font-bold' }, `${row.getValue<number>('fulfillable')}個`),
  },
  {
    accessorKey: 'inbound',
    header: '納品中',
    cell: ({ row }) => {
      const n = row.getValue<number>('inbound')
      return n > 0 ? h('span', { class: 'text-blue-600' }, `${n}個`) : '—'
    },
  },
  {
    accessorKey: 'reserved',
    header: '予約済み',
    cell: ({ row }) => {
      const n = row.getValue<number>('reserved')
      return n > 0 ? `${n}個` : '—'
    },
  },
  {
    accessorKey: 'total',
    header: '合計',
    cell: ({ row }) => `${row.getValue<number>('total')}個`,
  },
]

// 集計（在庫サマリーカード用）
const totalStock = computed(() => products.value.reduce((sum, p) => sum + (p.stock ?? 0), 0))
const inStockCount = computed(() => products.value.filter(p => (p.stock ?? 0) > 0).length)
const outOfStockCount = computed(() => products.value.filter(p => (p.stock ?? 0) === 0).length)

async function authHeaders() {
  const token = await authStore.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function loadProducts() {
  loading.value = true
  try {
    const res = await $fetch<{ products: Product[] }>('/api/products', {
      headers: await authHeaders(),
    })
    products.value = res.products
  }
  catch {
    errorMessage.value = '在庫一覧の取得に失敗しました'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProducts()
  loadFbaInventory() // オーナーの場合のみFBA実在庫セクションが表示される
})

// -------------------------------------------------------
// 在庫数の更新：+/-ボタンで増減し、PATCH APIに保存
// -------------------------------------------------------
async function updateStock(product: Product, newStock: number) {
  if (newStock < 0) return
  errorMessage.value = ''

  // 先に画面を更新（楽観的更新：待たずに反映してサクサク動かす）
  const oldStock = product.stock ?? 0
  product.stock = newStock

  try {
    await $fetch(`/api/products/${product.asin}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: { stock: newStock },
    })
  }
  catch {
    // 失敗したら元に戻す
    product.stock = oldStock
    errorMessage.value = '在庫数の更新に失敗しました'
  }
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const columns: TableColumn<Product>[] = [
  {
    accessorKey: 'productName',
    header: '商品名',
  },
  {
    accessorKey: 'asin',
    header: 'ASIN',
  },
  {
    id: 'status',
    header: '状態',
    cell: ({ row }) => {
      const stock = row.original.stock ?? 0
      return h(UBadge, {
        label: stock === 0 ? '在庫切れ' : '在庫あり',
        color: stock === 0 ? 'error' : 'success',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    id: 'stock',
    header: '在庫数',
    cell: ({ row }) => {
      const product = row.original
      const stock = product.stock ?? 0
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UButton, {
          icon: 'i-lucide-minus',
          size: 'xs',
          color: 'neutral',
          variant: 'outline',
          disabled: stock === 0,
          onClick: () => updateStock(product, stock - 1),
        }),
        h('span', { class: 'w-10 text-center font-bold' }, String(stock)),
        h(UButton, {
          icon: 'i-lucide-plus',
          size: 'xs',
          color: 'neutral',
          variant: 'outline',
          onClick: () => updateStock(product, stock + 1),
        }),
      ])
    },
  },
]
</script>

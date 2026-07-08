<template>
  <div class="space-y-4">
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

onMounted(loadProducts)

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

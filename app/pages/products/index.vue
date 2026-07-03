<template>
  <div class="space-y-4">
    <!-- 操作バー -->
    <div class="flex items-center justify-between gap-4">
      <UInput v-model="search" icon="i-lucide-search" placeholder="ASIN・商品名で検索" class="max-w-sm" />
      <UButton icon="i-lucide-plus" label="商品を追加" @click="showAddModal = true" />
    </div>

    <!-- 商品テーブル -->
    <UCard>
      <UTable :data="products" :columns="columns" :loading="loading" />
    </UCard>

    <!-- 商品追加モーダル -->
    <UModal v-model:open="showAddModal" title="商品を追加">
      <template #body>
        <UForm :state="newProduct" class="space-y-4" @submit="addProduct">
          <UFormField label="ASIN" name="asin" required>
            <UInput v-model="newProduct.asin" placeholder="例: B08N5WRWNW" class="w-full" />
          </UFormField>
          <UFormField label="仕入れ値 (円)" name="costPrice">
            <UInput v-model="newProduct.costPrice" type="number" placeholder="0" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton label="キャンセル" color="neutral" variant="ghost" @click="showAddModal = false" />
            <UButton type="submit" label="追加する" :loading="adding" />
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

const search = ref('')
const loading = ref(false)
const showAddModal = ref(false)
const adding = ref(false)
const newProduct = reactive({ asin: '', costPrice: 0 })

type Product = {
  asin: string
  productName: string
  currentPrice: number
  costPrice: number
  profit: number
  rank: number
}

const UButton = resolveComponent('UButton')

const columns: TableColumn<Product>[] = [
  {
    accessorKey: 'productName',
    header: '商品名',
  },
  {
    accessorKey: 'currentPrice',
    header: '現在価格',
    cell: ({ row }) => `¥${row.getValue<number>('currentPrice').toLocaleString()}`,
  },
  {
    accessorKey: 'costPrice',
    header: '仕入れ値',
    cell: ({ row }) => `¥${row.getValue<number>('costPrice').toLocaleString()}`,
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
  {
    accessorKey: 'rank',
    header: '売れ筋ランク',
    cell: ({ row }) => `${row.getValue<number>('rank').toLocaleString()}位`,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
      h(UButton, { to: `/products/${row.original.asin}`, icon: 'i-lucide-bar-chart-2', size: 'xs', color: 'neutral', variant: 'ghost' }),
      h(UButton, { icon: 'i-lucide-edit', size: 'xs', color: 'neutral', variant: 'ghost' }),
      h(UButton, { icon: 'i-lucide-trash-2', size: 'xs', color: 'error', variant: 'ghost' }),
    ]),
  },
]

const products = ref<Product[]>([
  {
    asin: 'B08N5WRWNW',
    productName: 'サンプル商品（API接続後に実データが表示されます）',
    currentPrice: 3980,
    costPrice: 1500,
    profit: 1200,
    rank: 1234,
  },
])

async function addProduct() {
  adding.value = true
  // TODO: Rails API へ商品登録リクエスト
  await new Promise(resolve => setTimeout(resolve, 800))
  adding.value = false
  showAddModal.value = false
}
</script>

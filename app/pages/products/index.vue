<template>
  <div class="space-y-4">
    <!-- 操作バー -->
    <div class="flex items-center justify-between gap-4">
      <UInput v-model="search" icon="i-lucide-search" placeholder="ASIN・商品名で検索" class="max-w-sm" />
      <div class="flex items-center gap-3">
        <!-- 登録上限のあるプランは「今何件 / 上限」を表示 -->
        <span v-if="planInfo?.maxProducts" class="text-sm text-gray-500">
          登録数 {{ products.length }} / {{ planInfo.maxProducts }}件
        </span>
        <!-- Amazon取り込み（SP-APIオーナーのみ表示） -->
        <UButton
          v-if="isSpApiOwner"
          icon="i-lucide-download"
          label="Amazonから取り込み"
          color="neutral"
          variant="outline"
          :loading="importing"
          @click="importFromAmazon"
        />
        <UButton
          icon="i-lucide-plus"
          label="商品を追加"
          :disabled="isAtLimit"
          :title="isAtLimit ? 'スタンダードプランなら無制限に登録できます' : undefined"
          @click="showAddModal = true"
        />
      </div>
    </div>

    <!-- 取り込み結果メッセージ -->
    <UAlert
      v-if="importMessage"
      color="success"
      variant="subtle"
      :description="importMessage"
    />

    <!-- エラーメッセージ -->
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />

    <!-- 商品テーブル -->
    <UCard>
      <UTable :data="filteredProducts" :columns="columns" :loading="loading" />
      <p v-if="!loading && products.length === 0" class="text-center text-sm text-gray-400 py-8">
        まだ商品が登録されていません。「商品を追加」から登録してみましょう。
      </p>
    </UCard>

    <!-- 商品追加モーダル -->
    <UModal v-model:open="showAddModal" title="商品を追加">
      <template #body>
        <UForm :state="newProduct" class="space-y-4" @submit="addProduct">
          <UFormField label="ASIN" name="asin" required help="Amazonの商品ページに記載されている10桁のID（例: B08N5WRWNW）">
            <UInput v-model="newProduct.asin" placeholder="例: B08N5WRWNW" class="w-full" />
          </UFormField>
          <UFormField label="商品名" name="productName" required help="SP-API連携までは手入力（連携後は自動取得予定）">
            <UInput v-model="newProduct.productName" placeholder="例: ワイヤレスイヤホン XYZ" class="w-full" />
          </UFormField>
          <UFormField label="現在価格 (円)" name="currentPrice" required>
            <UInput v-model="newProduct.currentPrice" type="number" placeholder="3980" class="w-full" />
          </UFormField>
          <UFormField label="仕入れ値 (円)" name="costPrice">
            <UInput v-model="newProduct.costPrice" type="number" placeholder="1500" class="w-full" />
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

const authStore = useAuthStore()

const search = ref('')
const loading = ref(false)
const showAddModal = ref(false)
const adding = ref(false)
const errorMessage = ref('')
const newProduct = reactive({ asin: '', productName: '', currentPrice: 0, costPrice: 0 })

type Product = {
  asin: string
  productName: string
  currentPrice: number
  costPrice: number
  profit: number
}

const products = ref<Product[]>([])

// -------------------------------------------------------
// プラン別の登録上限（本当の制限はサーバー側。ここは案内役）
// -------------------------------------------------------
const { planInfo, loadPlan } = usePlan()
onMounted(loadPlan)

const isAtLimit = computed(() => {
  const max = planInfo.value?.maxProducts
  return max !== null && max !== undefined && products.value.length >= max
})

// -------------------------------------------------------
// Amazonからの商品取り込み（SP-APIオーナーのみ）
// FBA在庫にある商品を、価格・在庫数付きで商品管理に一括登録する
// -------------------------------------------------------
const isSpApiOwner = ref(false)
const importing = ref(false)
const importMessage = ref('')

onMounted(async () => {
  try {
    const res = await $fetch<{ owner: boolean }>('/api/spapi/status', {
      headers: await authHeaders(),
    })
    isSpApiOwner.value = res.owner
  }
  catch {
    // 確認できなければボタンを出さないだけ
  }
})

async function importFromAmazon() {
  importing.value = true
  errorMessage.value = ''
  importMessage.value = ''
  try {
    const res = await $fetch<{ importedCount: number, skippedCount: number }>('/api/spapi/import-products', {
      method: 'POST',
      headers: await authHeaders(),
    })
    importMessage.value = res.importedCount > 0
      ? `Amazonから${res.importedCount}件の商品を取り込みました（登録済みスキップ: ${res.skippedCount}件）。仕入れ値は0円で登録されるので、利益を正しく出すには各商品で入力してください`
      : `新しく取り込める商品はありませんでした（登録済みスキップ: ${res.skippedCount}件）`
    await loadProducts()
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { statusMessage?: string } }
    errorMessage.value = fetchError.data?.statusMessage ?? 'Amazonからの取り込みに失敗しました'
  }
  finally {
    importing.value = false
  }
}

// -------------------------------------------------------
// 検索：入力に応じてクライアント側で絞り込む
// computedなので、search か products が変わると自動で再計算される
// -------------------------------------------------------
const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(p =>
    p.asin.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q),
  )
})

// 認証ヘッダー（IDトークン）を作る共通処理
async function authHeaders() {
  const token = await authStore.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

// -------------------------------------------------------
// 一覧取得：ページを開いた時に自分の商品を読み込む
// -------------------------------------------------------
async function loadProducts() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<{ products: Product[] }>('/api/products', {
      headers: await authHeaders(),
    })
    products.value = res.products
  }
  catch {
    errorMessage.value = '商品一覧の取得に失敗しました'
  }
  finally {
    loading.value = false
  }
}

onMounted(loadProducts)

// -------------------------------------------------------
// 商品追加：APIに登録して、一覧を読み直す
// -------------------------------------------------------
async function addProduct() {
  adding.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/products', {
      method: 'POST',
      headers: await authHeaders(),
      body: {
        asin: newProduct.asin,
        productName: newProduct.productName,
        currentPrice: Number(newProduct.currentPrice),
        costPrice: Number(newProduct.costPrice),
      },
    })
    showAddModal.value = false
    // 入力欄をリセット
    Object.assign(newProduct, { asin: '', productName: '', currentPrice: 0, costPrice: 0 })
    await loadProducts()
  }
  catch (err: unknown) {
    const fetchError = err as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = fetchError.data?.statusMessage ?? '商品の追加に失敗しました'
    showAddModal.value = false
  }
  finally {
    adding.value = false
  }
}

// -------------------------------------------------------
// 商品削除：確認してから削除し、一覧を読み直す
// -------------------------------------------------------
async function deleteProduct(asin: string, name: string) {
  if (!confirm(`「${name}」を削除しますか？（メモも一緒に削除されます）`)) return

  errorMessage.value = ''
  try {
    await $fetch(`/api/products/${asin}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    await loadProducts()
  }
  catch {
    errorMessage.value = '削除に失敗しました'
  }
}

const UButton = resolveComponent('UButton')

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
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
      h(UButton, { to: `/products/${row.original.asin}`, icon: 'i-lucide-bar-chart-2', size: 'xs', color: 'neutral', variant: 'ghost' }),
      h(UButton, {
        icon: 'i-lucide-trash-2',
        size: 'xs',
        color: 'error',
        variant: 'ghost',
        onClick: () => deleteProduct(row.original.asin, row.original.productName),
      }),
    ]),
  },
]
</script>

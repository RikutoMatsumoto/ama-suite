<template>
  <div class="space-y-6">
    <!-- 商品ヘッダー -->
    <div class="flex items-start gap-4">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/products" />
      <div class="flex-1">
        <h1 class="text-xl font-bold">{{ product.productName }}</h1>
        <p class="text-sm text-gray-500 mt-1">ASIN: {{ asin }}</p>
      </div>
      <UBadge :label="`ランク: ${product.rank.toLocaleString()}位`" color="neutral" />
    </div>

    <!-- メインコンテンツ -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- 利益計算 -->
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-calculator" />
            利益計算
          </h2>
        </template>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-sm text-gray-600">現在の販売価格</span>
            <span class="font-semibold">¥{{ product.currentPrice.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-sm text-gray-600">仕入れ値</span>
            <UInput v-model="costPrice" type="number" size="sm" class="w-28 text-right" />
          </div>
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-sm text-gray-600">FBA手数料（目安）</span>
            <span class="text-gray-600">¥{{ fbaFee.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b">
            <span class="text-sm text-gray-600">Amazon手数料（8%）</span>
            <span class="text-gray-600">¥{{ amazonFee.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center pt-2">
            <span class="font-bold">利益</span>
            <span class="text-xl font-bold" :class="profit >= 0 ? 'text-green-600' : 'text-red-500'">
              ¥{{ profit.toLocaleString() }}
              <span class="text-sm ml-1">({{ profitRate }}%)</span>
            </span>
          </div>
        </div>
      </UCard>

      <!-- 価格グラフ -->
      <UCard class="lg:col-span-3">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold flex items-center gap-2">
              <UIcon name="i-lucide-trending-up" />
              価格履歴
              <UBadge
                v-if="priceHistory?.source === 'keepa'"
                label="Keepaデータ"
                color="success"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-else-if="priceHistory?.source === 'mock'"
                label="サンプルデータ"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </h2>
            <div class="flex gap-1">
              <UButton
                v-for="period in periods"
                :key="period.value"
                :label="period.label"
                size="xs"
                :variant="selectedPeriod === period.value ? 'solid' : 'ghost'"
                color="neutral"
                @click="selectedPeriod = period.value"
              />
            </div>
          </div>
        </template>
        <div class="h-64">
          <ClientOnly>
            <PriceChart
              v-if="priceHistory"
              :labels="priceHistory.labels"
              :prices="priceHistory.prices"
            />
            <div v-else class="h-full flex items-center justify-center text-gray-400">
              <p class="text-sm">読み込み中...</p>
            </div>
          </ClientOnly>
        </div>
      </UCard>
    </div>

    <!-- メモ欄 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-notebook-pen" />
          <h2 class="font-semibold">メモ</h2>
          <UBadge label="あなただけが見られます" color="neutral" variant="subtle" size="sm" />
        </div>
      </template>
      <div class="space-y-3">
        <UFormField label="仕入れ先">
          <UInput v-model="memo.supplier" placeholder="例: ドン・キホーテ 新宿店" class="w-full" />
        </UFormField>
        <UFormField label="備考">
          <UTextarea v-model="memo.note" placeholder="気づいたことをメモしておこう（仕入れのコツ、注意点など）" :rows="4" class="w-full" />
        </UFormField>
        <div class="flex justify-end">
          <UButton label="保存" icon="i-lucide-save" :loading="savingMemo" @click="saveMemo" />
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const asin = route.params.asin as string

const selectedPeriod = ref(90)
const periods = [
  { label: '90日', value: 90 },
  { label: '180日', value: 180 },
  { label: '1年', value: 365 },
]

// -------------------------------------------------------
// 価格履歴の取得
// selectedPeriod（90/180/365）が変わるたびに再取得する
// APIは現在モックデータを返す（将来Keepa APIに差し替え予定）
// -------------------------------------------------------
interface PriceHistory {
  labels: string[]
  prices: number[]
  source: string
}

const priceHistory = ref<PriceHistory | null>(null)

async function loadPriceHistory() {
  try {
    const token = await useAuthStore().getIdToken()
    priceHistory.value = await $fetch<PriceHistory>(
      `/api/products/${asin}/price-history`,
      {
        query: { days: selectedPeriod.value },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
  }
  catch {
    // 失敗時は「読み込み中...」のまま
  }
}

// 期間切り替えのたびに再取得（immediateで初回も実行）
watch(selectedPeriod, loadPriceHistory)
onMounted(loadPriceHistory)

// ダミーデータ（API接続後に置き換え）
const product = reactive({
  productName: 'サンプル商品（API接続後に実データが表示されます）',
  currentPrice: 3980,
  rank: 12345,
})

const costPrice = ref(1500)

// -------------------------------------------------------
// 利益計算：Nitro の server/api/profit-calculator に問い合わせる
// （旧: フロントのcomputedで計算 → 新: サーバー側で計算して返す）
// -------------------------------------------------------
const fbaFee = ref(0)
const amazonFee = ref(0)
const profit = ref(0)
const profitRate = ref(0)
const calculating = ref(false)

async function recalculate() {
  calculating.value = true
  try {
    const result = await $fetch('/api/profit-calculator', {
      method: 'POST',
      body: { sellingPrice: product.currentPrice, costPrice: costPrice.value },
    })
    fbaFee.value = result.fbaFee
    amazonFee.value = result.amazonFee
    profit.value = result.profit
    profitRate.value = result.profitRate
  }
  finally {
    calculating.value = false
  }
}

// 仕入れ値が変わるたびに再計算（watchで値の変化を監視）
watch(costPrice, recalculate, { immediate: true })

const memo = reactive({ supplier: '', note: '' })
const savingMemo = ref(false)

const authStore = useAuthStore()

// -------------------------------------------------------
// 認証ヘッダーを作る共通処理
// FirebaseのIDトークンを取得し「Bearer トークン」形式にする
// サーバー側はこれを検証して本人を特定する
// -------------------------------------------------------
async function authHeaders() {
  const token = await authStore.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

// ページを開いた時に保存済みメモを読み込む
onMounted(async () => {
  try {
    const saved = await $fetch(`/api/products/${asin}/memo`, {
      headers: await authHeaders(),
    })
    memo.supplier = saved.supplier ?? ''
    memo.note = saved.note ?? ''
  }
  catch {
    // 読み込み失敗時は空のまま（初回アクセス等）
  }
})

async function saveMemo() {
  savingMemo.value = true
  try {
    await $fetch(`/api/products/${asin}/memo`, {
      method: 'POST',
      headers: await authHeaders(),
      body: { supplier: memo.supplier, note: memo.note },
    })
  }
  finally {
    savingMemo.value = false
  }
}
</script>

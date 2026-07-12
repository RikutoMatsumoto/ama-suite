<template>
  <div class="space-y-6">
    <!-- 商品ヘッダー -->
    <div class="flex items-start gap-4">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/products" />
      <div class="flex-1">
        <h1 class="text-xl font-bold">{{ product.productName }}</h1>
        <p class="text-sm text-gray-500 mt-1">ASIN: {{ asin }}</p>
      </div>
      <!-- ランキングはKeepaの価格履歴データの最新値から表示 -->
      <UBadge v-if="latestRank" :label="`ランク: ${latestRank.toLocaleString()}位`" color="neutral" />
    </div>

    <!-- メインコンテンツ -->
    <!-- items-start: 左右のカラムの高さを揃えず、それぞれ上から詰めて配置 -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
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

      <!-- グラフ3枚を1枚のカードに縦積み（Keepa風にピッタリ寄せる。縦ラインも揃う）
           各グラフの凡例がタイトル代わりなので、中間の見出しは置かない -->
      <UCard class="lg:col-span-3">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold flex items-center gap-2">
              <UIcon name="i-lucide-trending-up" />
              価格・ランキング推移
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
              <!-- プランの閲覧上限を超える期間はロック（例: スターターは90日まで） -->
              <UButton
                v-for="period in periods"
                :key="period.value"
                :label="period.label"
                size="xs"
                :variant="selectedPeriod === period.value ? 'solid' : 'ghost'"
                color="neutral"
                :disabled="isPeriodLocked(period.value)"
                :icon="isPeriodLocked(period.value) ? 'i-lucide-lock' : undefined"
                :title="isPeriodLocked(period.value) ? 'スタンダードプランで1年分のグラフが見られます' : undefined"
                @click="selectedPeriod = period.value"
              />
            </div>
          </div>
        </template>
        <ClientOnly>
          <div v-if="priceHistory">
            <!-- 価格グラフ（日付ラベルは一番下のグラフだけに表示） -->
            <div class="h-60">
              <PriceChart
                :labels="priceHistory.labels"
                :new-price="priceHistory.newPrice"
                :amazon="priceHistory.amazon"
                :buy-box="priceHistory.buyBox"
                :rank="priceHistory.rank"
                :hide-dates="hasSubRank || hasSellerCount || hasRating"
              />
            </div>
            <!-- カテゴリ別ランキング -->
            <div v-if="hasSubRank" class="h-36">
              <CategoryRankChart
                :labels="priceHistory.labels"
                :sub-rank="priceHistory.subRank"
                :sub-rank-label="priceHistory.subRankLabel"
                :hide-dates="hasSellerCount || hasRating"
              />
            </div>
            <!-- 新品出品者数 -->
            <div v-if="hasSellerCount" class="h-36">
              <SellerCountChart
                :labels="priceHistory.labels"
                :seller-count="priceHistory.sellerCount"
                :hide-dates="hasRating"
              />
            </div>
            <!-- 評価・レビュー数 -->
            <div v-if="hasRating" class="h-36">
              <RatingChart
                :labels="priceHistory.labels"
                :rating="priceHistory.rating"
                :review-count="priceHistory.reviewCount"
              />
            </div>
          </div>
          <div v-else class="h-64 flex items-center justify-center text-gray-400">
            <p class="text-sm">読み込み中...</p>
          </div>
        </ClientOnly>
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
// プラン別の閲覧期間制限
// サーバー側でも同じ制限をかけているので、ここは「案内」の役割
// （ボタンをロックして、なぜ使えないかをツールチップで伝える）
// -------------------------------------------------------
const { planInfo, loadPlan } = usePlan()
onMounted(loadPlan)

function isPeriodLocked(days: number): boolean {
  if (!planInfo.value) return false // プラン情報の取得前はロックしない
  return days > planInfo.value.maxHistoryDays
}

// -------------------------------------------------------
// 価格履歴の取得
// selectedPeriod（90/180/365）が変わるたびに再取得する
// APIは現在モックデータを返す（将来Keepa APIに差し替え予定）
// -------------------------------------------------------
interface PriceHistory {
  labels: string[]
  newPrice: (number | null)[]
  amazon: (number | null)[]
  buyBox: (number | null)[]
  rank: (number | null)[]
  subRank: (number | null)[]
  subRankLabel: string
  sellerCount: (number | null)[]
  rating: (number | null)[]
  reviewCount: (number | null)[]
  source: string
}

const priceHistory = ref<PriceHistory | null>(null)

// 出品者数・カテゴリ別ランキングはデータが1件でもあればグラフを出す
// （無い商品はカードごと非表示）
const hasSellerCount = computed(() =>
  priceHistory.value?.sellerCount?.some(v => v !== null) ?? false,
)
const hasSubRank = computed(() =>
  priceHistory.value?.subRank?.some(v => v !== null) ?? false,
)
// 評価かレビュー数のどちらかがあれば評価グラフを出す
const hasRating = computed(() =>
  (priceHistory.value?.rating?.some(v => v !== null) ?? false)
  || (priceHistory.value?.reviewCount?.some(v => v !== null) ?? false),
)

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

// 商品情報（登録済みの実データをAPIから読み込む）
const product = reactive({
  productName: '読み込み中...',
  currentPrice: 0,
})

const costPrice = ref(0)

// ランキングバッジ：Keepaの価格履歴データの最新値を使う
const latestRank = computed(() => {
  const ranks = priceHistory.value?.rank
  if (!ranks) return null
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (ranks[i] !== null) return ranks[i]
  }
  return null
})

// ページを開いた時に商品データを読み込む
onMounted(async () => {
  try {
    const saved = await $fetch<{ productName: string, currentPrice: number, costPrice: number }>(
      `/api/products/${asin}`,
      { headers: await authHeaders() },
    )
    product.productName = saved.productName
    product.currentPrice = saved.currentPrice
    costPrice.value = saved.costPrice ?? 0
    await recalculate() // 実際の価格で利益計算をやり直す
  }
  catch {
    // 未登録のASINを直接開いた場合など
    product.productName = '（未登録の商品）'
  }
})

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
  // 商品データの読み込み前（価格0円）は計算しない
  // （利益計算APIは「販売価格は正の数」を要求するため400になる）
  if (!product.currentPrice || product.currentPrice <= 0) return

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

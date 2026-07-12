<template>
  <div class="space-y-6">
    <!-- アカウント情報 -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">アカウント情報</h2>
      </template>
      <div class="space-y-3">
        <div class="flex justify-between items-center py-2 border-b">
          <span class="text-sm text-gray-600">お名前</span>
          <span class="font-medium">{{ authStore.user?.displayName ?? '未設定' }}</span>
        </div>
        <div class="flex justify-between items-center py-2 border-b">
          <span class="text-sm text-gray-600">メールアドレス</span>
          <span class="font-medium">{{ authStore.user?.email }}</span>
        </div>
        <div class="flex justify-between items-center py-2">
          <span class="text-sm text-gray-600">契約プラン</span>
          <UBadge :label="planLabel" :color="planColor" variant="subtle" />
        </div>
        <!-- プランの制限内容（何ができるプランなのかをその場で確認できる） -->
        <div v-if="planInfo" class="flex justify-between items-center py-2 border-t">
          <span class="text-sm text-gray-600">プランの内容</span>
          <span class="text-sm text-gray-500">
            商品登録 {{ planInfo.maxProducts ? `${planInfo.maxProducts}件まで` : '無制限' }}
            ・グラフ {{ planInfo.maxHistoryDays === 365 ? '1年分' : `${planInfo.maxHistoryDays}日分` }}
          </span>
        </div>
      </div>
    </UCard>

    <!-- SP-API連携ステータス -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-plug-zap" />
          <h2 class="font-semibold">Amazon SP-API連携</h2>
          <UBadge
            v-if="spapiStatus?.connected"
            label="接続済み"
            color="success"
            variant="subtle"
            size="sm"
          />
          <UBadge
            v-else-if="spapiStatus"
            label="未接続"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
      </template>
      <div v-if="!spapiStatus" class="text-sm text-gray-400 py-2 text-center">
        接続状態を確認中...
      </div>
      <div v-else-if="spapiStatus.connected" class="space-y-2">
        <p class="text-sm text-gray-600">
          セラーアカウントと接続されています。参加マーケットプレイス：
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="m in spapiStatus.marketplaces"
            :key="m.id"
            :label="`${m.name} (${m.country})`"
            color="neutral"
            variant="subtle"
          />
        </div>
      </div>
      <p v-else class="text-sm text-gray-500 py-2">
        {{ spapiStatus.reason }}
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const authStore = useAuthStore()

// プラン情報（トライアル判定込み）をAPIから取得
const { planInfo, loadPlan } = usePlan()
onMounted(() => loadPlan(true)) // 設定画面は最新状態を見たいので強制再取得

// -------------------------------------------------------
// SP-API接続状態の確認
// -------------------------------------------------------
interface SpApiStatus {
  connected: boolean
  reason?: string
  marketplaces?: { id: string, name: string, country: string }[]
}

const spapiStatus = ref<SpApiStatus | null>(null)

onMounted(async () => {
  try {
    const token = await authStore.getIdToken()
    spapiStatus.value = await $fetch<SpApiStatus>('/api/spapi/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  catch {
    spapiStatus.value = { connected: false, reason: '接続状態の確認に失敗しました' }
  }
})

const planLabel = computed(() => {
  if (!planInfo.value) return '確認中...'
  if (planInfo.value.status === 'trial') {
    return `無料トライアル（残り${planInfo.value.trialDaysLeft}日）`
  }
  return planInfo.value.label
})

const planColor = computed(() => {
  switch (planInfo.value?.status) {
    case 'active': return 'primary' as const
    case 'trial': return 'warning' as const
    default: return 'neutral' as const
  }
})
</script>

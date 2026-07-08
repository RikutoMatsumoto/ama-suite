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
      </div>
    </UCard>

    <!-- 今後の設定項目 -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">その他の設定</h2>
      </template>
      <p class="text-sm text-gray-500 py-4 text-center">
        通知設定・API連携（Amazon SP-API / Keepa）などの設定項目は準備中です。
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const authStore = useAuthStore()

// 契約状態をAPIから取得（Stripe決済後にFirestoreに保存されたもの）
const subscription = ref<{ status?: string, plan?: string } | null>(null)

onMounted(async () => {
  try {
    const token = await authStore.getIdToken()
    subscription.value = await $fetch('/api/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  catch {
    // 未契約なら null のまま
  }
})

const planLabel = computed(() => {
  if (subscription.value?.status === 'active') {
    const names: Record<string, string> = {
      starter: 'スタータープラン',
      standard: 'スタンダードプラン',
      pro: 'プロプラン',
    }
    return names[subscription.value.plan ?? ''] ?? '契約中'
  }
  return '無料プラン'
})

const planColor = computed(() =>
  subscription.value?.status === 'active' ? 'primary' as const : 'neutral' as const,
)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #E8F4FD 0%, #D4EBF8 100%);">
    <UCard class="w-full max-w-md shadow-xl">
      <div class="text-center py-8 px-4">
        <div class="text-5xl mb-4">🎉</div>
        <h1 class="text-2xl font-black mb-2" style="color: #1B2A4A;">ご契約ありがとうございます！</h1>
        <p class="text-sm text-gray-600 mb-6">
          決済が完了しました。<br>
          すべての機能をご利用いただけます。
        </p>
        <UButton to="/dashboard" label="ダッシュボードへ" color="primary" size="lg" class="font-bold" />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
</script>

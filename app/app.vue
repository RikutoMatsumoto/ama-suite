<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap' },
  ],
  htmlAttrs: { lang: 'ja' },
})

useSeoMeta({
  title: 'AmaSuite - Amazonせどりをもっとスマートに',
  description: '価格履歴・利益計算・在庫管理をひとつに。プライスターとKeepaを合わせた月額5,000円のAmazonせどりツール。',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

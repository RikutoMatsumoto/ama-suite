<template>
  <Line :data="chartData" :options="chartOptions" />
</template>

<script setup lang="ts">
// ============================================================
// 価格履歴グラフコンポーネント（商品詳細ページ用）
// SalesChart.vue と同じ Chart.js ベース。1系列のみのシンプル版
// ============================================================

import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{
  labels: string[]
  prices: number[]
}>()

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: '価格',
      data: props.prices,
      borderColor: '#3B82F6', // 価格はブルー系
      backgroundColor: 'rgba(59, 130, 246, 0.06)',
      fill: true,
      tension: 0.2,
      pointRadius: 0, // 期間が長いので点は非表示（線だけ）
      borderWidth: 2,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }, // 1系列なので凡例は不要
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) => ` ¥${ctx.parsed.y.toLocaleString()}`,
      },
    },
  },
  scales: {
    y: {
      ticks: {
        callback: (value: string | number) => `¥${Number(value).toLocaleString()}`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8 },
    },
  },
}
</script>

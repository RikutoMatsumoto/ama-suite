<template>
  <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
</template>

<script setup lang="ts">
// ============================================================
// 新品出品者数グラフ（Keepa風・紫のステップ線）
//
// 価格グラフとは別チャートで表示する。
// 出品者数は「3人→4人」のように段階的に変わる値なので、
// なめらかな曲線ではなく stepped（階段状）で描くのがKeepa流。
// ライバルセラーの増減 = 価格競争の激しさがひと目でわかる。
// ============================================================

import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { crosshairPlugin, AXIS_LEFT_WIDTH, AXIS_RIGHT_WIDTH } from '~/utils/chartCrosshair'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{
  labels: string[]
  sellerCount: (number | null)[]
  // 下に別グラフが続く時にtrue：日付ラベルを消してグラフ同士を詰める
  hideDates?: boolean
}>()

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: '新品出品者数',
      data: props.sellerCount,
      borderColor: '#8B5CF6', // 紫（Keepaの出品者数と同系色）
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
      fill: true,
      stepped: true, // 階段状に描く（人数は連続値ではないため）
      pointRadius: 0,
      borderWidth: 2,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // 価格グラフと同じKeepa風の操作感（縦ライン上の値を表示）
  interaction: { mode: 'index' as const, intersect: false },
  // 右軸が無いぶんの余白を確保して、価格グラフと横位置を揃える
  layout: { padding: { right: AXIS_RIGHT_WIDTH } },
  plugins: {
    // 価格グラフとクロスヘアを連動させる（同じグループ名を指定）
    crosshair: { group: 'product-history' },
    legend: { position: 'top' as const, labels: { usePointStyle: true } },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }, parsed: { y: number } }) =>
          ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}人`,
      },
    },
  },
  scales: {
    y: {
      position: 'left' as const,
      beginAtZero: true, // 0人からスタート（差が誇張されないように）
      afterFit: (scale: { width: number }) => { scale.width = AXIS_LEFT_WIDTH },
      ticks: {
        precision: 0, // 人数なので小数の目盛りは出さない
        callback: (value: string | number) => `${Number(value).toLocaleString()}人`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8, display: !props.hideDates },
    },
  },
}))
</script>

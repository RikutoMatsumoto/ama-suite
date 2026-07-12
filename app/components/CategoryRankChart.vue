<template>
  <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
</template>

<script setup lang="ts">
// ============================================================
// カテゴリ別売れ筋ランキンググラフ（Keepa風・青緑）
//
// 価格グラフに混ぜると順位の数字が小さくて潰れてしまうため、
// Keepa本家と同じく別グラフで表示する。
// 「AC式充電器で3位」のような、より実感のわく順位がわかる。
// 軸は reverse（反転）して「上に行くほど売れている」を表現。
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
  subRank: (number | null)[]
  subRankLabel?: string
  // 下に別グラフが続く時にtrue：日付ラベルを消してグラフ同士を詰める
  hideDates?: boolean
}>()

const seriesLabel = computed(() =>
  props.subRankLabel ? `${props.subRankLabel}ランキング` : 'カテゴリ別ランキング',
)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: seriesLabel.value,
      data: props.subRank,
      borderColor: '#0D9488', // 青緑（価格グラフの総合ランキング=緑と区別）
      backgroundColor: 'rgba(13, 148, 136, 0.06)',
      fill: true,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // 価格・出品者数グラフとクロスヘアを連動させる
  interaction: { mode: 'index' as const, intersect: false },
  // 右軸が無いぶんの余白を確保して、価格グラフと横位置を揃える
  layout: { padding: { right: AXIS_RIGHT_WIDTH } },
  plugins: {
    crosshair: { group: 'product-history' },
    legend: { position: 'top' as const, labels: { usePointStyle: true } },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }, parsed: { y: number } }) =>
          ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}位`,
      },
    },
  },
  scales: {
    y: {
      position: 'left' as const,
      reverse: true, // 上に行くほど順位が良い（=売れている）
      afterFit: (scale: { width: number }) => { scale.width = AXIS_LEFT_WIDTH },
      ticks: {
        precision: 0, // 順位なので小数の目盛りは出さない
        callback: (value: string | number) => `${Number(value).toLocaleString()}位`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8, display: !props.hideDates },
    },
  },
}))
</script>

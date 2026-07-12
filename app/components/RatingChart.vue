<template>
  <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
</template>

<script setup lang="ts">
// ============================================================
// 評価・レビュー数グラフ（Keepa風）
//
// ・レビュー数（琥珀色） … 左軸。右肩上がりの伸び＝売れ続けている裏付け
// ・評価（藍色）         … 右軸（★0〜5固定）。商品の質・返品リスクの目安
//
// 数の単位（件と★）が全く違うので、左右で別々の軸に載せる。
// せどり的には「レビューが伸び続けている＋★4以上」が安心して
// 仕入れられる商品のサイン。
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
  rating?: (number | null)[]
  reviewCount?: (number | null)[]
  // 下に別グラフが続く時にtrue：日付ラベルを消してグラフ同士を詰める
  hideDates?: boolean
}>()

const hasRating = computed(() => props.rating?.some(v => v !== null) ?? false)
const hasReviews = computed(() => props.reviewCount?.some(v => v !== null) ?? false)

const chartData = computed(() => {
  const datasets: object[] = []

  if (hasReviews.value) {
    datasets.push({
      label: 'レビュー数',
      data: props.reviewCount,
      borderColor: '#F59E0B', // 琥珀色
      backgroundColor: 'rgba(245, 158, 11, 0.06)',
      fill: true,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2,
      yAxisID: 'y',
    })
  }

  if (hasRating.value) {
    datasets.push({
      label: '評価',
      data: props.rating,
      borderColor: '#6366F1', // 藍色
      backgroundColor: 'transparent',
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 1.5,
      borderDash: [4, 3], // 破線でレビュー数の線と区別
      yAxisID: 'y1',
    })
  }

  return { labels: props.labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // 他のグラフとクロスヘアを連動させる
  interaction: { mode: 'index' as const, intersect: false },
  // 右軸（評価）が無い場合も、右軸ぶんの余白を確保して他グラフと横位置を揃える
  layout: { padding: { right: hasRating.value ? 0 : AXIS_RIGHT_WIDTH } },
  plugins: {
    crosshair: { group: 'product-history' },
    legend: { position: 'top' as const, labels: { usePointStyle: true } },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string, yAxisID?: string }, parsed: { y: number } }) => {
          if (ctx.dataset.yAxisID === 'y1') {
            return ` ${ctx.dataset.label}: ★${ctx.parsed.y.toFixed(1)}`
          }
          return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}件`
        },
      },
    },
  },
  scales: {
    y: {
      position: 'left' as const,
      afterFit: (scale: { width: number }) => { scale.width = AXIS_LEFT_WIDTH },
      ticks: {
        precision: 0, // レビュー数なので小数の目盛りは出さない
        callback: (value: string | number) => `${Number(value).toLocaleString()}件`,
      },
    },
    // 右軸：評価。★0〜5で固定して見た目のブレを防ぐ
    y1: {
      display: hasRating.value,
      position: 'right' as const,
      min: 0,
      max: 5,
      afterFit: (scale: { width: number }) => { scale.width = AXIS_RIGHT_WIDTH },
      grid: { drawOnChartArea: false }, // 右軸のグリッド線は描かない（ゴチャつき防止）
      ticks: {
        stepSize: 1,
        callback: (value: string | number) => `★${value}`,
      },
    },
    x: {
      ticks: { maxTicksLimit: 8, display: !props.hideDates },
    },
  },
}))
</script>

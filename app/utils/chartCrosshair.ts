// ============================================================
// Keepa風クロスヘア（縦ライン）プラグイン＋グラフ連動
//
// Chart.jsの「プラグイン」= グラフ描画の途中に自分の処理を
// 差し込める仕組み。afterDraw は「グラフ本体を描き終わった後」
// に呼ばれるので、その上から縦線を1本描いている。
//
// 【連動の仕組み】
// options.plugins.crosshair.group に同じグループ名を指定した
// チャート同士は、片方をマウスでなぞるともう片方にも
// 同じ日付位置の縦線＋ツールチップが表示される（Keepa本家と同じ）。
// ・afterInit   … チャートをグループに登録
// ・afterEvent  … マウス移動を検知して仲間のチャートへ位置を配信
// ・afterDestroy… ページ離脱時にグループから外す（メモリリーク防止）
//
// ツールチップ側は各グラフの options で
//   interaction: { mode: 'index', intersect: false }
// を指定する（マウスの縦ライン上にある全系列を同時表示する設定）。
// ============================================================

import type { Chart, ChartType, Plugin } from 'chart.js'

// ============================================================
// 連動するグラフ同士でプロットエリアの左右位置を揃えるための固定軸幅。
// 軸幅が自動計算だと「¥4,600」と「2人」のような目盛り文字数の違いで
// グラフごとに描画開始位置がズレて、縦ラインの位置が合わなくなる。
// 各グラフの scales の afterFit で scale.width にこの値を代入して使う。
// ============================================================
export const AXIS_LEFT_WIDTH = 64
export const AXIS_RIGHT_WIDTH = 56

// TypeScriptに「crosshairというプラグイン設定がある」と教える宣言
declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    crosshair?: { group?: string }
  }
}

// グループ名 → 所属チャート一覧（モジュール内で共有する台帳）
const groups = new Map<string, Set<Chart>>()
const chartGroup = new WeakMap<Chart, string>()

// 配信中に相手側のイベントが再発火して無限ループしないためのフラグ
let syncing = false

export const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',

  afterInit(chart, _args, opts) {
    const group = (opts as { group?: string }).group
    if (!group) return
    chartGroup.set(chart, group)
    if (!groups.has(group)) groups.set(group, new Set())
    groups.get(group)!.add(chart)
  },

  afterDestroy(chart) {
    const group = chartGroup.get(chart)
    if (group) groups.get(group)?.delete(chart)
  },

  afterEvent(chart, args) {
    const group = chartGroup.get(chart)
    if (!group || syncing) return

    const event = args.event
    if (event.type === 'mousemove' && args.inChartArea) {
      // マウス位置にあるデータの「何日目か（index）」を取得して仲間へ配信
      const native = event.native
      if (!native) return
      const elements = chart.getElementsAtEventForMode(native, 'index', { intersect: false }, true)
      const index = elements[0]?.index
      if (index !== undefined) broadcast(chart, group, index)
    }
    else if (event.type === 'mouseout') {
      broadcast(chart, group, null) // グラフから出たら仲間の縦線も消す
    }
  },

  afterDraw(chart) {
    // ツールチップが指している点（アクティブな点）の位置に縦線を描く
    const active = chart.tooltip?.getActiveElements() ?? []
    if (active.length === 0) return

    const x = active[0]!.element.x
    const { top, bottom } = chart.chartArea
    const ctx = chart.ctx

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(107, 114, 128, 0.55)' // 薄いグレー
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.restore()
  },
}

// 同じグループの他チャートに「index日目を指せ」と伝える
// index が null なら「何も指すな（消せ）」の意味
function broadcast(source: Chart, group: string, index: number | null) {
  syncing = true
  try {
    for (const other of groups.get(group) ?? []) {
      if (other === source) continue

      if (index === null) {
        other.setActiveElements([])
        other.tooltip?.setActiveElements([], { x: 0, y: 0 })
        other.update('none') // 'none' = アニメーションなしで即再描画
        continue
      }

      // その日付に値がある系列だけをアクティブにする
      // （元データがnull=欠損の日は、その系列をツールチップに出さない）
      const actives: { datasetIndex: number, index: number }[] = []
      other.data.datasets.forEach((dataset, di) => {
        if (!other.isDatasetVisible(di)) return
        const el = other.getDatasetMeta(di).data[index]
        const raw = dataset.data[index]
        if (el && raw !== null && raw !== undefined) {
          actives.push({ datasetIndex: di, index })
        }
      })

      other.setActiveElements(actives)
      if (actives.length > 0) {
        const el = other.getDatasetMeta(actives[0]!.datasetIndex).data[index]!
        other.tooltip?.setActiveElements(actives, { x: el.x, y: (other.chartArea.top + other.chartArea.bottom) / 2 })
      }
      else {
        other.tooltip?.setActiveElements([], { x: 0, y: 0 })
      }
      other.update('none')
    }
  }
  finally {
    syncing = false
  }
}

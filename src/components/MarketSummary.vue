<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getMarketAnalysis, getMarketSentiment, getSectorHeatmap } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const loading = ref(true)
const error = ref(null)
const marketData = ref(null)
const sentimentData = ref(null)
const sectorData = ref([])
const updateTime = ref('')
const dataSources = ref([])

/**
 * 基于多维度实时数据生成数据驱动型市场复盘
 * 每条分析都引用具体数据，并标注来源
 */
const analysisParts = computed(() => {
  if (!marketData.value) return []
  const d = marketData.value
  const s = sentimentData.value || {}
  const sectors = sectorData.value || []
  const parts = []
  const sources = []

  // === 1. 指数表现（来源：东方财富/akshare 指数行情） ===
  const shVal = d.shIndex?.value || '--'
  const shChg = parseFloat(d.shIndex?.change || 0)
  const szChg = parseFloat(d.szIndex?.change || 0)
  const cyChg = parseFloat(d.cyIndex?.change || 0)
  const chgs = [shChg, szChg, cyChg]
  const allDown = chgs.every(v => v < 0)
  const allUp = chgs.every(v => v > 0)

  let indexDesc
  if (allUp) {
    const lead = shChg > szChg ? (szChg > cyChg ? '上证' : '创业板') : (shChg > cyChg ? '上证' : '创业板')
    indexDesc = `上证${shChg.toFixed(2)}%、深证${szChg.toFixed(2)}%、创业板${cyChg.toFixed(2)}%全线收涨，${lead}领涨`
  } else if (allDown) {
    const worst = Math.min(shChg, szChg, cyChg)
    const worstName = worst === cyChg ? '创业板' : worst === szChg ? '深证' : '上证'
    indexDesc = `上证${shChg.toFixed(2)}%、深证${szChg.toFixed(2)}%、创业板${cyChg.toFixed(2)}%全线下跌，${worstName}跌幅最大`
  } else {
    const upIdx = chgs.map((v, i) => ({ v, name: ['上证', '深证', '创业板'][i] })).filter(x => x.v > 0)
    const downIdx = chgs.map((v, i) => ({ v, name: ['上证', '深证', '创业板'][i] })).filter(x => x.v < 0)
    indexDesc = `上证${shChg.toFixed(2)}%、深证${szChg.toFixed(2)}%、创业板${cyChg.toFixed(2)}%，${upIdx.map(x => x.name).join('')}涨${downIdx.map(x => x.name).join('')}跌，市场分化`
  }
  parts.push(indexDesc)
  sources.push('指数行情：东方财富/akshare')

  // === 2. 涨跌广度（来源：akshare 全市场行情） ===
  const up = d.upCount || s.upCount || 0
  const down = d.downCount || s.downCount || 0
  const flat = d.flatCount || s.flatCount || 0
  const total = up + down + flat || 1
  const upRatio = (up / total * 100).toFixed(1)

  let breadthDesc
  if (upRatio > 70) {
    breadthDesc = `全市场${up}涨${down}跌（上涨占比${upRatio}%），普涨格局`
  } else if (upRatio > 55) {
    breadthDesc = `全市场${up}涨${down}跌（上涨占比${upRatio}%），多数上涨`
  } else if (upRatio > 45) {
    breadthDesc = `全市场${up}涨${down}跌（上涨占比${upRatio}%），多空均衡`
  } else if (upRatio > 30) {
    breadthDesc = `全市场${up}涨${down}跌（上涨占比${upRatio}%），跌多涨少`
  } else {
    breadthDesc = `全市场${up}涨${down}跌（上涨占比${upRatio}%），普跌格局`
  }
  parts.push(breadthDesc)
  sources.push('涨跌统计：akshare 全市场行情')

  // === 3. 涨跌停分析（来源：akshare 涨跌停/炸板统计） ===
  const lu = s.limitUpCount || d.limitUpCount || 0
  const ld = s.limitDownCount || d.limitDownCount || 0
  const bomb = s.bombCount || 0
  const bombRate = lu + bomb > 0 ? (bomb / (lu + bomb) * 100).toFixed(0) : 0

  if (lu > 0 || ld > 0) {
    let limitDesc = `涨停${lu}家`
    if (ld > 0) limitDesc += `、跌停${ld}家`
    if (bomb > 0) limitDesc += `、炸板${bomb}家（炸板率${bombRate}%）`
    if (ld > lu) {
      limitDesc += `，跌停多于涨停，亏钱效应明显`
    } else if (lu > 30) {
      limitDesc += `，封板情绪高涨`
    } else if (lu < 10) {
      limitDesc += `，封板意愿偏弱`
    }
    parts.push(limitDesc)
    sources.push('涨跌停：akshare 涨跌停/炸板统计')
  }

  // === 4. 板块表现（来源：东方财富行业板块行情） ===
  if (sectors.length > 0) {
    const sorted = [...sectors].sort((a, b) => parseFloat(b.avgChange) - parseFloat(a.avgChange))
    const topSector = sorted[0]
    const bottomSector = sorted[sorted.length - 1]
    const topChange = parseFloat(topSector.avgChange)
    const bottomChange = parseFloat(bottomSector.avgChange)

    let sectorDesc = ''
    if (topChange > 0) {
      sectorDesc = `${topSector.name}+${topChange.toFixed(2)}%领涨`
      if (sorted.length > 1 && parseFloat(sorted[1].avgChange) > 0) {
        sectorDesc += `，${sorted[1].name}+${parseFloat(sorted[1].avgChange).toFixed(2)}%跟涨`
      }
    }
    if (bottomChange < 0) {
      sectorDesc += sectorDesc ? `；${bottomSector.name}${bottomChange.toFixed(2)}%领跌` : `${bottomSector.name}${bottomChange.toFixed(2)}%领跌`
    }
    if (sectorDesc) {
      parts.push(sectorDesc)
      sources.push('板块行情：东方财富行业板块')
    }
  }

  // === 5. 操作建议（基于以上数据综合推导） ===
  let suggestion = ''
  if (allDown && upRatio < 35) {
    suggestion = '市场整体偏弱，控制仓位等待企稳信号'
  } else if (allUp && upRatio > 60) {
    suggestion = '市场情绪回暖，关注主线板块持续性'
  } else if (ld > lu && ld > 50) {
    suggestion = `跌停${ld}家偏多，规避高位题材股`
  } else if (bombRate > 40) {
    suggestion = `炸板率${bombRate}%偏高，追涨停需谨慎`
  } else if (upRatio > 45 && upRatio < 55) {
    suggestion = '市场多空均衡，关注结构性机会'
  } else {
    suggestion = '关注量能配合与主线板块资金持续性'
  }
  parts.push(suggestion)

  dataSources.value = sources
  return parts
})

const summary = computed(() => analysisParts.value.join('，'))

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    const [analysis, sentiment, sectors] = await Promise.all([
      getMarketAnalysis(),
      getMarketSentiment().catch(() => null),
      getSectorHeatmap().catch(() => []),
    ])
    marketData.value = analysis
    sentimentData.value = sentiment
    sectorData.value = sectors
    updateTime.value = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    console.error('加载市场总结数据失败:', e)
    error.value = e?.message || '数据加载失败'
  } finally {
    if (!silent) loading.value = false
  }
}

const retry = () => loadData()

watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="market-summary">
    <!-- 加载态 -->
    <div v-if="loading" class="ms-state">
      <div class="ms-spinner"></div>
      <span class="ms-state-text">AI 正在复盘市场…</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="ms-state ms-state-error">
      <span class="ms-state-text">{{ error }}</span>
      <button class="ms-retry" @click="retry">重试</button>
    </div>

    <!-- 正常态 -->
    <template v-else>
      <div class="ms-header">
        <span class="ms-dot" aria-hidden="true"></span>
        <span class="ms-tag">AI复盘</span>
      </div>

      <p class="ms-text">{{ summary }}</p>

      <!-- 分析依据 -->
      <div class="ms-sources" v-if="dataSources.length">
        <div class="source-label">分析依据</div>
        <div class="source-tags">
          <span v-for="src in dataSources" :key="src" class="source-tag">{{ src }}</span>
        </div>
      </div>

      <div class="ms-footer">
        <span class="ms-time">数据更新于 {{ updateTime }}</span>
        <span class="ms-source">数据来源：akshare · 东方财富</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.market-summary {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-separator);
  padding: 14px 14px 12px;
  overflow: hidden;
}

/* ===== 状态态 ===== */
.ms-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 64px;
}
.ms-state-error { flex-wrap: wrap; }
.ms-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--color-separator-opaque, #30363d);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: ms-spin 0.8s linear infinite;
}
@keyframes ms-spin { to { transform: rotate(360deg); } }
.ms-state-text { font-size: 12px; color: var(--color-text-tertiary); }
.ms-retry {
  border: none;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 12px; font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-smooth);
}
.ms-retry:active { transform: scale(0.96); }

/* ===== 头部 ===== */
.ms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ms-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 0 10px var(--color-accent-glow);
  animation: ms-pulse 2s ease-in-out infinite;
}
@keyframes ms-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 0 8px var(--color-accent-glow); }
  50% { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1), 0 0 16px var(--color-accent-glow); }
}
.ms-tag {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 3px 9px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(37, 99, 235, 0.25);
}

/* ===== 主文本 ===== */
.ms-text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text-secondary);
  letter-spacing: 0.01em;
  margin: 0;
}

/* ===== 分析依据 ===== */
.ms-sources {
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-separator);
}
.source-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.source-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.source-tag {
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-surface);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-separator);
}

/* ===== 底部 ===== */
.ms-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--color-separator);
}
.ms-time {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.ms-source {
  font-size: 10px;
  color: var(--color-text-quaternary, #6e7681);
}
</style>

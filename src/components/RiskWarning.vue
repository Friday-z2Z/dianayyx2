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
    updateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('加载风险数据失败:', e)
    error.value = e?.message || '数据加载失败'
  } finally {
    if (!silent) loading.value = false
  }
}

const retry = () => loadData()

/**
 * 基于多维度实时数据生成数据驱动型风险提示
 * 每条风险都引用具体数据值，并标注来源
 */
const riskItems = computed(() => {
  if (!marketData.value) return []
  const d = marketData.value
  const s = sentimentData.value || {}
  const sectors = sectorData.value || []
  const items = []
  const sources = new Set()

  const shChg = parseFloat(d.shIndex?.change || 0)
  const szChg = parseFloat(d.szIndex?.change || 0)
  const cyChg = parseFloat(d.cyIndex?.change || 0)
  const chgs = [shChg, szChg, cyChg]
  const allDown = chgs.every(v => v < 0)
  const allUp = chgs.every(v => v > 0)

  // === 1. 指数系统性风险（来源：东方财富/akshare 指数行情） ===
  if (allDown) {
    const worst = Math.min(shChg, szChg, cyChg)
    const worstName = worst === cyChg ? '创业板' : worst === szChg ? '深证' : '上证'
    if (worst < -2) {
      items.push({
        level: 'high',
        text: `三大指数全线下跌，${worstName}${worst.toFixed(2)}%跌幅最大，系统性风险升温`,
        source: '指数行情：东方财富/akshare',
      })
      sources.add('指数行情：东方财富/akshare')
    } else {
      items.push({
        level: 'medium',
        text: `上证${shChg.toFixed(2)}%、深证${szChg.toFixed(2)}%、创业板${cyChg.toFixed(2)}%齐跌，市场承压`,
        source: '指数行情：东方财富/akshare',
      })
      sources.add('指数行情：东方财富/akshare')
    }
  } else {
    // 指数分化
    const maxChg = Math.max(...chgs)
    const minChg = Math.min(...chgs)
    if (maxChg - minChg > 2) {
      const upName = maxChg === shChg ? '上证' : maxChg === szChg ? '深证' : '创业板'
      const downName = minChg === shChg ? '上证' : minChg === szChg ? '深证' : '创业板'
      items.push({
        level: 'medium',
        text: `指数分化：${upName}+${maxChg.toFixed(2)}% vs ${downName}${minChg.toFixed(2)}%，风格切换风险`,
        source: '指数行情：东方财富/akshare',
      })
      sources.add('指数行情：东方财富/akshare')
    }
  }

  // === 2. 涨跌广度风险（来源：akshare 全市场行情） ===
  const upCount = d.upCount || s.upCount || 0
  const downCount = d.downCount || s.downCount || 0
  const total = upCount + downCount || 1
  const downRatio = (downCount / total * 100).toFixed(1)

  if (downCount > upCount * 2) {
    items.push({
      level: 'high',
      text: `全市场${downCount}跌${upCount}涨（下跌占比${downRatio}%），亏钱效应显著`,
      source: '涨跌统计：akshare 全市场行情',
    })
    sources.add('涨跌统计：akshare 全市场行情')
  } else if (downCount > upCount * 1.3) {
    items.push({
      level: 'medium',
      text: `跌多涨少：${downCount}跌${upCount}涨（下跌占比${downRatio}%），情绪偏弱`,
      source: '涨跌统计：akshare 全市场行情',
    })
    sources.add('涨跌统计：akshare 全市场行情')
  }

  // === 3. 涨跌停风险（来源：akshare 涨跌停/炸板统计） ===
  const lu = s.limitUpCount || d.limitUpCount || 0
  const ld = s.limitDownCount || d.limitDownCount || 0
  const bomb = s.bombCount || 0
  const bombRate = lu + bomb > 0 ? (bomb / (lu + bomb) * 100) : 0

  if (ld > lu && ld > 10) {
    items.push({
      level: 'high',
      text: `跌停${ld}家 > 涨停${lu}家，做空情绪升温，规避高位题材`,
      source: '涨跌停：akshare 涨跌停统计',
    })
    sources.add('涨跌停：akshare 涨跌停统计')
  } else if (bombRate > 40 && lu > 0) {
    items.push({
      level: 'medium',
      text: `炸板率${bombRate.toFixed(0)}%（炸板${bomb}家/封板${lu}家），追涨停风险加大`,
      source: '涨跌停：akshare 炸板统计',
    })
    sources.add('涨跌停：akshare 炸板统计')
  } else if (lu > 50) {
    items.push({
      level: 'low',
      text: `涨停${lu}家偏多，注意高位股分歧后的退潮风险`,
      source: '涨跌停：akshare 涨跌停统计',
    })
    sources.add('涨跌停：akshare 涨跌停统计')
  }

  // === 4. 板块分化风险（来源：东方财富行业板块行情） ===
  if (sectors.length > 0) {
    const sorted = [...sectors].sort((a, b) => parseFloat(b.avgChange) - parseFloat(a.avgChange))
    const topSector = sorted[0]
    const bottomSector = sorted[sorted.length - 1]
    const topChg = parseFloat(topSector.avgChange)
    const bottomChg = parseFloat(bottomSector.avgChange)
    const downSectors = sorted.filter(s => parseFloat(s.avgChange) < 0).length

    if (topChg - bottomChg > 5) {
      items.push({
        level: 'medium',
        text: `板块分化严重：${topSector.name}+${topChg.toFixed(2)}% vs ${bottomSector.name}${bottomChg.toFixed(2)}%，资金分歧加大`,
        source: '板块行情：东方财富行业板块',
      })
      sources.add('板块行情：东方财富行业板块')
    }

    if (downSectors > sectors.length * 0.8) {
      items.push({
        level: 'high',
        text: `全行业普跌：${downSectors}/${sectors.length}个板块下跌，避险情绪升温`,
        source: '板块行情：东方财富行业板块',
      })
      sources.add('板块行情：东方财富行业板块')
    }
  }

  // === 5. 无风险时给出正常提示（仍引用数据） ===
  if (items.length === 0) {
    if (allUp && parseFloat(downRatio) < 40) {
      items.push({
        level: 'low',
        text: `市场情绪偏暖：上证+${shChg.toFixed(2)}%，上涨${upCount}家占比${(100 - parseFloat(downRatio)).toFixed(1)}%，关注主线持续性`,
        source: '指数行情+涨跌统计：东方财富/akshare',
      })
      sources.add('指数行情+涨跌统计：东方财富/akshare')
    } else {
      items.push({
        level: 'low',
        text: `市场多空均衡：${upCount}涨${downCount}跌，涨停${lu}家跌停${ld}家，关注量能配合`,
        source: '涨跌统计+涨跌停：akshare',
      })
      sources.add('涨跌统计+涨跌停：akshare')
    }
  }

  dataSources.value = [...sources]
  return items
})

// 综合风险等级
const riskLevel = computed(() => {
  const items = riskItems.value
  if (items.length === 0) return 'normal'
  const highCount = items.filter(i => i.level === 'high').length
  const mediumCount = items.filter(i => i.level === 'medium').length
  if (highCount >= 2) return 'high'
  if (highCount >= 1 || mediumCount >= 2) return 'medium'
  return 'normal'
})

watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="risk-warning" :class="riskLevel">
    <!-- 加载状态 -->
    <div v-if="loading" class="state-box">
      <div class="mini-spinner"></div>
      <span class="state-text">加载风险数据...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-box">
      <span class="state-text error-text">{{ error }}</span>
      <button class="retry-btn" @click="retry">重试</button>
    </div>

    <!-- 风险内容 -->
    <div v-else class="risk-content">
      <!-- 左侧警示图标 -->
      <div class="risk-icon" :class="riskLevel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>

      <!-- 右侧风险提示文本区域 -->
      <div class="risk-text-area">
        <div class="title-row">
          <h3 class="risk-title">风险边界</h3>
          <span class="level-tag" :class="riskLevel">
            {{ riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '正常' }}
          </span>
        </div>

        <!-- 数据驱动型风险提示列表 -->
        <div class="warning-list">
          <div v-for="(item, i) in riskItems" :key="i" class="warning-item" :class="item.level">
            <span class="warning-bullet" :class="item.level"></span>
            <div class="warning-body">
              <span class="warning-text">{{ item.text }}</span>
              <span class="warning-source">{{ item.source }}</span>
            </div>
          </div>
        </div>

        <!-- 分析依据来源 -->
        <div class="sources-section" v-if="dataSources.length">
          <div class="source-label">分析依据</div>
          <div class="source-tags">
            <span v-for="src in dataSources" :key="src" class="source-tag">{{ src }}</span>
          </div>
        </div>

        <p class="disclaimer">数据更新于 {{ updateTime }} · 以上分析仅供参考，不构成投资建议</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.risk-warning {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-md);
  padding: 14px;
  overflow: hidden;
}
.risk-warning.medium {
  background: rgba(249, 115, 22, 0.06);
  border-color: rgba(249, 115, 22, 0.25);
}
.risk-warning.normal {
  background: rgba(34, 197, 94, 0.04);
  border-color: rgba(34, 197, 94, 0.2);
}

/* 状态盒子 */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
}
.state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.error-text {
  color: var(--color-red);
}
.retry-btn {
  padding: 4px 14px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-smooth);
}
.retry-btn:active {
  background: rgba(239, 68, 68, 0.15);
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(239, 68, 68, 0.2);
  border-top-color: var(--color-orange);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 风险内容布局 */
.risk-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* 左侧警示图标 */
.risk-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(249, 115, 22, 0.12);
  color: var(--color-orange);
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--ease-smooth);
}
.risk-icon.high {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-red);
  animation: pulse-icon 1.8s ease-in-out infinite;
}
.risk-icon.medium {
  background: rgba(249, 115, 22, 0.15);
  color: var(--color-orange);
}
.risk-icon.normal {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-green);
}
@keyframes pulse-icon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

/* 右侧文本区域 */
.risk-text-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.risk-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-red);
  margin: 0;
  letter-spacing: -0.01em;
}
.risk-warning.medium .risk-title { color: var(--color-orange); }
.risk-warning.normal .risk-title { color: var(--color-green); }

.level-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.level-tag.high {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-red);
}
.level-tag.medium {
  background: rgba(249, 115, 22, 0.18);
  color: var(--color-orange);
}
.level-tag.normal {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-green);
}

/* 风险提示列表 */
.warning-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
}
.warning-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}
.warning-bullet.high { background: var(--color-red); box-shadow: 0 0 6px rgba(239, 68, 68, 0.4); }
.warning-bullet.medium { background: var(--color-orange); }
.warning-bullet.low { background: var(--color-green); }

.warning-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.warning-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.warning-source {
  font-size: 9px;
  color: var(--color-text-quaternary, #6e7681);
  font-weight: 500;
}

/* 分析依据来源 */
.sources-section {
  margin-top: 4px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
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

/* 底部免责声明 */
.disclaimer {
  margin: 4px 0 0;
  padding-top: 6px;
  border-top: 1px solid rgba(239, 68, 68, 0.1);
  font-size: 10px;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

/* 移动端适配 */
@media (max-width: 430px) {
  .risk-warning {
    padding: 12px;
  }
  .risk-icon {
    width: 36px;
    height: 36px;
  }
  .risk-icon svg {
    width: 24px;
    height: 24px;
  }
  .risk-title {
    font-size: 14px;
  }
  .warning-text {
    font-size: 11.5px;
  }
}
</style>

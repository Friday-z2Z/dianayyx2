<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getSectorHeatmap } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const sectors = ref([])
const loading = ref(true)
const refreshing = ref(false)
const viewMode = ref('sector') // sector | stock

const loadHeatmapData = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const data = await getSectorHeatmap()
    sectors.value = data
  } catch (e) {
    console.error('加载行业热力图数据失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const refresh = async () => {
  refreshing.value = true
  await loadHeatmapData()
  refreshing.value = false
}

const getHeatColor = (change) => {
  const val = parseFloat(change)
  if (val > 3) return '#FF4D4F'
  if (val > 2) return '#FF6B6B'
  if (val > 1) return '#FF8787'
  if (val > 0.5) return '#FFA3A3'
  if (val > 0) return '#FFB8B8'
  if (val > -0.5) return '#BDBDBD'
  if (val > -1) return '#8FE388'
  if (val > -2) return '#5DD955'
  if (val > -3) return '#00C853'
  return '#00A840'
}

const getHeatBg = (change) => {
  const val = parseFloat(change)
  const abs = Math.min(Math.abs(val), 5)
  // 背景色用渐变效果，增强视觉层次同时保证文字可读性
  const alpha = 0.08 + (abs / 5) * 0.20
  if (val > 0) return `rgba(239, 68, 68, ${alpha})`
  if (val < 0) return `rgba(22, 163, 74, ${alpha})`
  return 'rgba(120, 120, 120, 0.08)'
}

const getChangeClass = (change) => {
  const val = parseFloat(change)
  return val > 0 ? 'up' : val < 0 ? 'down' : 'flat'
}

const totalUp = computed(() => sectors.value.reduce((sum, s) => sum + s.upCount, 0))
const totalDown = computed(() => sectors.value.reduce((sum, s) => sum + s.downCount, 0))

// 按涨跌幅绝对值排序，涨的在前跌的在后，让热力图更有层次感
const sortedSectors = computed(() => {
  return [...sectors.value].sort((a, b) => parseFloat(b.avgChange) - parseFloat(a.avgChange))
})

watch(() => props.refreshTrigger, () => loadHeatmapData(props.refreshSilent))

onMounted(() => {
  loadHeatmapData()
})
</script>

<template>
  <div class="market-heatmap">
    <div class="heatmap-header">
      <h3 class="heatmap-title">行业热力</h3>
      <div class="header-right">
        <button class="refresh-btn" :class="{ spinning: refreshing }" @click="refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div class="heatmap-legend">
          <span class="legend-label">-3%</span>
          <div class="legend-bar"></div>
          <span class="legend-label">+3%</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="mini-spinner"></div>
    </div>

    <div v-else>
      <!-- 汇总条 -->
      <div class="summary-bar">
        <span class="summary-up">{{ totalUp }}涨</span>
        <span class="summary-divider">/</span>
        <span class="summary-down">{{ totalDown }}跌</span>
      </div>

      <!-- 热力网格 -->
      <div class="heatmap-grid">
        <div
          v-for="sector in sortedSectors"
          :key="sector.name"
          class="sector-cell"
          :style="{
            backgroundColor: getHeatBg(sector.avgChange),
            borderLeftColor: getHeatColor(sector.avgChange),
          }"
        >
          <div class="cell-top">
            <span class="sector-name">{{ sector.name }}</span>
            <span class="sector-count">{{ sector.count || (sector.upCount + sector.downCount) }}</span>
          </div>
          <div class="cell-change" :class="getChangeClass(sector.avgChange)">
            {{ parseFloat(sector.avgChange) > 0 ? '+' : '' }}{{ sector.avgChange }}%
          </div>
          <div class="cell-bottom">
            <span class="cell-up">{{ sector.upCount }}↑</span>
            <span class="cell-down">{{ sector.downCount }}↓</span>
          </div>
          <div class="cell-top-stock" v-if="sector.topStock && sector.topStock !== '--'">
            <span class="top-label">领涨</span>
            <span class="top-name">{{ sector.topStock }}</span>
            <span class="top-change" :class="getChangeClass(sector.topStockChange)">
              {{ parseFloat(sector.topStockChange) > 0 ? '+' : '' }}{{ sector.topStockChange }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="heatmap-source">
      数据来源：akshare · 东方财富行业板块 · 涨幅前15+跌幅前15共{{ sortedSectors.length }}个板块
    </div>
  </div>
</template>

<style scoped>
.market-heatmap {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.3);
  flex: 1;
  min-width: 0;
}
.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.heatmap-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px; height: 26px;
  border-radius: 6px;
  border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}
.refresh-btn:active { transform: scale(0.92); }
.refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-label {
  font-size: 9px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}
.legend-bar {
  width: 60px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #26A69A, #BDBDBD, #F44336);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 24px;
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #30363d;
  border-top-color: #F44336;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.summary-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 0;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
}
.summary-up { color: #ef4444; }
.summary-divider { color: var(--color-text-quaternary); }
.summary-down { color: #22c55e; }

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 520px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-right: 2px;
}
/* 滚动条样式 */
.heatmap-grid::-webkit-scrollbar {
  width: 3px;
}
.heatmap-grid::-webkit-scrollbar-track {
  background: transparent;
}
.heatmap-grid::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}

.sector-cell {
  padding: 8px 6px 8px 8px;
  border-radius: 8px;
  border: 0.5px solid var(--color-separator);
  border-left: 3px solid;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sector-cell:active {
  transform: scale(0.96);
}

.cell-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sector-name {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sector-count {
  font-size: 8px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

.cell-change {
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: #FFFFFF;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.cell-change.flat { color: var(--color-text-tertiary); text-shadow: none; }

.cell-bottom {
  display: flex;
  gap: 6px;
  font-size: 8px;
  font-weight: 600;
}
.cell-up { color: #ef4444; }
.cell-down { color: #22c55e; }

.cell-top-stock {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
  padding-top: 3px;
  border-top: 0.5px solid rgba(255,255,255,0.06);
}
.top-label {
  font-size: 7px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}
.top-name {
  font-size: 8px;
  color: var(--color-text-tertiary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.top-change {
  font-size: 8px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.top-change.up { color: #ef4444; }
.top-change.down { color: #22c55e; }
.top-change.flat { color: var(--color-text-tertiary); }

.heatmap-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  border-top: 0.5px solid var(--color-separator);
  font-variant-numeric: tabular-nums;
}
</style>

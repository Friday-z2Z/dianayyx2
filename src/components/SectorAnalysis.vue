<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getSectorHeatmap } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const sectors = ref([])
const loading = ref(true)
const error = ref(null)
const updateTime = ref('')

const loadSectorData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    const heatmapData = await getSectorHeatmap()
    // 按涨幅排序，第一名为主线，其余为观察
    sectors.value = [...heatmapData].sort((a, b) => parseFloat(b.avgChange) - parseFloat(a.avgChange))
    updateTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    console.error('加载板块分析数据失败:', e)
    error.value = '数据加载失败，请稍后重试'
  } finally {
    if (!silent) loading.value = false
  }
}

// 根据板块数据生成状态描述（基于板块均涨幅与涨跌比）
const getStatus = (sector) => {
  const avg = parseFloat(sector.avgChange) || 0
  const ratio = sector.upCount / (sector.downCount || 1)
  if (avg > 2 && ratio > 2) return '量价齐升'
  if (avg > 1.5) return '资金流入'
  if (avg > 0.5) return '温和上行'
  if (avg > 0 && sector.downCount > sector.upCount * 0.5) return '高位分化'
  if (avg > 0) return '震荡偏强'
  if (avg > -1) return '弱势震荡'
  return '资金流出'
}

// 获取板块领涨个股（直接使用板块数据中的领涨股票字段）
const getTopStock = (sector) => {
  if (sector.topStock && sector.topStock !== '--') {
    return {
      name: sector.topStock,
      change: sector.topStockChange || '0.00',
    }
  }
  return null
}

// 判断是否为主线（涨幅最高且为正）
const isMain = (index, sector) => index === 0 && (parseFloat(sector.avgChange) || 0) > 0

const formatChange = (val) => {
  const n = parseFloat(val) || 0
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

const getChangeClass = (val) => {
  const n = parseFloat(val) || 0
  return n > 0 ? 'up' : n < 0 ? 'down' : 'flat'
}

const displaySectors = computed(() => sectors.value.slice(0, 8))

watch(() => props.refreshTrigger, () => loadSectorData(props.refreshSilent))

onMounted(() => {
  loadSectorData()
})
</script>

<template>
  <div class="sector-analysis">
    <div class="card-header">
      <h3 class="card-title">主线&观察板块</h3>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="state-box">
      <div class="mini-spinner"></div>
      <span class="state-text">加载板块数据...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-box error">
      <span class="state-text">{{ error }}</span>
      <button class="retry-btn" @click="loadSectorData">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!displaySectors.length" class="state-box">
      <span class="state-text">暂无板块数据</span>
    </div>

    <!-- 板块卡片横向滚动列表 -->
    <div v-else class="sector-scroll">
      <div
        v-for="(sector, index) in displaySectors"
        :key="sector.name"
        class="sector-card"
        :class="{ 'is-main': isMain(index, sector) }"
      >
        <!-- 顶部标签栏（主线深红渐变 / 观察灰蓝） -->
        <div class="card-top">
          <div class="top-row">
            <span class="dir-tag" :class="isMain(index, sector) ? 'tag-main' : 'tag-observe'">
              {{ isMain(index, sector) ? '主线' : '观察' }}
            </span>
            <span class="avg-change" :class="getChangeClass(sector.avgChange)">
              {{ formatChange(sector.avgChange) }}
            </span>
          </div>
          <span class="sector-name">{{ sector.name }}</span>
        </div>

        <!-- 中部状态描述 -->
        <div class="card-mid">
          <span class="status-dot" :class="getChangeClass(sector.avgChange)"></span>
          <span class="status-text">{{ getStatus(sector) }}</span>
        </div>

        <!-- 底部领涨个股 + 涨跌统计 -->
        <div class="card-bottom">
          <div class="updown-row">
            <span class="ud-item up">{{ sector.upCount }}涨</span>
            <span class="ud-item down">{{ sector.downCount }}跌</span>
          </div>
          <div class="top-stock-row" v-if="getTopStock(sector)">
            <span class="top-label">领涨</span>
            <span class="top-name">{{ getTopStock(sector).name }}</span>
            <span class="top-change" :class="getChangeClass(getTopStock(sector).change)">
              {{ formatChange(getTopStock(sector).change) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="sector-source">数据来源：akshare · 东方财富行业板块行情 · 状态标签基于板块均涨幅与涨跌比自动生成 · {{ updateTime }}</div>
  </div>
</template>

<style scoped>
.sector-analysis {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-separator);
  padding: 14px;
  overflow: hidden;
}

/* 标题栏 */
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

/* 状态盒子（加载/错误/空） */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0;
}
.state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.state-box.error .state-text {
  color: var(--color-red);
}
.retry-btn {
  padding: 4px 14px;
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-smooth);
}
.retry-btn:active {
  background: var(--color-surface-hover);
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-separator);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 横向滚动列表 */
.sector-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 0 6px;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}
.sector-scroll::-webkit-scrollbar {
  height: 0;
  width: 0;
}

/* 板块卡片 */
.sector-card {
  flex: 0 0 140px;
  width: 140px;
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-separator);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  scroll-snap-align: start;
  transition: transform var(--duration-fast) var(--ease-spring);
}
.sector-card:active {
  transform: scale(0.97);
}

/* 顶部标签栏 */
.card-top {
  padding: 10px 10px 8px;
  background: rgba(139, 148, 158, 0.1);
  border-bottom: 1px solid var(--color-separator);
}
.sector-card.is-main .card-top {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
  border-bottom-color: rgba(239, 68, 68, 0.18);
}
.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dir-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.tag-main {
  background: rgba(239, 68, 68, 0.22);
  color: var(--color-red);
}
.tag-observe {
  background: rgba(139, 148, 158, 0.18);
  color: var(--color-text-tertiary);
}
.avg-change {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.avg-change.up { color: var(--color-red); }
.avg-change.down { color: var(--color-green); }
.avg-change.flat { color: var(--color-text-tertiary); }
.sector-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

/* 中部状态描述 */
.card-mid {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 9px 10px 6px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-text-tertiary);
}
.status-dot.up { background: var(--color-red); box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
.status-dot.down { background: var(--color-green); }
.status-dot.flat { background: var(--color-text-tertiary); }
.status-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* 底部领涨个股 + 涨跌统计 */
.card-bottom {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 0 10px 10px;
  margin-top: auto;
}
.updown-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.ud-item.up { color: var(--color-red); }
.ud-item.down { color: var(--color-green); }

.top-stock-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: var(--color-surface-hover);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-separator);
}
.sector-card.is-main .top-stock-row {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.15);
}
.top-label {
  font-size: 9px;
  color: var(--color-text-tertiary);
  font-weight: 600;
  flex-shrink: 0;
}
.top-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.top-change {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.top-change.up { color: var(--color-red); }
.top-change.down { color: var(--color-green); }
.top-change.flat { color: var(--color-text-tertiary); }

/* 移动端适配 */
@media (max-width: 430px) {
  .sector-analysis {
    padding: 12px;
  }
  .sector-card {
    flex: 0 0 132px;
    width: 132px;
  }
}

.sector-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  border-top: 0.5px solid var(--color-separator);
  line-height: 1.4;
}
</style>

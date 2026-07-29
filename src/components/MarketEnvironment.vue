<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, computed, watch } from 'vue'
import { getMarketAnalysis, getMarketSentiment } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const loading = ref(true)
const error = ref(null)
const analysis = ref(null)
const sentiment = ref(null)
const lastUpdate = ref('')

// 上证 / 深证 涨跌幅（数值）
const shChange = computed(() => parseFloat(analysis.value?.shIndex?.change || 0))
const szChange = computed(() => parseFloat(analysis.value?.szIndex?.change || 0))

// 涨跌停统计
const limitUp = computed(() => sentiment.value?.limitUpCount ?? analysis.value?.limitUpCount ?? 0)
const limitDown = computed(() => sentiment.value?.limitDownCount ?? analysis.value?.limitDownCount ?? 0)
const bombCount = computed(() => sentiment.value?.bombCount ?? 0)

// 涨跌广度
const upCount = computed(() => analysis.value?.upCount || 0)
const downCount = computed(() => analysis.value?.downCount || 0)
const breadthTotal = computed(() => upCount.value + downCount.value || 1)
const upPct = computed(() => ((upCount.value / breadthTotal.value) * 100).toFixed(1))
const downPct = computed(() => ((downCount.value / breadthTotal.value) * 100).toFixed(1))

/**
 * 基于种子生成确定性迷你 sparkline 数据（趋势方向与涨跌一致）
 */
function makeSparkline(seedStr, isUp) {
  let s = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    s ^= seedStr.charCodeAt(i)
    s = Math.imul(s, 16777619) >>> 0
  }
  const rand = () => {
    s = (Math.imul(s, 9301) + 49297) % 233280
    return s / 233280
  }
  const n = 24
  const trend = isUp ? 0.34 : -0.34
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const base = 0.5 + trend * t
    const wiggle = (rand() - 0.5) * 0.16
    pts.push(base + wiggle)
  }
  return pts
}

function toLinePath(values, w, h) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = w / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = h - ((v - min) / range) * (h - 4) - 2
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
    })
    .join(' ')
}

function toAreaPath(values, w, h) {
  return toLinePath(values, w, h) + ` L ${w.toFixed(1)} ${h} L 0 ${h} Z`
}

const shSpark = computed(() => {
  if (!analysis.value) return { line: '', area: '' }
  const pts = makeSparkline('sh' + analysis.value.shIndex.value, shChange.value >= 0)
  return { line: toLinePath(pts, 92, 30), area: toAreaPath(pts, 92, 30) }
})
const szSpark = computed(() => {
  if (!analysis.value) return { line: '', area: '' }
  const pts = makeSparkline('sz' + analysis.value.szIndex.value, szChange.value >= 0)
  return { line: toLinePath(pts, 92, 30), area: toAreaPath(pts, 92, 30) }
})

const fmtChange = (v) => (v >= 0 ? '+' : '') + v.toFixed(2)

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    const [a, s] = await Promise.all([
      getMarketAnalysis(),
      getMarketSentiment().catch(() => null),
    ])
    analysis.value = a
    sentiment.value = s
    lastUpdate.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch (e) {
    console.error('加载盘型/环境数据失败:', e)
    error.value = e?.message || '数据加载失败'
  } finally {
    if (!silent) loading.value = false
  }
}

const retry = () => loadData()

// 定时刷新：每30秒刷新一次（盘中高频更新）
let refreshTimer = null
watch(() => props.refreshTrigger, () => loadData(props.refreshSilent))
onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 30000)
})
onActivated(() => {
  if (!refreshTimer) refreshTimer = setInterval(loadData, 30000)
})
onDeactivated(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="me-card">
    <!-- 标题栏 -->
    <div class="me-header">
      <span class="me-badge">2</span>
      <span class="me-title">盘型/环境</span>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="me-state">
      <div class="me-spinner"></div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="me-state me-state-error">
      <span class="me-state-text">{{ error }}</span>
      <button class="me-retry" @click="retry">重试</button>
    </div>

    <!-- 2x2 网格 -->
    <div v-else class="me-grid">
      <!-- 左上：上证指数 -->
      <div class="me-cell">
        <div class="me-cell-head">
          <span class="me-name">上证指数</span>
          <span class="me-change" :class="shChange >= 0 ? 'up' : 'down'">
            {{ fmtChange(shChange) }}%
          </span>
        </div>
        <div class="me-value" :class="shChange >= 0 ? 'up' : 'down'">
          {{ analysis.shIndex.value }}
        </div>
        <svg class="me-spark" viewBox="0 0 92 30" preserveAspectRatio="none">
          <path :d="shSpark.area" :fill="shChange >= 0 ? '#ef4444' : '#22c55e'" fill-opacity="0.12" />
          <path :d="shSpark.line" :stroke="shChange >= 0 ? '#ef4444' : '#22c55e'" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>

      <!-- 右上：深证成指 -->
      <div class="me-cell">
        <div class="me-cell-head">
          <span class="me-name">深证成指</span>
          <span class="me-change" :class="szChange >= 0 ? 'up' : 'down'">
            {{ fmtChange(szChange) }}%
          </span>
        </div>
        <div class="me-value" :class="szChange >= 0 ? 'up' : 'down'">
          {{ analysis.szIndex.value }}
        </div>
        <svg class="me-spark" viewBox="0 0 92 30" preserveAspectRatio="none">
          <path :d="szSpark.area" :fill="szChange >= 0 ? '#ef4444' : '#22c55e'" fill-opacity="0.12" />
          <path :d="szSpark.line" :stroke="szChange >= 0 ? '#ef4444' : '#22c55e'" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>

      <!-- 左下：涨跌停统计 -->
      <div class="me-cell">
        <div class="me-cell-head">
          <span class="me-name">涨跌停统计</span>
        </div>
        <div class="me-limit-row">
          <div class="me-limit-item">
            <span class="me-limit-val up">{{ limitUp }}</span>
            <span class="me-limit-lbl">涨停</span>
          </div>
          <div class="me-limit-item">
            <span class="me-limit-val down">{{ limitDown }}</span>
            <span class="me-limit-lbl">跌停</span>
          </div>
          <div class="me-limit-item">
            <span class="me-limit-val bomb">{{ bombCount }}</span>
            <span class="me-limit-lbl">炸板</span>
          </div>
        </div>
      </div>

      <!-- 右下：涨跌广度 -->
      <div class="me-cell">
        <div class="me-cell-head">
          <span class="me-name">涨跌广度</span>
        </div>
        <div class="me-breadth-bar">
          <div class="me-breadth-up" :style="{ width: upPct + '%' }"></div>
          <div class="me-breadth-down" :style="{ width: downPct + '%' }"></div>
        </div>
        <div class="me-breadth-num">
          <span class="up">{{ upCount }}涨 · {{ upPct }}%</span>
          <span class="down">{{ downCount }}跌 · {{ downPct }}%</span>
        </div>
      </div>
    </div>

    <div class="me-source">数据来源：akshare · 沪深重要指数 + 全市场涨跌停统计 · 更新于 {{ lastUpdate }}</div>
  </div>
</template>

<style scoped>
.me-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-separator);
  padding: 12px;
  overflow: hidden;
}

/* ===== 标题栏 ===== */
.me-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.me-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-xs);
  background: var(--color-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.me-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}

/* ===== 状态态 ===== */
.me-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 150px;
  flex-wrap: wrap;
}
.me-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-separator-opaque, #30363d);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: me-spin 0.8s linear infinite;
}
@keyframes me-spin {
  to {
    transform: rotate(360deg);
  }
}
.me-state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.me-retry {
  border: none;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
}
.me-retry:active {
  transform: scale(0.96);
}

/* ===== 2x2 网格 ===== */
.me-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.me-cell {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-separator);
  padding: 10px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.me-cell-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.me-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-change {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.me-change.up {
  color: var(--color-red);
}
.me-change.down {
  color: var(--color-green);
}

/* 指数数值 */
.me-value {
  font-size: 19px;
  font-weight: 800;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  margin-bottom: 4px;
}
.me-value.up {
  color: var(--color-red);
}
.me-value.down {
  color: var(--color-green);
}

/* sparkline */
.me-spark {
  width: 100%;
  height: 30px;
  display: block;
  margin-top: auto;
}

/* 涨跌停统计 */
.me-limit-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  margin-top: 2px;
  flex: 1;
}
.me-limit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.me-limit-val {
  font-size: 22px;
  font-weight: 800;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.me-limit-val.up {
  color: var(--color-red);
}
.me-limit-val.down {
  color: var(--color-green);
}
.me-limit-val.bomb {
  color: var(--color-orange);
}
.me-limit-lbl {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

/* 涨跌广度 */
.me-breadth-bar {
  display: flex;
  height: 10px;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 6px;
  background: var(--color-surface-hover);
}
.me-breadth-up {
  background: var(--color-red);
  transition: width var(--duration-normal) var(--ease-smooth);
  min-width: 0;
}
.me-breadth-down {
  background: var(--color-green);
  transition: width var(--duration-normal) var(--ease-smooth);
  min-width: 0;
}
.me-breadth-num {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.me-breadth-num .up {
  color: var(--color-red);
}
.me-breadth-num .down {
  color: var(--color-green);
}

.me-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 8px;
  border-top: 0.5px solid var(--color-separator);
  font-variant-numeric: tabular-nums;
}
</style>

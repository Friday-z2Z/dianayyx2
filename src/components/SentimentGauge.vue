<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getMarketSentiment } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const loading = ref(true)
const error = ref(null)
const data = ref(null)

const upCount = computed(() => data.value?.upCount || 0)
const downCount = computed(() => data.value?.downCount || 0)

// 情绪比例：上涨占比（0-100）
const ratio = computed(() => {
  const up = upCount.value
  const down = downCount.value
  const total = up + down
  return total > 0 ? (up / total) * 100 : 50
})

// ===== 仪表盘几何参数 =====
const CX = 110
const CY = 118
const R = 88
const STROKE = 14

const segDefs = [
  { from: 0, to: 20, color: '#3b82f6', label: '冰点' },
  { from: 20, to: 40, color: '#14b8a6', label: '回暖' },
  { from: 40, to: 60, color: '#eab308', label: '发酵' },
  { from: 60, to: 80, color: '#f97316', label: '高潮' },
  { from: 80, to: 100, color: '#ef4444', label: '退潮' },
]

// 百分比 -> 弧上坐标
const pointAt = (p) => {
  const ang = (180 * (1 - p / 100)) * (Math.PI / 180)
  return [CX + R * Math.cos(ang), CY - R * Math.sin(ang)]
}

// 五段彩色弧
const segments = computed(() =>
  segDefs.map((s) => {
    const [x1, y1] = pointAt(s.from)
    const [x2, y2] = pointAt(s.to)
    return {
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      color: s.color,
      label: s.label,
    }
  })
)

// 当前阶段文字标签
const stageLabel = computed(() => {
  const p = ratio.value
  if (p < 10) return '冰点观望'
  if (p < 20) return '冰点'
  if (p < 30) return '回暖初现'
  if (p < 40) return '回暖'
  if (p < 50) return '发酵初期'
  if (p < 60) return '发酵扩散'
  if (p < 70) return '发酵扩散偏高潮'
  if (p < 80) return '高潮'
  if (p < 90) return '高潮转退潮'
  return '退潮'
})

// 当前阶段颜色
const stageColor = computed(() => {
  const p = ratio.value
  if (p < 20) return '#3b82f6'
  if (p < 40) return '#14b8a6'
  if (p < 60) return '#eab308'
  if (p < 80) return '#f97316'
  return '#ef4444'
})

// 当前所在段索引（用于高亮刻度标签）
const activeSeg = computed(() => {
  const p = ratio.value
  if (p < 20) return 0
  if (p < 40) return 1
  if (p < 60) return 2
  if (p < 80) return 3
  return 4
})

// 指针：固定竖直向上的三角形（底座在中心，尖端朝上）
// 实际指向由 CSS transform: rotate 实现，便于平滑过渡动画
const NEEDLE_LEN = 74
const NEEDLE_W = 5
const needle = computed(() => {
  const tipX = CX
  const tipY = CY - NEEDLE_LEN
  const b1x = CX - NEEDLE_W
  const b1y = CY
  const b2x = CX + NEEDLE_W
  const b2y = CY
  return `${b1x.toFixed(2)},${b1y.toFixed(2)} ${tipX.toFixed(2)},${tipY.toFixed(2)} ${b2x.toFixed(2)},${b2y.toFixed(2)}`
})

// 指针旋转角度（CSS rotate，以竖直向上为 0deg，顺时针为正）
const needleRotate = computed(() => {
  const p = ratio.value
  // p=50 -> 0deg（竖直向上），p=0 -> -90deg（指向左），p=100 -> 90deg（指向右）
  return (p - 50) * 1.8
})

const loadData = async (silent = false) => {
  if (!silent) loading.value = true
  if (!silent) error.value = null
  try {
    data.value = await getMarketSentiment()
  } catch (e) {
    console.error('加载市场情绪数据失败:', e)
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
  <div class="sg-card">
    <!-- 标题栏 -->
    <div class="sg-header">
      <span class="sg-title">情绪运行阶段</span>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="sg-state">
      <div class="sg-spinner"></div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="sg-state sg-state-error">
      <span class="sg-state-text">{{ error }}</span>
      <button class="sg-retry" @click="retry">重试</button>
    </div>

    <!-- 正常态 -->
    <template v-else>
      <!-- 仪表盘 -->
      <div class="sg-gauge-wrap">
        <svg class="sg-gauge" viewBox="0 0 220 132" preserveAspectRatio="xMidYMid meet">
          <!-- 背景轨道 -->
          <path
            :d="`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`"
            fill="none"
            stroke="var(--color-surface-hover)"
            :stroke-width="STROKE"
            stroke-linecap="round"
          />
          <!-- 五段彩色弧 -->
          <path
            v-for="(s, i) in segments"
            :key="i"
            :d="s.d"
            fill="none"
            :stroke="s.color"
            :stroke-width="STROKE"
            stroke-linecap="butt"
            :opacity="i === activeSeg ? 1 : 0.55"
          />
          <!-- 指针 -->
          <g class="sg-needle-group" :style="{ transform: `rotate(${needleRotate}deg)`, transformOrigin: `${CX}px ${CY}px` }">
            <polygon :points="needle" class="sg-needle" />
          </g>
          <!-- 中心轴 -->
          <circle :cx="CX" :cy="CY" r="7" class="sg-hub" />
          <circle :cx="CX" :cy="CY" r="3" class="sg-hub-inner" />
        </svg>

        <!-- 五段刻度标签 -->
        <div class="sg-ticks">
          <span
            v-for="(s, i) in segments"
            :key="i"
            class="sg-tick"
            :class="{ active: i === activeSeg }"
            :style="{ color: i === activeSeg ? s.color : '' }"
          >{{ s.label }}</span>
        </div>
      </div>

      <!-- 当前阶段文字 -->
      <div class="sg-stage" :style="{ color: stageColor }">{{ stageLabel }}</div>
      <div class="sg-index">
        情绪指数 <span class="sg-index-val" :style="{ color: stageColor }">{{ ratio.toFixed(0) }}</span>
      </div>

      <!-- 上涨 / 下跌 -->
      <div class="sg-sides">
        <div class="sg-side up">
          <span class="sg-side-val">{{ upCount }}</span>
          <span class="sg-side-lbl">上涨家</span>
        </div>
        <div class="sg-side down">
          <span class="sg-side-val">{{ downCount }}</span>
          <span class="sg-side-lbl">下跌家</span>
        </div>
      </div>

      <div class="sg-source">数据来源：akshare · 全市场涨跌家数统计 · 情绪指数={{ ratio.toFixed(0) }}（上涨占比）</div>
    </template>
  </div>
</template>

<style scoped>
.sg-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-separator);
  padding: 12px;
  overflow: hidden;
}

/* ===== 标题栏 ===== */
.sg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sg-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}

/* ===== 状态态 ===== */
.sg-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  flex-wrap: wrap;
}
.sg-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-separator-opaque, #30363d);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: sg-spin 0.8s linear infinite;
}
@keyframes sg-spin {
  to {
    transform: rotate(360deg);
  }
}
.sg-state-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.sg-retry {
  border: none;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
}
.sg-retry:active {
  transform: scale(0.96);
}

/* ===== 仪表盘 ===== */
.sg-gauge-wrap {
  position: relative;
  width: 100%;
  max-width: 260px;
  margin: 0 auto;
}
.sg-gauge {
  width: 100%;
  height: auto;
  display: block;
}
.sg-needle-group {
  transform-box: view-box;
  transition: transform 0.8s var(--ease-out-expo);
}
.sg-needle {
  fill: var(--color-text-primary);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
.sg-hub {
  fill: var(--color-surface-hover);
  stroke: var(--color-text-tertiary);
  stroke-width: 1;
}
.sg-hub-inner {
  fill: var(--color-text-primary);
}

/* 刻度标签 */
.sg-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  padding: 0 6px;
}
.sg-tick {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  transition: color var(--duration-normal) var(--ease-smooth);
}
.sg-tick.active {
  font-weight: 700;
}

/* ===== 当前阶段 ===== */
.sg-stage {
  text-align: center;
  font-size: 17px;
  font-weight: 800;
  margin-top: 10px;
  letter-spacing: 0.02em;
  transition: color var(--duration-normal) var(--ease-smooth);
}
.sg-index {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.sg-index-val {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

/* ===== 上涨 / 下跌 ===== */
.sg-sides {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-separator);
}
.sg-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
}
.sg-side-val {
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.sg-side-lbl {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}
.sg-side.up .sg-side-val {
  color: var(--color-red);
}
.sg-side.down .sg-side-val {
  color: var(--color-green);
}

.sg-source {
  font-size: 9px;
  color: var(--color-text-tertiary);
  text-align: center;
  padding: 6px 0 2px;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}
</style>

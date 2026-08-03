<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { detectCity, getCurrentWeather } from '../services/weatherService.js'
import NewsBar from '../components/NewsBar.vue'
import MarketSummary from '../components/MarketSummary.vue'
import MarketEnvironment from '../components/MarketEnvironment.vue'
import SentimentGauge from '../components/SentimentGauge.vue'
import SectorAnalysis from '../components/SectorAnalysis.vue'
import RiskWarning from '../components/RiskWarning.vue'
import MarketDashboard from '../components/MarketDashboard.vue'
import FundFlowCard from '../components/FundFlowCard.vue'
import MarketHeatmap from '../components/MarketHeatmap.vue'
import MultiRanking from '../components/MultiRanking.vue'
import MarketCalendar from '../components/MarketCalendar.vue'
import GlobalIndices from '../components/GlobalIndices.vue'

// Time & Greeting
const currentTime = ref(new Date())
const showContent = ref(false)
const scrollEl = ref(null)
const scrollY = ref(0)
const isHeaderCompact = ref(false)

// Sub-tab system - 环境优先，排行第二，去掉emoji图标
const subTabs = [
  { key: 'env', label: '环境' },
  { key: 'ranking', label: '排行' },
  { key: 'sector', label: '板块' },
  { key: 'capital', label: '资金' },
  { key: 'calendar', label: '日历' },
]
const activeSubTab = ref('env')

// Double-tap to scroll to top
let lastTapTime = 0
const handleHeaderTap = () => {
  const now = Date.now()
  if (now - lastTapTime < 350) {
    if (scrollEl.value) {
      scrollEl.value.scrollTo({ top: 0, behavior: 'smooth' })
    }
    lastTapTime = 0
  } else {
    lastTapTime = now
  }
}

// Global refresh
const globalRefreshing = ref(false)
const refreshKey = ref(0)
const refreshSilent = ref(false)

// Scroll position memory (for tab switching)
const savedScrollTop = ref(0)

const greeting = computed(() => {
  const hour = currentTime.value.getHours()
  if (hour < 6) return { text: '夜深了', sub: '注意休息' }
  if (hour < 9) return { text: '早上好', sub: '新的一天' }
  if (hour < 12) return { text: '上午好', sub: '保持专注' }
  if (hour < 14) return { text: '中午好', sub: '记得午饭' }
  if (hour < 18) return { text: '下午好', sub: '继续加油' }
  if (hour < 22) return { text: '晚上好', sub: '放松一下' }
  return { text: '夜深了', sub: '注意休息' }
})

const dateStr = computed(() => {
  const d = currentTime.value
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
})

// Weather
const weather = ref(null)
const weatherLoading = ref(true)

const loadWeather = async () => {
  weatherLoading.value = true
  try {
    const city = await detectCity()
    weather.value = await getCurrentWeather(city)
  } catch (e) {
    console.error('加载天气失败', e)
  } finally {
    weatherLoading.value = false
  }
}

const getAqiClass = (aqi) => {
  if (aqi <= 50) return 'aqi-good'
  if (aqi <= 100) return 'aqi-moderate'
  if (aqi <= 150) return 'aqi-unhealthy-sensitive'
  if (aqi <= 200) return 'aqi-unhealthy'
  return 'aqi-hazardous'
}

// Global refresh - manual: shows loading in child components
const handleGlobalRefresh = async () => {
  globalRefreshing.value = true
  refreshSilent.value = false
  refreshKey.value++
  await loadWeather()
  setTimeout(() => { globalRefreshing.value = false }, 800)
}

// Scroll handling
const handleScroll = () => {
  if (!scrollEl.value) return
  const top = scrollEl.value.scrollTop
  scrollY.value = top
  savedScrollTop.value = top
  isHeaderCompact.value = top > 80
}

// Sub-tab switch: scroll to tab content area
const switchSubTab = (key) => {
  activeSubTab.value = key
}

// Timers
let autoRefreshTimer = null
let clockTimer = null

const startTimers = () => {
  clockTimer = setInterval(() => { currentTime.value = new Date() }, 60000)
  autoRefreshTimer = setInterval(() => {
    refreshSilent.value = true
    refreshKey.value++
  }, 120000)
}

const stopTimers = () => {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null }
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
}

onMounted(() => {
  setTimeout(() => { showContent.value = true }, 50)
  loadWeather()
  startTimers()
})

onActivated(() => {
  currentTime.value = new Date()
  if (!autoRefreshTimer && !clockTimer) {
    startTimers()
  }
  const restoreScroll = () => {
    if (scrollEl.value) {
      if (savedScrollTop.value > 0) {
        scrollEl.value.scrollTop = savedScrollTop.value
      }
    }
  }
  nextTick(() => {
    restoreScroll()
    requestAnimationFrame(() => {
      restoreScroll()
      setTimeout(restoreScroll, 200)
      setTimeout(restoreScroll, 400)
    })
  })
})

onDeactivated(() => {
  stopTimers()
})

onUnmounted(() => {
  stopTimers()
})
</script>

<template>
  <div class="home-page" ref="scrollEl" @scroll="handleScroll">
    <div class="scroll-content" :class="{ visible: showContent }">
      <!-- Sticky Header Bar - double-tap to scroll to top -->
      <div class="sticky-header" :class="{ compact: isHeaderCompact }" @click="handleHeaderTap">
        <div class="sticky-inner">
          <div class="sticky-left">
            <transition name="header-morph" mode="out-in">
              <span v-if="isHeaderCompact" class="compact-greeting" key="greeting">
                {{ greeting.text }}，Diana
                <span v-if="weather" class="compact-weather">{{ weather.city }} {{ weather.weatherIcon }} {{ weather.temperature }}° {{ weather.weatherDesc }}</span>
              </span>
              <span v-else class="header-date" key="date">{{ dateStr }}</span>
            </transition>
          </div>
          <div class="sticky-right">
            <button class="global-refresh-btn" :class="{ spinning: globalRefreshing }" @click.stop="handleGlobalRefresh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <span class="terminal-badge">Diana Terminal</span>
          </div>
        </div>
      </div>

      <!-- Page Header -->
      <header class="page-header" :style="{ opacity: Math.max(0, 1 - scrollY / 120), transform: `translateY(${-scrollY * 0.3}px)` }">
        <div class="header-top">
          <p class="date-label">{{ dateStr }}</p>
        </div>
        <h1 class="large-title">
          {{ greeting.text }}，Diana
          <!-- 天气精简：城市 图标 温度 天气描述 -->
          <span v-if="weather" class="title-weather">
            <span class="tw-city">{{ weather.city }}</span>
            <span class="tw-icon">{{ weather.weatherIcon }}</span>
            <span class="tw-temp">{{ weather.temperature }}°</span>
            <span class="tw-desc">{{ weather.weatherDesc }}</span>
          </span>
        </h1>
        <p class="header-sub">市场复盘仪表盘</p>
      </header>

      <!-- 时政新闻入口 -->
      <section class="news-section">
        <NewsBar :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- AI复盘 - 始终可见 -->
      <section class="dashboard-section">
        <MarketSummary :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 子Tab导航条 -->
      <div class="sub-tab-bar" :class="{ compact: isHeaderCompact }">
        <button
          v-for="tab in subTabs"
          :key="tab.key"
          class="sub-tab-item"
          :class="{ active: activeSubTab === tab.key }"
          @click="switchSubTab(tab.key)"
        >
          <span class="sub-tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab内容区域 -->
      <div class="sub-tab-content">
        <!-- Tab: 排行 (市场排行前移) -->
        <template v-if="activeSubTab === 'ranking'">
          <section class="dashboard-section">
            <MultiRanking :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
          <section class="dashboard-section">
            <MarketDashboard :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
        </template>

        <!-- Tab: 板块 -->
        <template v-if="activeSubTab === 'sector'">
          <section class="dashboard-section">
            <SectorAnalysis :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
          <section class="dashboard-section">
            <MarketHeatmap :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
        </template>

        <!-- Tab: 资金 -->
        <template v-if="activeSubTab === 'capital'">
          <section class="dashboard-section">
            <FundFlowCard :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
        </template>

        <!-- Tab: 环境 -->
        <template v-if="activeSubTab === 'env'">
          <section class="dashboard-section">
            <MarketEnvironment :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
          <section class="dashboard-section">
            <SentimentGauge :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
        </template>

        <!-- Tab: 日历 -->
        <template v-if="activeSubTab === 'calendar'">
          <section class="dashboard-section">
            <MarketCalendar :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
          <section class="dashboard-section">
            <GlobalIndices :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
          </section>
        </template>
      </div>

      <!-- 风险边界 - 始终可见 -->
      <section class="dashboard-section">
        <RiskWarning :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- Bottom spacer -->
      <div class="tab-spacer"></div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--color-bg);
  position: relative;
}

.scroll-content {
  opacity: 0;
  transform: translateY(12px);
  transition: all 0.6s var(--ease-out-expo);
}
.scroll-content.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Sticky Header ===== */
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: transparent;
  transition: all 0.35s var(--ease-out-expo);
  padding: 0;
}
.sticky-header.compact {
  background: rgba(13, 17, 23, 0.92);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
}
.sticky-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 44px;
}
.sticky-header.compact .sticky-inner {
  padding: 8px 16px;
  height: 48px;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(139, 148, 158, 0.3);
}
.sticky-left { flex: 1; min-width: 0; overflow: hidden; }
.compact-greeting {
  font-size: 15px; font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.header-date {
  font-size: 13px; font-weight: 500;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}
.sticky-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.global-refresh-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1px solid var(--color-separator);
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s var(--ease-smooth);
}
.global-refresh-btn:active { transform: scale(0.92); }
.global-refresh-btn.spinning svg { animation: global-spin 0.8s linear infinite; }
@keyframes global-spin { to { transform: rotate(360deg); } }
.terminal-badge {
  font-size: 10px; font-weight: 700;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 3px 8px; border-radius: var(--radius-full);
  border: 1px solid rgba(37, 99, 235, 0.25);
  letter-spacing: 0.02em;
}

/* Header morph transition */
.header-morph-enter-active,
.header-morph-leave-active { transition: all 0.25s var(--ease-smooth); }
.header-morph-enter-from { opacity: 0; transform: translateY(-6px); }
.header-morph-leave-to { opacity: 0; transform: translateY(6px); }

/* ===== Page Header ===== */
.page-header {
  padding: 40px 16px 0;
  will-change: opacity, transform;
}
.header-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.date-label {
  font-size: 12px; font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em; text-transform: uppercase;
}
.large-title {
  font-size: 28px; font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.03em; line-height: 1.15; margin: 0;
}
/* 天气内联在标题后 */
.title-weather {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 10px;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-secondary);
  vertical-align: middle;
}
.tw-city {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}
.tw-icon { font-size: 15px; line-height: 1; }
.tw-temp {
  font-size: 16px; font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.tw-desc {
  font-weight: 500;
  color: var(--color-text-tertiary);
}
.header-sub {
  font-size: 13px; font-weight: 500;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}
/* 吸顶时的精简天气 */
.compact-weather {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-left: 6px;
}

/* ===== Sub-Tab Bar ===== */
.sub-tab-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 16px;
  position: sticky;
  top: 44px;
  z-index: 90;
  background: var(--color-bg);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  /* 不过渡 top：header 高度变化是瞬间的，tab bar 的 top 也必须瞬间同步，
     否则两者不同步会产生 4px 间隙露出滚动内容导致闪白 */
  border-bottom: 1px solid transparent;
}
.sub-tab-bar::-webkit-scrollbar { display: none; }
.sub-tab-bar.compact {
  top: 48px;
  border-bottom: 1px solid var(--color-separator);
}
.sub-tab-item {
  position: relative;
  padding: 12px 0;
  margin-right: 24px;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.2s var(--ease-smooth);
}
.sub-tab-item:last-child { margin-right: 0; }
.sub-tab-item:active { color: var(--color-text-secondary); }
.sub-tab-item.active {
  color: var(--color-text-primary);
  font-weight: 700;
}
.sub-tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-accent);
  border-radius: 1px;
}
.sub-tab-label { letter-spacing: 0.02em; }

/* ===== Sub-Tab Content ===== */
.sub-tab-content {
  min-height: 200px;
}

/* ===== Dashboard Sections ===== */
.dashboard-section {
  padding: 10px 16px 0;
}
.news-section { padding: 8px 0 0; }

/* ===== Bottom spacer ===== */
.tab-spacer {
  height: calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
}
</style>

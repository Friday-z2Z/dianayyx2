<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick } from 'vue'
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

// Double-tap to scroll to top
let lastTapTime = 0
const handleHeaderTap = () => {
  const now = Date.now()
  if (now - lastTapTime < 350) {
    // Double tap detected - smooth scroll to top
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
const lastRefreshTime = ref('')

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
  lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  // Also reload weather
  await loadWeather()
  setTimeout(() => { globalRefreshing.value = false }, 800)
}

// Scroll handling
const handleScroll = () => {
  if (!scrollEl.value) return
  const top = scrollEl.value.scrollTop
  scrollY.value = top
  // Continuously save scroll position so it's available even if
  // onDeactivated fires after DOM is detached (where scrollTop would be 0)
  savedScrollTop.value = top
  isHeaderCompact.value = top > 80
}

// Timers (managed by onActivated/onDeactivated for KeepAlive support)
let autoRefreshTimer = null
let clockTimer = null

const startTimers = () => {
  // Update clock every minute
  clockTimer = setInterval(() => { currentTime.value = new Date() }, 60000)
  // Auto refresh market data every 2 minutes (silent - no loading indicator)
  autoRefreshTimer = setInterval(() => {
    refreshSilent.value = true
    refreshKey.value++
    lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }, 120000)
}

const stopTimers = () => {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null }
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
}

// onMounted: runs ONCE on first render (initial data fetch)
onMounted(() => {
  setTimeout(() => { showContent.value = true }, 50)
  loadWeather()
  lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  startTimers()
})

// onActivated: runs when component becomes visible again (e.g. switching back from Profile)
// Does NOT re-fetch data — just restores scroll position and restarts timers
onActivated(() => {
  // Refresh greeting time immediately
  currentTime.value = new Date()
  // Restart timers if they were stopped (avoids double-start on first mount since onMounted already started them)
  if (!autoRefreshTimer && !clockTimer) {
    startTimers()
  }
  // Restore scroll position after DOM is re-inserted by KeepAlive
  // Try at multiple points to handle transition timing variations
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
      // Final attempt after tab-switch transition completes (~150ms + buffer)
      setTimeout(restoreScroll, 200)
      setTimeout(restoreScroll, 400)
    })
  })
})

// onDeactivated: runs when component is hidden (switching to Profile)
// Clear timers to prevent background data refreshes
// Note: scroll position is already saved continuously by handleScroll,
// so we don't need to save it here (scrollEl.scrollTop may be 0 if DOM is already detached)
onDeactivated(() => {
  stopTimers()
})

// onUnmounted: final cleanup (component actually destroyed)
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
              <span v-if="isHeaderCompact" class="compact-greeting" key="greeting">{{ greeting.text }}，Diana</span>
              <span v-else class="header-date" key="date">{{ dateStr }}</span>
            </transition>
          </div>
          <div class="sticky-right">
            <span class="refresh-time" v-if="lastRefreshTime">{{ lastRefreshTime }}</span>
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
        <h1 class="large-title">{{ greeting.text }}，Diana</h1>
        <p class="header-sub">市场复盘仪表盘</p>
      </header>

      <!-- 时政新闻入口 -->
      <section class="news-section">
        <NewsBar :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- Weather Card (Compact) -->
      <section class="weather-section">
        <div v-if="weatherLoading" class="weather-card loading">
          <div class="weather-skeleton">
            <div class="skeleton-circle"></div>
            <div class="skeleton-lines">
              <div class="skeleton-line w60"></div>
              <div class="skeleton-line w40"></div>
            </div>
          </div>
        </div>
        <div v-else-if="weather" class="weather-card">
          <div class="weather-header-row">
            <div class="weather-main">
              <div class="weather-left">
                <span class="weather-icon">{{ weather.weatherIcon }}</span>
                <div class="weather-temp">
                  <span class="temp-value">{{ weather.temperature }}</span>
                  <span class="temp-unit">°C</span>
                </div>
              </div>
              <div class="weather-right">
                <span class="weather-desc">{{ weather.weatherDesc }}</span>
                <span class="weather-city">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {{ weather.city }}
                </span>
                <div class="weather-details">
                  <span>体感 {{ weather.feelsLike }}°C</span>
                  <span>湿度 {{ weather.humidity }}%</span>
                </div>
              </div>
            </div>
            <div v-if="weather.quality" class="weather-aqi-badge" :class="getAqiClass(weather.aqi)">
              <span class="aqi-label">AQI</span>
              <span class="aqi-value">{{ weather.aqi }}</span>
              <span class="aqi-quality">{{ weather.quality }}</span>
            </div>
          </div>
          <div class="weather-extra-row">
            <div class="extra-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
              <span>{{ weather.windDirection }} {{ weather.windSpeed }}km/h</span>
            </div>
            <div class="extra-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><path d="M12 2v20M2 12h20"/></svg>
              <span>{{ weather.low }}° ~ {{ weather.high }}°</span>
            </div>
            <div class="extra-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>更新于 {{ weather.updateTime }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 1. 一句话总收口 -->
      <section class="dashboard-section">
        <MarketSummary :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 2. 盘型/环境 -->
      <section class="dashboard-section">
        <MarketEnvironment :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 3. 情绪运行阶段 -->
      <section class="dashboard-section">
        <SentimentGauge :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 4. 主线&观察板块 -->
      <section class="dashboard-section">
        <SectorAnalysis :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 5. 全市场情绪分时图 -->
      <section class="dashboard-section">
        <MarketDashboard :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 6. 资金流向（独立全宽） -->
      <section class="dashboard-section">
        <FundFlowCard :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 7. 行业热力图（独立全宽） -->
      <section class="dashboard-section">
        <MarketHeatmap :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 8. 多榜单同屏 -->
      <section class="dashboard-section">
        <MultiRanking :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 9. 新股+解禁+财报日历 -->
      <section class="dashboard-section">
        <MarketCalendar :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 10. 全球指数+汇率 -->
      <section class="dashboard-section">
        <GlobalIndices :refresh-trigger="refreshKey" :refresh-silent="refreshSilent" />
      </section>

      <!-- 11. 风险边界 -->
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
  background: rgba(13, 17, 23, 0.85);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-bottom: 1px solid var(--color-separator);
}
.sticky-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 44px;
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
.refresh-time {
  font-size: 10px; font-weight: 600;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
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
.header-sub {
  font-size: 13px; font-weight: 500;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

/* ===== Weather Section ===== */
.weather-section { padding: 12px 16px 0; }
.weather-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 16px;
  border: 1px solid var(--color-separator);
  overflow: hidden;
}
.weather-card.loading { min-height: 80px; }
.weather-skeleton {
  display: flex; align-items: center; gap: 16px;
}
.skeleton-circle {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(90deg, var(--color-surface-elevated) 25%, var(--color-surface-hover) 50%, var(--color-surface-elevated) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite;
}
.skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.skeleton-line {
  height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--color-surface-elevated) 25%, var(--color-surface-hover) 50%, var(--color-surface-elevated) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite;
}
.skeleton-line.w60 { width: 60%; }
.skeleton-line.w40 { width: 40%; }
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.weather-header-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; margin-bottom: 10px;
}
.weather-main { display: flex; align-items: center; gap: 16px; flex: 1; }
.weather-left { display: flex; align-items: center; gap: 10px; }
.weather-icon { font-size: 36px; line-height: 1; }
.weather-temp { display: flex; align-items: flex-start; }
.temp-value {
  font-size: 40px; font-weight: 300;
  color: var(--color-text-primary);
  letter-spacing: -0.04em; line-height: 1;
}
.temp-unit {
  font-size: 16px; font-weight: 300;
  color: var(--color-text-secondary); margin-top: 4px;
}
.weather-right { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.weather-desc { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.weather-city {
  font-size: 12px; color: var(--color-text-secondary);
  display: flex; align-items: center; gap: 3px;
}
.weather-city svg { opacity: 0.6; }
.weather-details {
  display: flex; gap: 12px; font-size: 11px;
  color: var(--color-text-tertiary); margin-top: 2px;
}

/* AQI Badge */
.weather-aqi-badge {
  display: flex; flex-direction: column; align-items: center;
  padding: 5px 9px; border-radius: 8px;
  background: rgba(34, 197, 94, 0.1); flex-shrink: 0; min-width: 48px;
}
.weather-aqi-badge.aqi-good { background: rgba(34, 197, 94, 0.1); }
.weather-aqi-badge.aqi-moderate { background: rgba(234, 179, 8, 0.12); }
.weather-aqi-badge.aqi-unhealthy-sensitive { background: rgba(249, 115, 22, 0.12); }
.weather-aqi-badge.aqi-unhealthy { background: rgba(239, 68, 68, 0.1); }
.weather-aqi-badge.aqi-hazardous { background: rgba(168, 85, 247, 0.12); }
.aqi-label { font-size: 8px; color: var(--color-text-tertiary); font-weight: 600; letter-spacing: 0.05em; }
.aqi-value { font-size: 16px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.aqi-quality { font-size: 9px; font-weight: 600; color: var(--color-text-secondary); }

.weather-extra-row {
  display: flex; gap: 14px; padding: 8px 0 0;
  border-top: 1px solid var(--color-separator);
}
.extra-item {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--color-text-tertiary);
}
.extra-item svg { color: var(--color-text-tertiary); opacity: 0.6; }

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

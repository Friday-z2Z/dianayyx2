<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { getFinancialNews } from '../services/stockService.js'

const props = defineProps({ refreshTrigger: { type: Number, default: 0 }, refreshSilent: { type: Boolean, default: false } })

const news = ref([])
const loading = ref(true)
const showPanel = ref(false)
const activeNews = ref(null)

const loadNews = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    news.value = await getFinancialNews()
  } catch (e) {
    console.error('加载新闻失败:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

const togglePanel = () => {
  if (news.value.length === 0 && !loading.value) {
    loadNews()
  }
  showPanel.value = !showPanel.value
}

const openNews = (item) => {
  activeNews.value = item
}

const closePanel = () => {
  showPanel.value = false
  activeNews.value = null
}

let refreshTimer = null
watch(() => props.refreshTrigger, () => loadNews(props.refreshSilent))
onMounted(() => {
  loadNews()
  refreshTimer = setInterval(() => loadNews(true), 5 * 60 * 1000)
})
onActivated(() => {
  if (!refreshTimer) refreshTimer = setInterval(() => loadNews(true), 5 * 60 * 1000)
})
onDeactivated(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="news-bar">
    <div class="news-header" @click="togglePanel">
      <div class="news-icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/>
        </svg>
      </div>
      <div class="news-ticker" v-if="!loading && news.length > 0">
        <transition name="ticker-slide" mode="out-in">
          <span :key="news[0]?.title" class="ticker-text">
            {{ news[0]?.title }}
          </span>
        </transition>
      </div>
      <div class="news-ticker" v-else-if="loading">
        <span class="ticker-text loading-text">加载财经要闻...</span>
      </div>
      <div class="news-ticker" v-else>
        <span class="ticker-text muted">暂无新闻</span>
      </div>
      <div class="news-expand-btn" v-if="news.length > 0">
        <span class="expand-text">{{ news.length }}条要闻</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10" class="expand-arrow" :class="{ rotated: showPanel }"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>

    <!-- 新闻面板 - 使用 Teleport 移到 body，避免祖先 transform 导致 fixed 定位失效 -->
    <Teleport to="body">
      <transition name="panel-slide">
        <div v-if="showPanel" class="news-panel-overlay" @click="closePanel">
          <div class="news-panel" @click.stop>
            <div class="panel-header">
              <h3 class="panel-title">重要财经要闻</h3>
              <button class="panel-close" @click="closePanel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="panel-list" v-if="!loading">
              <div
                v-for="(item, i) in news"
                :key="i"
                class="news-item"
                @click="openNews(item)"
              >
                <div class="news-item-time">{{ item.time }}</div>
                <div class="news-item-body">
                  <span class="news-item-title">{{ item.title }}</span>
                  <span class="news-item-source">{{ item.source }}</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" class="news-item-arrow"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
            <div class="panel-loading" v-else>
              <div class="panel-spinner"></div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- 新闻详情弹窗 - 同样使用 Teleport -->
    <Teleport to="body">
      <transition name="detail-fade">
        <div v-if="activeNews" class="news-detail-overlay" @click="activeNews = null">
          <div class="news-detail" @click.stop>
            <div class="detail-header">
              <span class="detail-source">{{ activeNews.source }}</span>
              <span class="detail-time">{{ activeNews.time }}</span>
              <button class="detail-close" @click="activeNews = null">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <h2 class="detail-title">{{ activeNews.title }}</h2>
            <p class="detail-content">{{ activeNews.content }}</p>
            <a v-if="activeNews.url && activeNews.url !== '#'" :href="activeNews.url" target="_blank" class="detail-link">
              查看原文
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <p class="detail-disclaimer">数据来源：{{ activeNews.source }} · 仅供参考</p>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.news-bar {
  margin: 0 16px;
  background: var(--color-surface);
  border-radius: 12px;
  border: 1px solid var(--color-separator);
  overflow: hidden;
}

.news-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.news-header:active { background: var(--color-surface-hover); }

.news-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-accent);
  flex-shrink: 0;
}

.news-ticker {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.ticker-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticker-text.loading-text { color: var(--color-text-tertiary); }
.ticker-text.muted { color: var(--color-text-tertiary); }

.ticker-slide-enter-active,
.ticker-slide-leave-active { transition: all 0.4s var(--ease-smooth); }
.ticker-slide-enter-from { opacity: 0; transform: translateX(10px); }
.ticker-slide-leave-to { opacity: 0; transform: translateX(-10px); }

.news-expand-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}
.expand-text {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}
.news-expand-btn svg { color: var(--color-text-tertiary); transition: transform 0.3s var(--ease-smooth); }
.news-expand-btn svg.rotated { transform: rotate(180deg); }

/* ===== 新闻面板 ===== */
.news-panel-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
}
.news-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  max-width: 430px;
  margin: 0 auto;
  background: var(--color-surface);
  border-radius: 20px 20px 0 0;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
}
.panel-slide-enter-active,
.panel-slide-leave-active { transition: all 0.35s var(--ease-out-expo); }
.panel-slide-enter-from { transform: translateY(100%); opacity: 0; }
.panel-slide-leave-to { transform: translateY(100%); opacity: 0; }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--color-separator);
}
.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}
.panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.panel-close:active { transform: scale(0.92); }

.panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.news-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 0.5px solid var(--color-separator);
}
.news-item:active { background: var(--color-surface-hover); }
.news-item:last-child { border-bottom: none; }

.news-item-time {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  width: 50px;
}
.news-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.news-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.news-item-source {
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.news-item-arrow { color: var(--color-text-tertiary); flex-shrink: 0; }

.panel-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}
.panel-spinner {
  width: 24px; height: 24px;
  border: 2.5px solid var(--color-surface-elevated);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 新闻详情 ===== */
.news-detail-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1200;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.news-detail {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 20px;
  max-width: 390px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
}
.detail-fade-enter-active,
.detail-fade-leave-active { transition: all 0.25s var(--ease-smooth); }
.detail-fade-enter-from, .detail-fade-leave-to { opacity: 0; }

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-source {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 2px 8px;
  border-radius: 4px;
}
.detail-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex: 1;
}
.detail-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
  cursor: pointer;
}
.detail-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 12px;
  line-height: 1.4;
}
.detail-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0 0 16px;
}
.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--color-accent-light);
}
.detail-disclaimer {
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin: 12px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--color-separator);
}
</style>

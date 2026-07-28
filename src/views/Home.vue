<script setup>
import { ref } from 'vue'

const quickStats = ref([
  { label: '今日任务', value: '12', icon: 'task' },
  { label: '已完成', value: '8', icon: 'check' },
  { label: '待处理', value: '4', icon: 'pending' },
  { label: '效率', value: '85%', icon: 'efficiency' }
])

const features = ref([
  { title: '智能助手', desc: 'AI驱动的智能助手', icon: 'ai', color: 'purple' },
  { title: '数据分析', desc: '实时数据洞察', icon: 'chart', color: 'blue' },
  { title: '团队协作', desc: '高效团队管理', icon: 'team', color: 'green' },
  { title: '云端存储', desc: '安全文件管理', icon: 'cloud', color: 'orange' }
])

const recentItems = ref([
  { title: '项目进度会议', time: '10:00', type: 'meeting' },
  { title: '产品需求评审', time: '14:30', type: 'review' },
  { title: '周报提交', time: '18:00', type: 'task' }
])
</script>

<template>
  <div class="home-page">
    <!-- 顶部装饰背景 -->
    <div class="header-bg">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
    </div>

    <!-- 欢迎卡片 -->
    <section class="welcome-card">
      <div class="card-glass">
        <div class="welcome-content">
          <div class="greeting">
            <span class="time-icon">☀️</span>
            <div class="greeting-text">
              <h1 class="welcome-title">早上好, Alex</h1>
              <p class="welcome-subtitle">今天是美好的一天，开始工作吧！</p>
            </div>
          </div>
          <button class="notification-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span class="notification-dot"></span>
          </button>
        </div>
      </div>
    </section>

    <!-- 快捷统计 -->
    <section class="quick-stats">
      <div class="stats-grid">
        <div v-for="(stat, index) in quickStats" :key="index" class="stat-card">
          <div class="stat-icon" :class="stat.icon">
            <svg v-if="stat.icon === 'task'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <svg v-else-if="stat.icon === 'check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <svg v-else-if="stat.icon === 'pending'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-else-if="stat.icon === 'efficiency'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </section>

    <!-- 功能模块 -->
    <section class="features-section">
      <h3 class="section-title">核心功能</h3>
      <div class="features-grid">
        <div 
          v-for="(feature, index) in features" 
          :key="index" 
          class="feature-card"
          :class="feature.color"
        >
          <div class="feature-icon">
            <svg v-if="feature.icon === 'ai'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <svg v-else-if="feature.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <svg v-else-if="feature.icon === 'team'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <svg v-else-if="feature.icon === 'cloud'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
          </div>
          <div class="feature-info">
            <h4 class="feature-title">{{ feature.title }}</h4>
            <p class="feature-desc">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 今日日程 -->
    <section class="schedule-section">
      <div class="section-header">
        <h3 class="section-title">今日日程</h3>
        <span class="view-all">查看全部</span>
      </div>
      <div class="schedule-card">
        <div 
          v-for="(item, index) in recentItems" 
          :key="index" 
          class="schedule-item"
        >
          <div class="time-badge">{{ item.time }}</div>
          <div class="schedule-content">
            <span class="schedule-title">{{ item.title }}</span>
            <span class="schedule-type" :class="item.type">{{ item.type === 'meeting' ? '会议' : item.type === 'review' ? '评审' : '任务' }}</span>
          </div>
          <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  background: linear-gradient(180deg, #f8f9ff 0%, #f0f2ff 100%);
  position: relative;
  padding-bottom: 100px;
}

/* 顶部装饰背景 */
.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 280px;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.header-bg::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(to bottom, transparent 0%, #f8f9ff 100%);
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-1 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #667eea 100%);
  top: -120px;
  right: -100px;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #f9a8d4 0%, #f472b6 50%, #ec4899 100%);
  top: -80px;
  left: -80px;
}

/* 欢迎卡片 */
.welcome-card {
  position: relative;
  z-index: 1;
  padding: 20px 16px 16px;
}

.card-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.greeting {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-icon {
  font-size: 40px;
}

.greeting-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.welcome-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.welcome-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.notification-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(102, 126, 234, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
}

.notification-btn:hover {
  background: rgba(102, 126, 234, 0.2);
}

.notification-btn svg {
  width: 20px;
  height: 20px;
  color: #667eea;
}

.notification-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
}

/* 快捷统计 */
.quick-stats {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.3s ease;
}

.stat-card:active {
  transform: scale(0.96);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 20px;
  height: 20px;
}

.stat-icon.task {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.check {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.stat-icon.pending {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.efficiency {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
}

.stat-label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

/* 功能模块 */
.features-section {
  padding: 0 16px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 12px 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.3s ease;
}

.feature-card:active {
  transform: scale(0.98);
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-icon svg {
  width: 24px;
  height: 24px;
}

.feature-card.purple .feature-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.feature-card.blue .feature-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.feature-card.green .feature-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.feature-card.orange .feature-icon {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
}

.feature-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.feature-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
}

/* 日程部分 */
.schedule-section {
  padding: 0 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 16px;
}

.section-header .section-title {
  margin: 0;
}

.view-all {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
  cursor: pointer;
}

.schedule-card {
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.schedule-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: all 0.3s ease;
}

.schedule-item:last-child {
  border-bottom: none;
}

.schedule-item:active {
  background: #f9fafb;
}

.time-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 10px;
  margin-right: 16px;
  flex-shrink: 0;
}

.schedule-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.schedule-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.schedule-type {
  font-size: 12px;
  color: #9ca3af;
}

.schedule-type.meeting {
  color: #667eea;
}

.schedule-type.review {
  color: #f093fb;
}

.schedule-type.task {
  color: #43e97b;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  color: #d1d5db;
  flex-shrink: 0;
  margin-left: 12px;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .home-page {
    background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
  }
  
  .card-glass {
    background: rgba(30, 30, 46, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .welcome-title {
    color: #f3f4f6;
  }
  
  .stat-card,
  .feature-card,
  .schedule-card {
    background: #1e1e2e;
  }
  
  .stat-value,
  .feature-title,
  .schedule-title {
    color: #f3f4f6;
  }
  
  .schedule-item {
    border-bottom-color: #2d2d44;
  }
  
  .schedule-item:active {
    background: #252538;
  }
  
  .notification-dot {
    border-color: #1e1e2e;
  }
}
</style>
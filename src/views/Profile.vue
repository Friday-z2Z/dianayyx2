<script setup>
import { ref, inject } from 'vue'

const navigateTo = inject('navigateTo')

const userInfo = ref({
  name: 'Alex Chen',
  avatar: '',
  level: 'Pro Member',
  id: 'ID: 8829-1024'
})

const quickActions = ref([
  { icon: 'wallet', title: '钱包', value: '¥2,580' },
  { icon: 'coupon', title: '卡券', value: '5张' },
  { icon: 'order', title: '订单', value: '12' },
  { icon: 'message', title: '消息', value: '3' }
])

const menuGroups = ref([
  {
    title: '我的服务',
    items: [
      { icon: 'magic', title: 'AI魔法棒', subtitle: '智能创作助手', badge: 'NEW', highlight: true },
      { icon: 'star', title: '我的收藏', badge: '12' },
      { icon: 'history', title: '浏览历史', badge: '' },
      { icon: 'download', title: '我的下载', badge: '' }
    ]
  },
  {
    title: '设置与帮助',
    items: [
      { icon: 'settings', title: '账号设置', badge: '' },
      { icon: 'shield', title: '隐私安全', badge: '' },
      { icon: 'help', title: '帮助中心', badge: '' },
      { icon: 'about', title: '关于我们', badge: '' }
    ]
  }
])

const handleMagicClick = () => {
  // 跳转到 AI 魔法棒页面
  navigateTo('magic-wand')
}
</script>

<template>
  <div class="profile-page">
    <!-- 顶部装饰背景 -->
    <div class="header-bg">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
    </div>

    <!-- 用户信息卡片 -->
    <section class="user-card">
      <div class="card-glass">
        <div class="user-main">
          <div class="avatar-wrapper">
            <div class="avatar-ring">
              <div class="avatar-inner">
                <span class="avatar-text">{{ userInfo.name.charAt(0) }}</span>
              </div>
            </div>
            <div class="online-status"></div>
          </div>
          <div class="user-details">
            <div class="name-row">
              <h2 class="user-name">{{ userInfo.name }}</h2>
              <span class="vip-badge">
                <svg class="crown-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19A1 1 0 0 1 18 20H6A1 1 0 0 1 5 19V18H19V19Z"/>
                </svg>
                {{ userInfo.level }}
              </span>
            </div>
            <p class="user-id">{{ userInfo.id }}</p>
          </div>
        </div>
        <button class="edit-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </section>

    <!-- 快捷入口 -->
    <section class="quick-actions">
      <div class="actions-grid">
        <div v-for="(action, index) in quickActions" :key="index" class="action-item">
          <div class="action-icon-wrapper" :class="action.icon">
            <svg v-if="action.icon === 'wallet'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
            </svg>
            <svg v-else-if="action.icon === 'coupon'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <svg v-else-if="action.icon === 'order'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <svg v-else-if="action.icon === 'message'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <span class="action-title">{{ action.title }}</span>
          <span class="action-value">{{ action.value }}</span>
        </div>
      </div>
    </section>

    <!-- 菜单分组 -->
    <section v-for="(group, groupIndex) in menuGroups" :key="groupIndex" class="menu-group">
      <h3 class="group-title">{{ group.title }}</h3>
      <div class="menu-card">
        <div 
          v-for="(item, itemIndex) in group.items" 
          :key="itemIndex" 
          class="menu-item"
          :class="{ highlight: item.highlight }"
          @click="item.icon === 'magic' && handleMagicClick($event)"
        >
          <div class="item-icon" :class="item.icon">
            <!-- AI魔法棒图标 -->
            <svg v-if="item.icon === 'magic'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="magic-wand">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M8 13h2"/>
              <path d="M8 17h2"/>
              <path d="M14 13h2"/>
              <path d="M14 17h2"/>
              <path d="M10 10l-6 6"/>
              <path d="M4 16l2 2"/>
              <path d="M2 20l2-2"/>
            </svg>
            <svg v-else-if="item.icon === 'star'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <svg v-else-if="item.icon === 'history'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-else-if="item.icon === 'download'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24-4.24l-4.24 4.24M6.34 6.34l-4.24-4.24"/>
            </svg>
            <svg v-else-if="item.icon === 'shield'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <svg v-else-if="item.icon === 'help'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <svg v-else-if="item.icon === 'about'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </div>
          <div class="item-content">
            <span class="item-title">{{ item.title }}</span>
            <span v-if="item.subtitle" class="item-subtitle">{{ item.subtitle }}</span>
          </div>
          <div class="item-right">
            <span v-if="item.badge" class="item-badge" :class="{ new: item.badge === 'NEW' }">{{ item.badge }}</span>
            <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- 版本信息 -->
    <section class="version-section">
      <p class="version-text">Version 2.0.1</p>
      <button class="logout-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        退出登录
      </button>
    </section>
  </div>
</template>

<style scoped>
.profile-page {
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

/* 用户卡片 */
.user-card {
  position: relative;
  z-index: 1;
  padding: 20px 16px 16px;
}

.card-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.user-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-wrapper {
  position: relative;
}

.avatar-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 3px;
}

.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.online-status {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  background: #10b981;
  border-radius: 50%;
  border: 2px solid white;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-name {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.vip-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.crown-icon {
  width: 12px;
  height: 12px;
}

.user-id {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.edit-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(102, 126, 234, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.edit-btn:hover {
  background: rgba(102, 126, 234, 0.2);
}

.edit-btn svg {
  width: 18px;
  height: 18px;
  color: #667eea;
}

/* 快捷入口 */
.quick-actions {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  margin-bottom: 24px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.action-item {
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

.action-item:active {
  transform: scale(0.96);
}

.action-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon-wrapper svg {
  width: 22px;
  height: 22px;
}

.action-icon-wrapper.wallet {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-icon-wrapper.coupon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.action-icon-wrapper.order {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.action-icon-wrapper.message {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.action-title {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.action-value {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
}

/* 菜单分组 */
.menu-group {
  padding: 0 16px;
  margin-bottom: 20px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 12px 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
}

.menu-card {
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 1px solid #f3f4f6;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: #f9fafb;
}

.menu-item.highlight {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.menu-item.highlight .item-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0); }
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
  color: #6b7280;
  flex-shrink: 0;
}

.item-icon svg {
  width: 20px;
  height: 20px;
}

.item-icon .magic-wand {
  animation: wand-wave 2s ease-in-out infinite;
}

@keyframes wand-wave {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  height: 40px;
}

.item-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  text-align: left;
}

.item-subtitle {
  font-size: 12px;
  color: #9ca3af;
  text-align: left;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.item-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  background: #e5e7eb;
  color: #6b7280;
  flex-shrink: 0;
}

.item-badge.new {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  color: #d1d5db;
  flex-shrink: 0;
}

/* 版本信息 */
.version-section {
  padding: 0 16px;
  text-align: center;
}

.version-text {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.logout-btn {
  width: 100%;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  color: #ef4444;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.logout-btn:active {
  background: #fef2f2;
  transform: scale(0.98);
}

.logout-btn svg {
  width: 18px;
  height: 18px;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .profile-page {
    background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
  }
  
  .card-glass {
    background: rgba(30, 30, 46, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .user-name {
    color: #f3f4f6;
  }
  
  .action-item,
  .menu-card,
  .logout-btn {
    background: #1e1e2e;
  }
  
  .action-value,
  .item-title {
    color: #f3f4f6;
  }
  
  .menu-item {
    border-bottom-color: #2d2d44;
  }
  
  .menu-item:active {
    background: #252538;
  }
  
  .item-icon {
    background: #2d2d44;
    color: #9ca3af;
  }
  
  .group-title {
    color: #9ca3af;
  }
}
</style>
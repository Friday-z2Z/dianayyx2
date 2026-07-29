<script setup>
defineProps({
  activeTab: {
    type: String,
    default: 'home'
  }
})

const emit = defineEmits(['change'])

const tabs = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'profile', label: '我的', icon: 'user' }
]

const handleTabClick = (tabId) => {
  emit('change', tabId)
}
</script>

<template>
  <nav class="tab-bar">
    <div class="tab-bar-inner">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="handleTabClick(tab.id)"
      >
        <div class="tab-icon-wrapper">
          <svg v-if="tab.icon === 'home'" class="tab-icon" viewBox="0 0 24 24" fill="none">
            <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20V9.5z" 
                  :fill="activeTab === 'home' ? 'currentColor' : 'none'" 
                  stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path v-if="activeTab === 'home'" d="M9 21.5V14h6v7.5" stroke="var(--color-bg)" stroke-width="1.5" stroke-linejoin="round"/>
            <path v-else d="M9 21V14.5h6V21" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="tab.icon === 'user'" class="tab-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" 
                    :fill="activeTab === 'profile' ? 'currentColor' : 'none'" 
                    stroke="currentColor" stroke-width="1.5"/>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" 
                  :fill="activeTab === 'profile' ? 'currentColor' : 'none'" 
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding-bottom: var(--safe-bottom);
}

.tab-bar-inner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: var(--tab-bar-height);
  max-width: 430px;
  margin: 0 auto;
  background: var(--color-surface);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-top: 0.5px solid var(--color-separator);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: color var(--duration-fast) var(--ease-smooth);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.tab-item.active {
  color: var(--color-accent);
}

.tab-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  margin-bottom: 2px;
}

.tab-icon {
  width: 26px;
  height: 26px;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.tab-item:active .tab-icon {
  transform: scale(0.85);
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
}
</style>

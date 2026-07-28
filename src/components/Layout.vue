<script setup>
import { ref, provide } from 'vue'
import TabBar from './TabBar.vue'
import Home from '../views/Home.vue'
import Profile from '../views/Profile.vue'
import MagicWand from '../views/MagicWand.vue'

const activeTab = ref('home')
const currentPage = ref('main') // 'main', 'magic-wand'

const handleTabChange = (tabId) => {
  activeTab.value = tabId
}

const navigateTo = (page) => {
  currentPage.value = page
}

// 提供导航方法给子组件
provide('navigateTo', navigateTo)
provide('goBack', () => {
  currentPage.value = 'main'
})
</script>

<template>
  <div class="layout">
    <!-- 主内容区域 -->
    <main class="main-content">
      <transition name="fade" mode="out-in">
        <!-- 主页面 -->
        <div v-if="currentPage === 'main'" key="main" class="page-wrapper">
          <transition name="fade" mode="out-in">
            <Home v-if="activeTab === 'home'" key="home" />
            <Profile v-else-if="activeTab === 'profile'" key="profile" />
          </transition>
          <TabBar :active-tab="activeTab" @change="handleTabChange" />
        </div>
        
        <!-- AI魔法棒页面 -->
        <MagicWand v-else-if="currentPage === 'magic-wand'" key="magic-wand" />
      </transition>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.page-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
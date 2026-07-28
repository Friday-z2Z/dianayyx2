<script setup>
import { ref, inject } from 'vue'
import { showDialog, showConfirmDialog, showToast } from 'vant'
import 'vant/lib/index.css'
import FireworkEffect from '../components/FireworkEffect.vue'
import TextFireworkEffect from '../components/TextFireworkEffect.vue'
import LoveEffect from '../components/LoveEffect.vue'

const goBack = inject('goBack')

const fireworkRef = ref(null)
const textFireworkRef = ref(null)
const loveRef = ref(null)
const showFirework = ref(false)
const showTextFirework = ref(false)
const showWeekends = ref(false)
const showLove = ref(false)

const effects = ref([
  {
    id: 'firework',
    title: '绚丽烟花',
    desc: '点击屏幕绽放美丽烟花',
    icon: 'firework',
    color: 'purple'
  },
  {
    id: 'blessing',
    title: '祝福卡片',
    desc: '文字烟花表达心意',
    icon: 'blessing',
    color: 'rose'
  },
  {
    id: 'weekends',
    title: '周末约吗',
    desc: '一起出去玩吧',
    icon: 'weekends',
    color: 'orange'
  },
  {
    id: 'love',
    title: '爱你',
    desc: '浪漫爱心动画',
    icon: 'love',
    color: 'red'
  }
])

const textArr = [
  '你怎么能拒绝呀，心好痛',
  '真的不想一起出去嘛？',
  '你是不是点错了呀？',
  '再好好想想~',
  '真的要这么残忍吗？',
  '应该还会有更好的选择吧，emmmmm',
  '一起出去很愉快的呀',
  '不公平，绝对不公平！',
  '你超级漂亮可爱的呀',
  '我想一定是有什么隐情',
  '是我做的不够好吗？',
  '我错了，还是选同意吧，呜呜呜'
]

const handleEffectClick = (effect) => {
  if (effect.id === 'firework') {
    showFirework.value = true
  } else if (effect.id === 'blessing') {
    showTextFirework.value = true
  } else if (effect.id === 'weekends') {
    showWeekends.value = true
  } else if (effect.id === 'love') {
    showLove.value = true
  }
}

const closeFirework = () => {
  showFirework.value = false
}

const closeTextFirework = () => {
  showTextFirework.value = false
}

const closeWeekends = () => {
  showWeekends.value = false
}

const closeLove = () => {
  showLove.value = false
}

const handleRefuse = () => {
  const index = Math.floor(Math.random() * textArr.length)
  showConfirmDialog({
    title: '提示',
    message: textArr[index],
    showCancelButton: true,
    confirmButtonText: '不去',
    cancelButtonText: '我点错了'
  }).then(() => {
    // 用户点击了"不去"（拒绝），继续循环
    setTimeout(handleRefuse, 300)
  }).catch(() => {
    // 用户点击"我点错了"或关闭对话框
  })
}

const handleConfirm = () => {
  showDialog({
    title: '太棒了！',
    message: '那就愉快的决定啦！',
    showCancelButton: false,
    confirmButtonText: '好的'
  }).then(() => {
    closeWeekends()
  })
}

const handleFireworkLayerClick = (event) => {
  if (fireworkRef.value) {
    fireworkRef.value.launchFirework(event.clientX, event.clientY)
  }
}

const handleGoBack = () => {
  goBack()
}
</script>

<template>
  <div class="magic-wand-page">
    <!-- 烟花效果层 -->
    <div v-if="showFirework" class="firework-layer" @click="handleFireworkLayerClick">
      <FireworkEffect ref="fireworkRef" :auto-start="true" />
      <div class="firework-hint" @click.stop>
        <span>✨ 点击屏幕任意位置继续放烟花</span>
        <button class="close-btn" @click="closeFirework">退出</button>
      </div>
    </div>

    <!-- 文字烟花效果层 -->
    <div v-if="showTextFirework" class="firework-layer text-firework-layer" @click="closeTextFirework">
      <TextFireworkEffect ref="textFireworkRef" :auto-start="true" />
      <div class="firework-hint" @click.stop>
        <span>💕 文字烟花 - 点击屏幕退出</span>
        <button class="close-btn" @click="closeTextFirework">退出</button>
      </div>
    </div>

    <!-- 周末约吗功能层 -->
    <div v-if="showWeekends" class="weekends-layer">
      <div class="weekends-content">
        <h1 class="weekends-title">周末一起出去呀</h1>
        <div class="weekends-buttons">
          <button class="weekends-btn refuse" @click="handleRefuse">拒绝</button>
          <button class="weekends-btn confirm" @click="handleConfirm">同意</button>
        </div>
      </div>
      <button class="close-btn weekends-close" @click="closeWeekends">退出</button>
    </div>

    <!-- 爱你功能层 -->
    <div v-if="showLove" class="love-layer" @click="closeLove">
      <LoveEffect ref="loveRef" :auto-start="true" />
      <div class="love-hint" @click.stop>
        <span>❤️ 爱你 - 点击屏幕退出</span>
        <button class="close-btn" @click="closeLove">退出</button>
      </div>
    </div>

    <!-- 顶部装饰背景 -->
    <div class="header-bg">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
    </div>

    <!-- 顶部导航 -->
    <header class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-title">AI 魔法棒</h1>
      <div class="header-placeholder"></div>
    </header>

    <!-- 欢迎卡片 -->
    <section class="welcome-section">
      <div class="magic-card">
        <div class="magic-icon-wrapper">
          <svg class="magic-wand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
        </div>
        <div class="magic-info">
          <h2 class="magic-title">智能创作助手</h2>
          <p class="magic-desc">选择下方特效，开启魔法之旅</p>
        </div>
      </div>
    </section>

    <!-- 特效选择 -->
    <section class="effects-section">
      <h3 class="section-title">选择特效</h3>
      <div class="effects-grid">
        <div 
          v-for="effect in effects" 
          :key="effect.id"
          class="effect-card"
          :class="effect.color"
          @click="handleEffectClick(effect)"
        >
          <div class="effect-icon">
            <svg v-if="effect.icon === 'firework'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L12 6"/>
              <path d="M12 18L12 22"/>
              <path d="M4.93 4.93L7.76 7.76"/>
              <path d="M16.24 16.24L19.07 19.07"/>
              <path d="M2 12L6 12"/>
              <path d="M18 12L22 12"/>
              <path d="M4.93 19.07L7.76 16.24"/>
              <path d="M16.24 7.76L19.07 4.93"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else-if="effect.icon === 'blessing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg v-else-if="effect.icon === 'weekends'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
              <path d="M8 2v4"/>
              <path d="M16 2v4"/>
              <path d="M2 12h4"/>
              <path d="M18 12h4"/>
            </svg>
            <svg v-else-if="effect.icon === 'love'" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <div class="effect-info">
            <h4 class="effect-name">{{ effect.title }}</h4>
            <p class="effect-desc">{{ effect.desc }}</p>
          </div>
          <div class="effect-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.magic-wand-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8f9ff 0%, #f0f2ff 100%);
  position: relative;
  padding-bottom: 100px;
}

/* 烟花效果层 */
.firework-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  cursor: pointer;
}

.text-firework-layer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.firework-hint {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  font-size: 14px;
  animation: fadeInUp 0.5s ease;
  white-space: nowrap;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.close-btn {
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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

/* 顶部导航 */
.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  padding-top: 50px;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.back-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.05);
}

.back-btn svg {
  width: 20px;
  height: 20px;
  color: #1a1a2e;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.header-placeholder {
  width: 40px;
}

/* 欢迎卡片 */
.welcome-section {
  position: relative;
  z-index: 1;
  padding: 0 16px 24px;
}

.magic-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.magic-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(102, 126, 234, 0); }
}

.magic-wand-icon {
  width: 32px;
  height: 32px;
  color: white;
  animation: wand-wave 2s ease-in-out infinite;
}

@keyframes wand-wave {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
}

.magic-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.magic-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.magic-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* 特效选择 */
.effects-section {
  position: relative;
  z-index: 1;
  padding: 0 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 16px 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.effects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.effect-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.effect-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end));
}

.effect-card:active {
  transform: scale(0.98);
}

.effect-card.purple {
  --gradient-start: #667eea;
  --gradient-end: #764ba2;
}

.effect-card.rose {
  --gradient-start: #ff9ff3;
  --gradient-end: #f368e0;
}

.effect-card.orange {
  --gradient-start: #ffa502;
  --gradient-end: #ff6348;
}

.effect-card.red {
  --gradient-start: #ff4757;
  --gradient-end: #ff6348;
}

.effect-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.effect-icon svg {
  width: 28px;
  height: 28px;
}

.effect-card.purple .effect-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.effect-card.rose .effect-icon {
  background: linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%);
  color: white;
}

.effect-card.orange .effect-icon {
  background: linear-gradient(135deg, #ffa502 0%, #ff6348 100%);
  color: white;
}

.effect-card.red .effect-icon {
  background: linear-gradient(135deg, #ff4757 0%, #ff6348 100%);
  color: white;
}

.effect-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.effect-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.effect-desc {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
}

.effect-arrow {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s ease;
}

.effect-card:hover .effect-arrow {
  opacity: 1;
}

.effect-arrow svg {
  width: 14px;
  height: 14px;
  color: #6b7280;
}

/* 周末约吗功能样式 */
.weekends-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.weekends-content {
  text-align: center;
}

.weekends-title {
  font-size: 28px;
  font-weight: 700;
  color: #5d4037;
  margin-bottom: 60px;
  text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.5);
}

.weekends-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.weekends-btn {
  padding: 16px 40px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.weekends-btn.refuse {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
}

.weekends-btn.refuse:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(238, 90, 90, 0.4);
}

.weekends-btn.confirm {
  background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
  color: white;
}

.weekends-btn.confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(64, 192, 87, 0.4);
}

.weekends-close {
  position: absolute;
  bottom: 60px;
  background: rgba(93, 64, 55, 0.2) !important;
  border: 1px solid rgba(93, 64, 55, 0.3) !important;
  color: #5d4037 !important;
}

.weekends-close:hover {
  background: rgba(93, 64, 55, 0.3) !important;
}

/* 爱你功能样式 */
.love-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  cursor: pointer;
}

.love-hint {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  font-size: 14px;
  animation: fadeInUp 0.5s ease;
  white-space: nowrap;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .magic-wand-page {
    background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
  }
  
  .magic-card,
  .effect-card {
    background: #1e1e2e;
  }
  
  .page-title,
  .magic-title,
  .effect-name {
    color: #f3f4f6;
  }
  
  .back-btn {
    background: rgba(30, 30, 46, 0.8);
  }
  
  .back-btn svg {
    color: #f3f4f6;
  }
  
  .effect-arrow {
    background: #2d2d44;
  }
  
  .effect-arrow svg {
    color: #9ca3af;
  }
}
</style>
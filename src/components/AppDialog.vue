<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showCancel: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:show'])

const handleConfirm = () => {
  emit('confirm')
  emit('update:show', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}

const handleOverlayClick = () => {
  emit('cancel')
  emit('update:show', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="show" class="dialog-overlay" @click="handleOverlayClick">
        <div class="dialog-container" @click.stop>
          <div class="dialog-content">
            <h3 v-if="title" class="dialog-title">{{ title }}</h3>
            <p class="dialog-message">{{ message }}</p>
          </div>
          <div class="dialog-footer">
            <button v-if="showCancel" class="dialog-btn cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="dialog-btn confirm" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
}

.dialog-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-content {
  padding: 24px 20px;
  text-align: center;
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 12px 0;
}

.dialog-message {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

.dialog-footer {
  display: flex;
  border-top: 1px solid #f0f0f0;
}

.dialog-btn {
  flex: 1;
  padding: 16px;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-btn.cancel {
  color: #6b7280;
  border-right: 1px solid #f0f0f0;
}

.dialog-btn.cancel:hover {
  background: #f9fafb;
}

.dialog-btn.confirm {
  color: #667eea;
  font-weight: 600;
}

.dialog-btn.confirm:hover {
  background: #f0f2ff;
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-container,
.dialog-fade-leave-to .dialog-container {
  transform: scale(0.9) translateY(20px);
}

.dialog-fade-enter-active .dialog-container,
.dialog-fade-leave-active .dialog-container {
  transition: all 0.3s ease;
}
</style>
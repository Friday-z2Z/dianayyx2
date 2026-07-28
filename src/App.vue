<script setup>
import Layout from './components/Layout.vue'
</script>

<template>
  <Layout />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg);
  position: relative;
}

/* 滚动条样式优化 */
::-webkit-scrollbar {
  width: 0;
  height: 0;
}
</style>
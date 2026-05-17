<template>
  <div class="app">
    <RouterView />
    <Transition name="toast">
      <div v-if="state.toast.visible" :class="['toast', state.toast.type]">
        {{ state.toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useGame } from './composables/useGame.js'
const { state } = useGame()
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --felt: #1a4a2e;
  --felt-light: #245c38;
  --gold: #f1c40f;
  --gold-dark: #c9a80d;
  --card-red: #c0392b;
  --card-black: #1a1a1a;
  --text: #f0ece0;
  --text-muted: #9e9e7a;
  --panel: rgba(0,0,0,0.25);
  --radius: 8px;
}

body {
  font-family: 'Inter', sans-serif;
  background: var(--felt);
  color: var(--text);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  position: relative;
}

.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.toast.error   { background: #c0392b; color: #fff; }
.toast.success { background: #27ae60; color: #fff; }
.toast.info    { background: #2980b9; color: #fff; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>

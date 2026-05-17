<template>
  <div class="game-log">
    <div class="log-title">Game Log</div>
    <div class="log-entries" ref="logEl">
      <div v-for="(entry, i) in logs" :key="i" :class="['log-entry', 'log-' + entry.type]">
        <span class="log-time">{{ entry.time }}</span>
        <span class="log-msg">{{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  logs: { type: Array, default: () => [] },
})

const logEl = ref(null)

watch(() => props.logs.length, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})
</script>

<style scoped>
.game-log {
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,0.3);
  border-radius: var(--radius);
  overflow: hidden;
  height: 100%;
}
.log-title {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-entry {
  display: flex;
  gap: 6px;
  font-size: 12px;
  line-height: 1.4;
}
.log-time { color: var(--text-muted); flex-shrink: 0; }
.log-msg { color: var(--text); }
.log-system .log-msg { color: #f1c40f; }
.log-error .log-msg  { color: #e74c3c; }
.log-success .log-msg { color: #2ecc71; }
</style>

<template>
  <div class="meld-group">
    <div class="meld-cards">
      <CardComponent v-for="card in meld.cards" :key="card.id" :card="card" />
    </div>
    <div class="meld-label">
      <span class="meld-owner">{{ ownerName }}</span>
      <span class="meld-type">{{ meld.type }}</span>
      <button v-if="canExtend" class="extend-btn" @click="$emit('extend', meld.id)">+ Add</button>
    </div>
  </div>
</template>

<script setup>
import CardComponent from './CardComponent.vue'

defineProps({
  meld: { type: Object, required: true },
  canExtend: { type: Boolean, default: false },
  ownerName: { type: String, default: '' },
})

defineEmits(['extend'])
</script>

<style scoped>
.meld-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.meld-cards {
  display: flex;
  gap: -8px;
}
.meld-cards > * + * { margin-left: -16px; }
.meld-label {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  padding-left: 2px;
}
.meld-type {
  background: rgba(255,255,255,0.1);
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  font-size: 10px;
}
.extend-btn {
  background: var(--gold);
  color: #1a1a1a;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.extend-btn:hover { background: var(--gold-dark); }
</style>

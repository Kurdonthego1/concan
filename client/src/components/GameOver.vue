<template>
  <div class="game-over-overlay">
    <div class="game-over-card">
      <div class="winner-title">🏆 {{ winnerName }} wins!</div>
      <div class="scores">
        <div class="scores-title">Final Scores</div>
        <div v-for="s in sortedScores" :key="s.name" class="score-row">
          <span class="score-name">{{ s.name }}</span>
          <span class="score-val" :class="{ winner: s.score === 0 }">{{ s.score }} pts</span>
        </div>
      </div>
      <button class="back-btn" @click="$emit('play-again')">Back to Lobby</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  scores: { type: Array, default: () => [] },
  winnerName: { type: String, default: '' },
})

defineEmits(['play-again'])

const sortedScores = computed(() =>
  [...props.scores].sort((a, b) => a.score - b.score)
)
</script>

<style scoped>
.game-over-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.game-over-card {
  background: #1e3a28;
  border: 2px solid var(--gold);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.winner-title {
  font-family: 'Playfair Display', serif;
  font-size: 28px;
  color: var(--gold);
}
.scores-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.score-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  font-size: 14px;
}
.score-val { font-weight: 600; }
.score-val.winner { color: #2ecc71; }
.back-btn {
  background: var(--gold);
  color: #1a1a1a;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.back-btn:hover { background: var(--gold-dark); }
</style>

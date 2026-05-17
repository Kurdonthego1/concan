<template>
  <div class="player-bar">
    <div
      v-for="(player, i) in players"
      :key="player.id"
      :class="['player-chip', { active: i === currentPlayerIndex, me: player.id === myPlayerId }]"
    >
      <span class="player-name">{{ player.name }}</span>
      <span class="player-cards">🂠 {{ player.handSize }}</span>
      <span class="player-score">{{ player.hasOpened ? player.openValue + 'pts' : 'Closed' }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  players: { type: Array, default: () => [] },
  currentPlayerIndex: { type: Number, default: 0 },
  myPlayerId: { type: String, default: '' },
})
</script>

<style scoped>
.player-bar {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0,0,0,0.3);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-wrap: wrap;
}
.player-chip {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--panel);
  border: 2px solid transparent;
  font-size: 13px;
  transition: border-color 0.2s;
}
.player-chip.active {
  border-color: #27ae60;
  box-shadow: 0 0 8px rgba(39,174,96,0.4);
}
.player-chip.me .player-name { text-decoration: underline; }
.player-name { font-weight: 600; }
.player-cards { color: var(--text-muted); font-size: 12px; }
.player-score {
  font-size: 11px;
  background: rgba(255,255,255,0.1);
  padding: 1px 6px;
  border-radius: 10px;
}
</style>

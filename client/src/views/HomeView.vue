<template>
  <div class="home">
    <h1 class="title">CONCAN</h1>

    <!-- Create / Join panels -->
    <div v-if="!state.roomId" class="panels">
      <!-- Create -->
      <div class="panel">
        <h2>Create Game</h2>
        <div class="field">
          <label>Your Name</label>
          <input v-model="createName" placeholder="Enter name" maxlength="20" @keydown.enter="onCreate" />
        </div>
        <div class="field toggle-field">
          <label>
            Competitive mode
            <span class="tooltip" title="Each opener must beat the previous player's meld value">ⓘ</span>
          </label>
          <input type="checkbox" v-model="competitive" />
        </div>
        <div class="field toggle-field">
          <label>Team mode (2v2)</label>
          <input type="checkbox" v-model="teamMode" />
        </div>
        <button class="btn primary" :disabled="creating" @click="onCreate">
          {{ creating ? 'Creating...' : 'Create Game' }}
        </button>
      </div>

      <!-- Join -->
      <div class="panel">
        <h2>Join Game</h2>
        <div class="field">
          <label>Your Name</label>
          <input v-model="joinName" placeholder="Enter name" maxlength="20" @keydown.enter="onJoin" />
        </div>
        <div class="field">
          <label>Room Code</label>
          <input v-model="joinCode" placeholder="XXXXXX" maxlength="6" class="code-input"
            @input="joinCode = joinCode.toUpperCase()" @keydown.enter="onJoin" />
        </div>
        <button class="btn primary" :disabled="joining" @click="onJoin">
          {{ joining ? 'Joining...' : 'Join Game' }}
        </button>
      </div>
    </div>

    <!-- Lobby -->
    <div v-else class="lobby">
      <div class="room-code-block">
        <div class="room-code-label">Room Code</div>
        <div class="room-code" :class="{ copied }" @click="copyCode">
          {{ state.roomId }}
          <span class="copy-hint">{{ copied ? 'Copied!' : 'Click to copy' }}</span>
        </div>
      </div>

      <div class="player-list">
        <div v-for="(p, i) in state.lobbyPlayers" :key="p.id" class="lobby-player">
          <span>{{ p.name }}</span>
          <span v-if="p.isHost" class="host-badge">HOST</span>
        </div>
      </div>

      <p v-if="!state.isHost" class="waiting-text">Waiting for the host to start...</p>
      <p v-else-if="state.lobbyPlayers.length < 2" class="waiting-text">
        Waiting for players... ({{ state.lobbyPlayers.length }}/2 minimum)
      </p>
      <button v-if="state.isHost && state.lobbyPlayers.length >= 2" class="btn primary" @click="onStart">
        Start Game
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGame } from '../composables/useGame.js'

const router = useRouter()
const { state, createRoom, joinRoom, startGame, registerLobbyListeners } = useGame()

const createName = ref('')
const joinName = ref('')
const joinCode = ref('')
const competitive = ref(false)
const teamMode = ref(false)
const creating = ref(false)
const joining = ref(false)
const copied = ref(false)

registerLobbyListeners(router)

async function onCreate() {
  if (!createName.value.trim()) return
  creating.value = true
  try {
    await createRoom(createName.value.trim(), { competitive: competitive.value, teamMode: teamMode.value })
    sessionStorage.setItem('playerName', createName.value.trim())
  } finally {
    creating.value = false
  }
}

async function onJoin() {
  if (!joinName.value.trim() || joinCode.value.length !== 6) return
  joining.value = true
  try {
    await joinRoom(joinCode.value, joinName.value.trim())
    sessionStorage.setItem('playerName', joinName.value.trim())
  } finally {
    joining.value = false
  }
}

function onStart() {
  startGame()
}

function copyCode() {
  navigator.clipboard.writeText(state.roomId).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 40px;
}

.title {
  font-family: 'Playfair Display', serif;
  font-size: 56px;
  color: var(--gold);
  letter-spacing: 0.12em;
  text-shadow: 0 2px 12px rgba(0,0,0,0.4);
}

.panels {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.panel {
  background: var(--panel);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 28px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--gold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.toggle-field {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

input[type="text"], input:not([type="checkbox"]) {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 14px;
  outline: none;
  width: 100%;
}
input:focus { border-color: var(--gold); }

.code-input {
  font-family: monospace;
  font-size: 18px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.tooltip {
  cursor: help;
  color: var(--text-muted);
  font-size: 13px;
  margin-left: 4px;
}

.btn {
  padding: 11px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn.primary { background: var(--gold); color: #1a1a1a; }
.btn.primary:hover:not(:disabled) { background: var(--gold-dark); }
.btn:disabled { opacity: 0.5; cursor: default; }

/* Lobby */
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 400px;
}

.room-code-block { text-align: center; }
.room-code-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
.room-code {
  font-family: monospace;
  font-size: 36px;
  letter-spacing: 0.2em;
  color: var(--gold);
  cursor: pointer;
  position: relative;
  padding-bottom: 4px;
}
.copy-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: normal;
  font-family: 'Inter', sans-serif;
  margin-top: 4px;
}
.room-code.copied { color: #2ecc71; }

.player-list {
  width: 100%;
  background: var(--panel);
  border-radius: 10px;
  overflow: hidden;
}
.lobby-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 14px;
}
.lobby-player:last-child { border-bottom: none; }
.host-badge {
  font-size: 10px;
  background: var(--gold);
  color: #1a1a1a;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.waiting-text { color: var(--text-muted); font-size: 14px; }
</style>

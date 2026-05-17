<template>
  <div class="game-view">
    <!-- Top bar -->
    <PlayerBar
      :players="state.publicState?.players || []"
      :currentPlayerIndex="state.publicState?.currentPlayerIndex ?? 0"
      :myPlayerId="state.myPlayerId"
    />

    <!-- Main area -->
    <div class="game-body">
      <!-- Table -->
      <div class="table-area">
        <!-- Phase indicator -->
        <div class="phase-bar">
          <span :class="['phase-pill', state.turnPhase]">
            {{ phaseLabel }}
          </span>
          <span v-if="jokerText" class="joker-info">🃏 {{ jokerText }}</span>
          <span class="deck-info">Deck: {{ state.publicState?.deckSize ?? '?' }}</span>
        </div>

        <!-- Piles row -->
        <div class="piles-row">
          <!-- Draw pile -->
          <div class="pile-block">
            <div
              :class="['pile', 'draw-pile', { clickable: state.isMyTurn && state.turnPhase === 'draw' }]"
              @click="onDrawFromDeck"
            >
              <CardComponent
                v-if="(state.publicState?.deckSize ?? 0) > 0"
                :card="{ id:'back', suit:'spades', value:2, display:'', isWild:false }"
                :faceDown="true"
              />
              <div v-else class="empty-pile">Empty</div>
            </div>
            <div class="pile-label">Draw Pile</div>
          </div>

          <!-- Discard pile -->
          <div class="pile-block">
            <div
              :class="['pile', 'discard-pile', { clickable: state.isMyTurn && state.turnPhase === 'draw' && !!state.publicState?.discardTop }]"
              @click="onDrawFromDiscard"
            >
              <CardComponent
                v-if="state.publicState?.discardTop"
                :card="state.publicState.discardTop"
              />
              <div v-else class="empty-pile">Empty</div>
            </div>
            <div class="pile-label">Discard</div>
          </div>
        </div>

        <!-- Table melds -->
        <div class="melds-area">
          <MeldGroup
            v-for="meld in state.publicState?.tableGroups || []"
            :key="meld.id"
            :meld="meld"
            :ownerName="ownerName(meld.ownerId)"
            :canExtend="canExtendMeld"
            @extend="onExtendMeld"
          />
          <div v-if="!state.publicState?.tableGroups?.length" class="no-melds">
            No melds on the table yet
          </div>
        </div>

        <!-- Action buttons -->
        <div v-if="state.turnPhase === 'act'" class="action-bar">
          <button
            class="btn-action"
            :disabled="state.selectedIndices.size < 3"
            @click="onPlaceMeld"
          >
            Place Meld ({{ state.selectedIndices.size }} selected)
          </button>
          <button
            class="btn-action discard"
            :disabled="state.selectedIndices.size !== 1"
            @click="onDiscard"
          >
            Discard
          </button>
        </div>
      </div>

      <!-- Log sidebar -->
      <div class="sidebar">
        <GameLog :logs="state.gameLog" />
      </div>
    </div>

    <!-- Hand -->
    <div class="hand-area">
      <div class="hand-label">Your Hand ({{ state.myHand.length }} cards)</div>
      <div class="hand-cards">
        <CardComponent
          v-for="(card, i) in state.myHand"
          :key="card.id"
          :card="card"
          :selected="state.selectedIndices.has(i)"
          :disabled="state.turnPhase !== 'act'"
          @click="toggleCard(i)"
        />
      </div>
    </div>

    <!-- Game over overlay -->
    <GameOver
      v-if="state.publicState?.phase === 'ended'"
      :scores="state.publicState?._scores || []"
      :winnerName="state.publicState?.winnerName || ''"
      @play-again="goHome"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGame } from '../composables/useGame.js'
import CardComponent from '../components/CardComponent.vue'
import MeldGroup from '../components/MeldGroup.vue'
import PlayerBar from '../components/PlayerBar.vue'
import GameLog from '../components/GameLog.vue'
import GameOver from '../components/GameOver.vue'

const router = useRouter()
const { state, drawCard, placeMelds, discardCard, registerGameListeners, rejoinRoom } = useGame()

registerGameListeners()

// Rejoin on page refresh
const savedName = sessionStorage.getItem('playerName') || ''
if (!state.publicState && state.roomId && savedName) {
  rejoinRoom(state.roomId, savedName)
}

const phaseLabel = computed(() => {
  if (!state.isMyTurn) return "Waiting for other player..."
  if (state.turnPhase === 'draw') return "Your turn — Draw a card"
  if (state.turnPhase === 'act')  return "Your turn — Place melds or Discard"
  return ''
})

const jokerText = computed(() => {
  const ji = state.publicState?.jokerInfo
  if (!ji?.specialAceActive || !ji.jokerSuit) return null
  return `Ace of ${ji.jokerSuit} is wild`
})

const canExtendMeld = computed(() =>
  state.isMyTurn &&
  state.turnPhase === 'act' &&
  state.selectedIndices.size >= 1 &&
  !!(state.publicState?.players?.find(p => p.id === state.myPlayerId)?.hasOpened)
)

function ownerName(ownerId) {
  return state.publicState?.players?.find(p => p.id === ownerId)?.name || ''
}

function toggleCard(i) {
  if (state.turnPhase !== 'act') return
  if (state.selectedIndices.has(i)) state.selectedIndices.delete(i)
  else state.selectedIndices.add(i)
}

function onDrawFromDeck() {
  if (!state.isMyTurn || state.turnPhase !== 'draw') return
  drawCard(false)
}

function onDrawFromDiscard() {
  if (!state.isMyTurn || state.turnPhase !== 'draw') return
  if (!state.publicState?.discardTop) return
  drawCard(true)
}

function onPlaceMeld() {
  if (state.selectedIndices.size < 3) return
  const indices = [...state.selectedIndices].sort((a, b) => a - b)
  placeMelds([indices], [null])
  state.selectedIndices.clear()
}

function onDiscard() {
  if (state.selectedIndices.size !== 1) return
  const index = [...state.selectedIndices][0]
  discardCard(index)
  state.selectedIndices.clear()
}

function onExtendMeld(meldId) {
  if (state.selectedIndices.size < 1) return
  const indices = [...state.selectedIndices].sort((a, b) => a - b)
  placeMelds([indices], [meldId])
  state.selectedIndices.clear()
}

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.game-view {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  overflow: hidden;
}

.game-body {
  display: grid;
  grid-template-columns: 1fr 240px;
  overflow: hidden;
  gap: 0;
}

.table-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  overflow-y: auto;
}

.sidebar {
  border-left: 1px solid rgba(255,255,255,0.07);
  overflow: hidden;
}

/* Phase bar */
.phase-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.phase-pill {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.phase-pill.draw { background: #2980b9; }
.phase-pill.act  { background: #27ae60; }
.phase-pill.wait { background: rgba(255,255,255,0.12); color: var(--text-muted); }

.joker-info {
  font-size: 12px;
  background: rgba(155,89,182,0.25);
  border: 1px solid rgba(155,89,182,0.4);
  padding: 3px 10px;
  border-radius: 10px;
  color: #d7a8f0;
}
.deck-info { font-size: 12px; color: var(--text-muted); margin-left: auto; }

/* Piles */
.piles-row { display: flex; gap: 20px; }
.pile-block { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pile {
  width: 80px;
  height: 114px;
  border-radius: 10px;
  border: 2px dashed rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: border-color 0.15s;
}
.pile.clickable { border-color: var(--gold); cursor: pointer; }
.pile.clickable:hover { border-color: #fff; box-shadow: 0 0 10px rgba(241,196,15,0.3); }
.pile-label { font-size: 11px; color: var(--text-muted); }
.empty-pile { font-size: 11px; color: var(--text-muted); }

/* Melds area */
.melds-area {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  background: rgba(0,0,0,0.15);
  border-radius: 10px;
  min-height: 130px;
}
.no-melds { color: var(--text-muted); font-size: 13px; align-self: center; margin: auto; }

/* Action bar */
.action-bar { display: flex; gap: 10px; }
.btn-action {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: var(--gold);
  color: #1a1a1a;
  transition: background 0.15s;
}
.btn-action:hover:not(:disabled) { background: var(--gold-dark); }
.btn-action:disabled { opacity: 0.4; cursor: default; }
.btn-action.discard { background: #c0392b; color: #fff; }
.btn-action.discard:hover:not(:disabled) { background: #e74c3c; }

/* Hand area */
.hand-area {
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.25);
  padding: 12px 16px;
}
.hand-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}
.hand-cards {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}
</style>

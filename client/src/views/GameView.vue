<template>
  <div class="game-view">
    <!-- Top bar -->
    <div class="top-bar">
      <PlayerBar
        :players="state.publicState?.players || []"
        :currentPlayerIndex="state.publicState?.currentPlayerIndex ?? 0"
        :myPlayerId="state.myPlayerId"
      />
      <button class="exit-btn" @click="onExit">✕ Leave</button>
    </div>

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
          <!-- Draw pile (auto-draws, display only) -->
          <div class="pile-block">
            <div class="pile draw-pile">
              <CardComponent
                v-if="(state.publicState?.deckSize ?? 0) > 0"
                :card="{ id:'back', suit:'spades', value:2, display:'', isWild:false }"
                :faceDown="true"
              />
              <div v-else class="empty-pile">Empty</div>
            </div>
            <div class="pile-label">Draw Pile (auto)</div>
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

        <!-- Pending melds staging area -->
        <div v-if="state.pendingMelds.length" class="pending-melds">
          <span class="pending-label">Staged melds:</span>
          <div v-for="(m, i) in state.pendingMelds" :key="i" class="pending-meld">
            <span v-for="c in m.cards" :key="c.id" class="pending-card">
              {{ c.display }}{{ suitSymbol(c.suit) }}
            </span>
            <button class="remove-btn" @click="removePendingMeld(i)">✕</button>
          </div>
          <span class="pending-value">Total: {{ pendingMeldsValue }} pts</span>
        </div>

        <!-- Action buttons -->
        <div v-if="state.turnPhase === 'act'" class="action-bar">
          <span v-if="state.selectedIndices.size > 0" class="selection-value">
            Selected: {{ selectedValue }} pts
          </span>
          <button
            class="btn-action"
            :disabled="state.selectedIndices.size < 3"
            @click="onStageMeld"
          >
            Stage Meld ({{ state.selectedIndices.size }} cards)
          </button>
          <button
            class="btn-action place-all"
            :disabled="state.pendingMelds.length === 0"
            @click="onPlaceAllMelds"
          >
            Place All ({{ state.pendingMelds.length }} meld{{ state.pendingMelds.length !== 1 ? 's' : '' }})
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
          :disabled="state.turnPhase !== 'act' || stagedIndices.value.has(i)"
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
const { state, drawCard, placeMelds, discardCard, registerGameListeners, rejoinRoom, leaveRoom } = useGame()

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
  if (stagedIndices.value.has(i)) return
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

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '🃏' }
function suitSymbol(suit) { return SUIT_SYMBOLS[suit] || '' }

function cardMeldValue(card) {
  if (!card) return 0
  const v = card.value
  return (v >= 11 || v === 14 || card.suit === 'joker') ? 10 : v
}

const selectedValue = computed(() =>
  [...state.selectedIndices].reduce((sum, i) => sum + cardMeldValue(state.myHand[i]), 0)
)

const stagedIndices = computed(() => new Set(state.pendingMelds.flatMap(m => m.indices)))

const pendingMeldsValue = computed(() =>
  state.pendingMelds.reduce((sum, m) =>
    sum + m.cards.reduce((s, c) => {
      const v = c.value
      return s + (v >= 11 || v === 14 || c.suit === 'joker' ? 10 : v)
    }, 0)
  , 0)
)

function onStageMeld() {
  if (state.selectedIndices.size < 3) return
  const indices = [...state.selectedIndices].sort((a, b) => a - b)
  const cards = indices.map(i => state.myHand[i])
  state.pendingMelds.push({ indices, cards })
  state.selectedIndices.clear()
}

function removePendingMeld(i) {
  state.pendingMelds.splice(i, 1)
}

function onPlaceAllMelds() {
  if (!state.pendingMelds.length) return
  const cardIndices = state.pendingMelds.map(m => m.indices)
  const meldIds = state.pendingMelds.map(() => null)

  // Adjust indices: after each meld is placed, remaining hand indices shift
  // Server handles this with the original hand, so send as-is
  placeMelds(cardIndices, meldIds)
  state.pendingMelds = []
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

function onExit() {
  if (confirm('Leave the game? You will be removed from the room.')) {
    leaveRoom()
    router.push('/')
  }
}
</script>

<style scoped>
.game-view {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  overflow: hidden;
}

.top-bar {
  display: flex;
  align-items: stretch;
}
.exit-btn {
  background: transparent;
  border: none;
  border-left: 1px solid rgba(255,255,255,0.08);
  color: var(--text-muted);
  padding: 0 16px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}
.exit-btn:hover { background: rgba(231,76,60,0.15); color: #e74c3c; }

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

/* Pending melds */
.pending-melds {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(241,196,15,0.1);
  border: 1px solid rgba(241,196,15,0.3);
  border-radius: 8px;
  font-size: 13px;
}
.pending-label { color: var(--gold); font-weight: 600; }
.pending-meld {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0,0,0,0.25);
  padding: 3px 8px;
  border-radius: 6px;
}
.pending-card { font-family: 'Georgia', serif; }
.remove-btn {
  background: none; border: none; color: #e74c3c;
  cursor: pointer; font-size: 11px; padding: 0 2px;
}
.pending-value { color: var(--text-muted); margin-left: auto; }

/* Action bar */
.action-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.selection-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--gold);
  background: rgba(241,196,15,0.12);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(241,196,15,0.3);
}
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
.btn-action.place-all { background: #27ae60; color: #fff; }
.btn-action.place-all:hover:not(:disabled) { background: #2ecc71; }

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

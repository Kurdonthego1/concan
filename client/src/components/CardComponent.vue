<template>
  <div
    :class="['card', suitColor, { selected, small, disabled, 'face-down': faceDown, wild: card.isWild }]"
    @click="onClick"
  >
    <template v-if="faceDown">
      <div class="card-back-pattern" />
    </template>
    <template v-else>
      <div class="card-corner top-left">
        <span class="card-value">{{ displayValue }}</span>
        <span class="card-suit-sm">{{ suitSymbol }}</span>
      </div>
      <div class="card-center">{{ suitSymbol }}</div>
      <div class="card-corner bottom-right">
        <span class="card-value">{{ displayValue }}</span>
        <span class="card-suit-sm">{{ suitSymbol }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, required: true },
  faceDown: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '🃏' }

const suitSymbol = computed(() => SUIT_SYMBOLS[props.card.suit] || '?')

const suitColor = computed(() => {
  if (props.card.suit === 'joker') return 'joker'
  return ['hearts', 'diamonds'].includes(props.card.suit) ? 'red' : 'black'
})

const displayValue = computed(() => {
  const v = props.card.value
  if (v === 15 || props.card.suit === 'joker') return '🃏'
  if (v === 14) return 'A'
  if (v === 13) return 'K'
  if (v === 12) return 'Q'
  if (v === 11) return 'J'
  return String(v)
})

function onClick() {
  if (!props.disabled && !props.faceDown) emit('click')
}
</script>

<style scoped>
.card {
  width: 70px;
  height: 100px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 6px rgba(0,0,0,0.35);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card.small { width: 50px; height: 72px; }
.card.selected { transform: translateY(-14px); border: 2px solid #f1c40f; }
.card.disabled { opacity: 0.5; cursor: default; }
.card.wild { border: 2px solid rgba(241,196,15,0.6); }

.card.red .card-corner,
.card.red .card-center { color: #c0392b; }
.card.black .card-corner,
.card.black .card-center { color: #1a1a1a; }

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  font-family: 'Georgia', serif;
}
.top-left { top: 4px; left: 5px; }
.bottom-right { bottom: 4px; right: 5px; transform: rotate(180deg); }

.card-value { font-size: 14px; font-weight: 700; }
.card-suit-sm { font-size: 10px; }
.card.small .card-value { font-size: 11px; }
.card.small .card-suit-sm { font-size: 8px; }

.card-center {
  font-size: 28px;
  line-height: 1;
  pointer-events: none;
}
.card.small .card-center { font-size: 20px; }

.card.joker .card-center {
  background: linear-gradient(135deg, #e74c3c, #f39c12, #2ecc71, #3498db, #9b59b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 32px;
}
.card.joker { border-color: #9b59b6; }

.card-back-pattern {
  width: 100%;
  height: 100%;
  border-radius: 7px;
  background: #1a237e;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.06) 0px,
    rgba(255,255,255,0.06) 2px,
    transparent 2px,
    transparent 8px
  );
}
.face-down { background: #1a237e; cursor: default; }
</style>

const { randomUUID } = require('crypto');

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const VALUE_DISPLAY = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const createDeck = () => {
  const cards = [];
  for (let deckNum = 1; deckNum <= 2; deckNum++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        const display = VALUE_DISPLAY[value] || String(value);
        cards.push({
          id: `deck${deckNum}_${suit}_${value}`,
          suit,
          value,
          display,
          isWild: false,
        });
      }
    }
    cards.push({
      id: `deck${deckNum}_joker`,
      suit: 'joker',
      value: 15,
      display: '🃏',
      isWild: true,
    });
  }
  return shuffleDeck(cards);
};

const shuffleDeck = (deck) => {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const dealCards = (deck, playerCount) => {
  const workingDeck = [...deck];
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    const count = i === 0 ? 15 : 14;
    hands.push(workingDeck.splice(0, count));
  }

  const drawnCard = workingDeck.shift();
  const jokerSuit = drawnCard.value <= 6 ? drawnCard.suit : null;
  const specialAceActive = jokerSuit !== null;

  const jokerInfo = {
    drawnCard,
    jokerSuit,
    specialAceActive,
  };

  workingDeck.unshift(drawnCard);

  const discardPile = [workingDeck.shift()];
  const remainingDeck = workingDeck;

  return {
    hands,
    deck: remainingDeck,
    discardPile,
    jokerInfo,
  };
};

const isWildCard = (card, jokerInfo) => {
  if (card.suit === 'joker') return true;
  if (jokerInfo.specialAceActive && card.suit === jokerInfo.jokerSuit && card.value === 14) return true;
  return false;
};

const getCardMeldValue = (card) => {
  if (card.suit === 'joker') return 10;
  if (card.value >= 11 || card.value === 14) return 10;
  return card.value;
};

const getMeldValue = (cards) => cards.reduce((sum, card) => sum + getCardMeldValue(card), 0);

const isValidSet = (cards, jokerInfo) => {
  if (cards.length < 3) return false;

  const nonWilds = cards.filter(c => !isWildCard(c, jokerInfo));
  const wilds = cards.filter(c => isWildCard(c, jokerInfo));

  if (nonWilds.length < 2) return false;

  const rank = nonWilds[0].value;
  if (!nonWilds.every(c => c.value === rank)) return false;

  const suits = nonWilds.map(c => c.suit);
  const uniqueSuits = new Set(suits);
  if (uniqueSuits.size !== suits.length) return false;

  return true;
};

const isValidRun = (cards, jokerInfo) => {
  if (cards.length < 3) return false;

  const nonWilds = cards.filter(c => !isWildCard(c, jokerInfo));
  const wildCount = cards.length - nonWilds.length;

  if (nonWilds.length < 2) return false;

  const suit = nonWilds[0].suit;
  if (!nonWilds.every(c => c.suit === suit)) return false;

  const tryRun = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min + 1;
    if (range > cards.length) return false;
    const gaps = range - sorted.length;
    if (gaps > wildCount) return false;
    const unique = new Set(sorted);
    if (unique.size !== sorted.length) return false;
    return true;
  };

  const normalValues = nonWilds.map(c => c.value);

  if (tryRun(normalValues)) return true;

  const hasAce = normalValues.includes(14);
  if (hasAce) {
    const lowValues = normalValues.map(v => v === 14 ? 1 : v);
    if (tryRun(lowValues)) return true;
  }

  return false;
};

const isValidMeld = (cards, jokerInfo) => {
  return isValidSet(cards, jokerInfo) || isValidRun(cards, jokerInfo);
};

const canOpen = (melds, jokerInfo, settings, highestOpenValue) => {
  for (const meld of melds) {
    if (!isValidMeld(meld, jokerInfo)) {
      return { allowed: false, totalValue: 0, reason: 'Invalid meld' };
    }
  }

  const totalValue = melds.reduce((sum, meld) => sum + getMeldValue(meld), 0);

  if (totalValue < 51) {
    return { allowed: false, totalValue, reason: 'Melds must total at least 51 points' };
  }

  if (settings.competitive && highestOpenValue > 0) {
    if (totalValue <= highestOpenValue) {
      return {
        allowed: false,
        totalValue,
        reason: `Must open with more than ${highestOpenValue} points in competitive mode`,
      };
    }
  }

  return { allowed: true, totalValue };
};

const canExtendMeld = (existingMeld, newCard, jokerInfo) => {
  const extended = [...existingMeld, newCard];
  return isValidMeld(extended, jokerInfo);
};

const calculateScores = (players, winnerId) => {
  return players.map(player => {
    if (player.id === winnerId) {
      return { playerId: player.id, score: 0 };
    }
    if (!player.hasOpened) {
      return { playerId: player.id, score: 100 };
    }
    const score = player.hand.reduce((sum, card) => sum + getCardMeldValue(card), 0);
    return { playerId: player.id, score };
  });
};

const checkWin = (player) => {
  return player.hand.length === 0;
};

const createInitialGameState = (roomId, players, settings) => {
  const deck = createDeck();
  const { hands, deck: remainingDeck, discardPile, jokerInfo } = dealCards(deck, players.length);

  const playerStates = players.map((player, i) => ({
    id: player.id,
    name: player.name,
    hand: hands[i],
    hasOpened: false,
    openValue: 0,
    isHost: player.isHost || false,
    teamIndex: i % 2,
  }));

  return {
    roomId,
    phase: 'playing',
    players: playerStates,
    deck: remainingDeck,
    discardPile,
    tableGroups: [],
    currentPlayerIndex: 0,
    turnPhase: 'draw',
    jokerInfo,
    settings: {
      competitive: settings.competitive || false,
      teamMode: settings.teamMode || false,
    },
    highestOpenValue: 0,
    winnerId: null,
  };
};

const applyDrawCard = (state, playerId, fromDiscard) => {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { state, drawnCard: null, error: 'Player not found' };
  if (playerIndex !== state.currentPlayerIndex) return { state, drawnCard: null, error: 'Not your turn' };
  if (state.turnPhase !== 'draw') return { state, drawnCard: null, error: 'Already drew this turn' };

  const newState = deepCloneState(state);

  let drawnCard;
  if (fromDiscard) {
    if (newState.discardPile.length === 0) return { state, drawnCard: null, error: 'Discard pile is empty' };
    drawnCard = newState.discardPile.pop();
  } else {
    if (newState.deck.length === 0) {
      const topDiscard = newState.discardPile.pop();
      newState.deck = shuffleDeck(newState.discardPile);
      newState.discardPile = topDiscard ? [topDiscard] : [];
    }
    if (newState.deck.length === 0) return { state, drawnCard: null, error: 'No cards available' };
    drawnCard = newState.deck.shift();
  }

  newState.players[playerIndex].hand.push(drawnCard);
  newState.turnPhase = 'act';

  return { state: newState, drawnCard };
};

const applyPlaceMelds = (state, playerId, cardIndices, meldIds) => {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Player not found' };
  if (playerIndex !== state.currentPlayerIndex) return { state, error: 'Not your turn' };
  if (state.turnPhase !== 'act') return { state, error: 'Must draw first' };

  const player = state.players[playerIndex];
  const newState = deepCloneState(state);
  const newPlayer = newState.players[playerIndex];

  const usedHandIndices = new Set();
  const resolvedMelds = [];

  for (let i = 0; i < cardIndices.length; i++) {
    const indices = cardIndices[i];
    const meldId = meldIds ? meldIds[i] : null;

    for (const idx of indices) {
      if (usedHandIndices.has(idx)) return { state, error: 'Card used in multiple melds' };
      if (idx < 0 || idx >= player.hand.length) return { state, error: 'Invalid card index' };
      usedHandIndices.add(idx);
    }

    const cards = indices.map(idx => player.hand[idx]);

    if (meldId) {
      const existingMeldIndex = newState.tableGroups.findIndex(g => g.id === meldId);
      if (existingMeldIndex === -1) return { state, error: `Meld ${meldId} not found` };
      if (!player.hasOpened) return { state, error: 'Must open before extending melds' };

      const existingMeld = newState.tableGroups[existingMeldIndex];
      const combined = [...existingMeld.cards, ...cards];
      if (!isValidMeld(combined, state.jokerInfo)) {
        return { state, error: 'Extension does not form a valid meld' };
      }
      resolvedMelds.push({ type: 'extend', meldIndex: existingMeldIndex, cards, combined });
    } else {
      if (!isValidMeld(cards, state.jokerInfo)) {
        return { state, error: 'Invalid meld' };
      }
      const type = isValidSet(cards, state.jokerInfo) ? 'set' : 'run';
      resolvedMelds.push({ type: 'new', cards, meldType: type });
    }
  }

  const newMelds = resolvedMelds.filter(m => m.type === 'new');
  const meldCards = newMelds.map(m => m.cards);

  if (!player.hasOpened && newMelds.length > 0) {
    const openCheck = canOpen(meldCards, state.jokerInfo, state.settings, state.highestOpenValue);
    if (!openCheck.allowed) {
      return { state, error: openCheck.reason };
    }
    newPlayer.hasOpened = true;
    newPlayer.openValue = openCheck.totalValue;
    if (openCheck.totalValue > newState.highestOpenValue) {
      newState.highestOpenValue = openCheck.totalValue;
    }
  } else if (!player.hasOpened && newMelds.length === 0) {
    return { state, error: 'Must place new melds to open' };
  }

  const sortedIndices = [...usedHandIndices].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    newPlayer.hand.splice(idx, 1);
  }

  for (const resolved of resolvedMelds) {
    if (resolved.type === 'new') {
      newState.tableGroups.push({
        id: randomUUID(),
        cards: resolved.cards,
        ownerId: playerId,
        type: resolved.meldType,
      });
    } else {
      newState.tableGroups[resolved.meldIndex].cards = resolved.combined;
    }
  }

  return { state: newState };
};

const applyDiscard = (state, playerId, cardIndex) => {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { state, error: 'Player not found' };
  if (playerIndex !== state.currentPlayerIndex) return { state, error: 'Not your turn' };
  if (state.turnPhase !== 'act') return { state, error: 'Must draw first' };

  const player = state.players[playerIndex];
  if (cardIndex < 0 || cardIndex >= player.hand.length) return { state, error: 'Invalid card index' };

  const newState = deepCloneState(state);
  const newPlayer = newState.players[playerIndex];

  const [discarded] = newPlayer.hand.splice(cardIndex, 1);
  newState.discardPile.push(discarded);

  if (checkWin(newPlayer)) {
    newState.winnerId = playerId;
    newState.phase = 'ended';
  }

  return { state: newState };
};

const nextTurn = (state) => {
  if (state.phase === 'ended') return state;

  const newState = deepCloneState(state);
  newState.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  newState.turnPhase = 'draw';
  return newState;
};

const deepCloneState = (state) => {
  return JSON.parse(JSON.stringify(state));
};

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
  getMeldValue,
  getCardMeldValue,
  isValidMeld,
  isValidSet,
  isValidRun,
  canOpen,
  canExtendMeld,
  calculateScores,
  checkWin,
  isWildCard,
  createInitialGameState,
  applyDrawCard,
  applyPlaceMelds,
  applyDiscard,
  nextTurn,
};

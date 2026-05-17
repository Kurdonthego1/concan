/**
 * game.js — Socket logic and UI event handling for the Concan game room.
 * Depends on: CardRenderer (cardRenderer.js)
 */

(function () {
  'use strict';

  /* ---- Read initial state from URL + sessionStorage ---- */
  const params     = new URLSearchParams(window.location.search);
  const roomId     = params.get('room') || '';
  const myPlayerId = sessionStorage.getItem('playerId') || '';

  /* ---- Game state ---- */
  let myHand             = JSON.parse(sessionStorage.getItem('hand') || '[]');
  let publicState        = JSON.parse(sessionStorage.getItem('publicState') || 'null');
  let selectedCardIndices = new Set();
  let isMyTurn           = false;
  let turnPhase          = 'wait';   // 'draw' | 'act' | 'wait'
  let selectingForMeld   = false;

  /* ---- Socket ---- */
  const socket = io(window.location.origin);

  /* ---- DOM references ---- */
  const roomCodeEl     = document.getElementById('room-code-display');
  const playersListEl  = document.getElementById('players-list');
  const drawPileEl     = document.getElementById('draw-pile');
  const discardPileEl  = document.getElementById('discard-pile');
  const drawCountEl    = document.getElementById('draw-pile-count');
  const discardCountEl = document.getElementById('discard-pile-count');
  const meldsContainer = document.getElementById('melds-container');
  const handCardsEl    = document.getElementById('hand-cards');
  const gameLogEl      = document.getElementById('game-log');
  const phaseIndicator = document.getElementById('phase-indicator');
  const actionButtons  = document.getElementById('action-buttons');
  const placeMeldBtn   = document.getElementById('place-meld-btn');
  const discardBtn     = document.getElementById('discard-btn');
  const drawFromDeckBtn = document.getElementById('draw-from-deck-btn');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const winnerNameEl   = document.getElementById('winner-name');
  const finalScoresList = document.getElementById('final-scores-list');
  const playAgainBtn   = document.getElementById('play-again-btn');
  const toast          = document.getElementById('toast');

  /* ===========================================================
     Toast helper
     =========================================================== */
  let toastTimer = null;
  function showToast(message, type) {
    type = type || 'error';
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3500);
  }

  /* ===========================================================
     Game Log
     =========================================================== */
  function addToLog(message, type) {
    type = type || 'action';
    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + type;

    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const ss  = String(now.getSeconds()).padStart(2, '0');

    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = hh + ':' + mm + ':' + ss;

    entry.appendChild(time);
    entry.appendChild(document.createTextNode(message));
    gameLogEl.appendChild(entry);

    // Auto-scroll to bottom
    gameLogEl.scrollTop = gameLogEl.scrollHeight;
  }

  /* ===========================================================
     Phase UI
     =========================================================== */
  function setPhase(phase) {
    turnPhase = phase;
    phaseIndicator.className = 'phase-indicator';

    if (phase === 'draw') {
      phaseIndicator.classList.add('phase-draw');
      phaseIndicator.textContent = 'Draw Phase';
      actionButtons.classList.add('hidden');
      drawFromDeckBtn.classList.remove('hidden');
      selectedCardIndices.clear();
    } else if (phase === 'act') {
      phaseIndicator.classList.add('phase-act');
      phaseIndicator.textContent = 'Act Phase';
      actionButtons.classList.remove('hidden');
      drawFromDeckBtn.classList.add('hidden');
    } else {
      phaseIndicator.classList.add('phase-wait');
      phaseIndicator.textContent = 'Waiting...';
      actionButtons.classList.add('hidden');
      drawFromDeckBtn.classList.add('hidden');
    }

    // Re-render hand with appropriate selectability
    renderHand();
    renderPiles();
  }

  /* ===========================================================
     Render: Players list (top bar)
     =========================================================== */
  function renderPlayers() {
    if (!publicState || !publicState.players) return;
    playersListEl.innerHTML = '';

    publicState.players.forEach(function (p) {
      const chip = document.createElement('div');
      chip.className = 'player-chip';

      const isMe = (p.id === myPlayerId || p.playerId === myPlayerId);
      if (isMe) chip.classList.add('is-me');

      const isActive = publicState.currentPlayerId
        ? (p.id === publicState.currentPlayerId || p.playerId === publicState.currentPlayerId)
        : false;
      if (isActive) chip.classList.add('active-turn');

      if (p.disconnected) chip.classList.add('disconnected');

      const cardCount = p.cardCount !== undefined ? p.cardCount : (p.hand ? p.hand.length : '?');
      const score     = p.score !== undefined ? p.score : 0;

      chip.innerHTML =
        '<span class="chip-name">' + escHtml(p.name || p.playerName || 'Player') + '</span>' +
        '<span class="chip-cards">' + cardCount + ' cards</span>' +
        '<span class="chip-score">' + score + 'pts</span>';

      playersListEl.appendChild(chip);
    });
  }

  /* ===========================================================
     Render: Draw / Discard piles
     =========================================================== */
  function renderPiles() {
    // Draw pile
    drawPileEl.innerHTML = '';
    const drawCard = CardRenderer.createCardElement(null, {
      faceDown:    true,
      interactive: isMyTurn && turnPhase === 'draw',
    });
    if (isMyTurn && turnPhase === 'draw') {
      drawCard.classList.add('clickable-pile');
    }
    drawCard.addEventListener('click', onDrawFromDeck);
    drawPileEl.appendChild(drawCard);

    if (publicState && publicState.drawPileCount !== undefined) {
      drawCountEl.textContent = publicState.drawPileCount + ' cards';
    }

    // Discard pile
    discardPileEl.innerHTML = '';
    const discardTop = (publicState && publicState.discardTop) ? publicState.discardTop : null;
    const discardInteractive = isMyTurn && turnPhase === 'draw' && !!discardTop;
    const discardCard = CardRenderer.createCardElement(discardTop, {
      faceDown:    !discardTop,
      interactive: discardInteractive,
    });
    if (discardInteractive) {
      discardCard.classList.add('clickable-pile');
      discardCard.addEventListener('click', onDrawFromDiscard);
    }
    discardPileEl.appendChild(discardCard);

    if (publicState && publicState.discardCount !== undefined) {
      discardCountEl.textContent = publicState.discardCount + ' cards';
    }
  }

  /* ===========================================================
     Render: Table melds
     =========================================================== */
  function renderMelds() {
    meldsContainer.innerHTML = '';

    const melds = (publicState && publicState.tableGroups) ? publicState.tableGroups : [];

    if (melds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'melds-empty';
      empty.textContent = 'No melds on the table yet';
      meldsContainer.appendChild(empty);
      return;
    }

    melds.forEach(function (meld, idx) {
      const meldEl = CardRenderer.renderMeldGroup(
        meld.cards || meld,
        meld.id !== undefined ? meld.id : idx,
        {
          canExtend: isMyTurn && turnPhase === 'act',
          onExtend:  function (meldId) {
            onExtendMeld(meldId);
          },
        }
      );
      meldsContainer.appendChild(meldEl);
    });
  }

  /* ===========================================================
     Render: Your hand
     =========================================================== */
  function renderHand() {
    const selectable = isMyTurn && turnPhase === 'act';

    CardRenderer.renderHand(handCardsEl, myHand, {
      selectable:      selectable,
      selectedIndices: selectedCardIndices,
      onSelect:        onCardSelect,
    });
  }

  /* ===========================================================
     Card selection
     =========================================================== */
  function onCardSelect(index) {
    if (!isMyTurn || turnPhase !== 'act') return;

    if (selectedCardIndices.has(index)) {
      selectedCardIndices.delete(index);
    } else {
      selectedCardIndices.add(index);
    }

    renderHand();
    updateActionButtonStates();
  }

  function updateActionButtonStates() {
    const count = selectedCardIndices.size;
    placeMeldBtn.disabled = count < 3;
    discardBtn.disabled   = count !== 1;
  }

  /* ===========================================================
     Full render of public state
     =========================================================== */
  function renderPublicState() {
    renderPlayers();
    renderPiles();
    renderMelds();
  }

  /* ===========================================================
     Draw pile button (alternative to clicking pile directly)
     =========================================================== */
  drawFromDeckBtn.addEventListener('click', onDrawFromDeck);

  function onDrawFromDeck() {
    if (!isMyTurn || turnPhase !== 'draw') return;
    socket.emit('draw-card', { fromDiscard: false });
    drawFromDeckBtn.disabled = true;
  }

  function onDrawFromDiscard() {
    if (!isMyTurn || turnPhase !== 'draw') return;
    socket.emit('draw-card', { fromDiscard: true });
  }

  /* ===========================================================
     Place Meld
     =========================================================== */
  placeMeldBtn.addEventListener('click', function () {
    if (selectedCardIndices.size < 3) {
      showToast('Select at least 3 cards to form a meld.', 'error');
      return;
    }

    const indices = Array.from(selectedCardIndices).sort(function (a, b) { return a - b; });
    const cards   = indices.map(function (i) { return myHand[i]; });

    socket.emit('place-melds', {
      cardIndices: [indices],
      meldIds: [null],
    }, function (err) {
      if (err) showToast(err.error || 'Could not place meld.', 'error');
    });

    // Optimistically clear selection; server will send hand-update
    selectedCardIndices.clear();
    placeMeldBtn.disabled = true;
    discardBtn.disabled   = true;
  });

  /* ===========================================================
     Discard Card
     =========================================================== */
  discardBtn.addEventListener('click', function () {
    if (selectedCardIndices.size !== 1) {
      showToast('Select exactly 1 card to discard.', 'error');
      return;
    }

    const index = Array.from(selectedCardIndices)[0];
    socket.emit('discard-card', { cardIndex: index });

    selectedCardIndices.clear();
    placeMeldBtn.disabled = true;
    discardBtn.disabled   = true;
  });

  /* ===========================================================
     Extend Meld
     =========================================================== */
  function onExtendMeld(meldId) {
    if (selectedCardIndices.size < 1) {
      showToast('Select cards to add to this meld.', 'error');
      return;
    }

    const indices = Array.from(selectedCardIndices).sort(function (a, b) { return a - b; });
    const cards   = indices.map(function (i) { return myHand[i]; });

    socket.emit('place-melds', {
      cardIndices: [indices],
      meldIds: [meldId],
    }, function (err) {
      if (err) showToast(err.error || 'Could not extend meld.', 'error');
    });
    selectedCardIndices.clear();
    updateActionButtonStates();
  }

  /* ===========================================================
     Play Again
     =========================================================== */
  playAgainBtn.addEventListener('click', function () {
    window.location.href = '/';
  });

  /* ===========================================================
     HTML escape helper
     =========================================================== */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===========================================================
     Determine if it's this player's turn from publicState
     =========================================================== */
  function checkMyTurn() {
    if (!publicState) return;
    const currentPlayer = publicState.players && publicState.players[publicState.currentPlayerIndex];
    isMyTurn = !!(currentPlayer && currentPlayer.id === myPlayerId);
  }

  /* ===========================================================
     Socket: Connect / Reconnect
     =========================================================== */
  socket.on('connect', function () {
    addToLog('Connected to server.', 'system');

    // Rejoin the room on (re)connect
    if (roomId) {
      const savedName = sessionStorage.getItem('playerName') || '';
      socket.emit('rejoin-room', {
        roomId:     roomId,
        playerId:   myPlayerId,
        playerName: savedName,
      });
    }
  });

  socket.on('disconnect', function () {
    showToast('Disconnected from server. Attempting to reconnect...', 'error');
    addToLog('Disconnected from server.', 'error');
  });

  /* ===========================================================
     Socket: Game events
     =========================================================== */

  /* Initial game state when joining mid-game or on start */
  socket.on('game-started', function (data) {
    if (data.hand) {
      myHand = data.hand;
      sessionStorage.setItem('hand', JSON.stringify(myHand));
    }
    if (data.publicState) {
      publicState = data.publicState;
      sessionStorage.setItem('publicState', JSON.stringify(publicState));
    }
    if (data.playerId) {
      sessionStorage.setItem('playerId', data.playerId);
    }

    checkMyTurn();
    renderPublicState();
    renderHand();
    setPhase(isMyTurn ? 'draw' : 'wait');
    addToLog('Game started!', 'system');
  });

  /* Full state broadcast (after any action) */
  socket.on('state-update', function (data) {
    if (data.publicState) {
      publicState = data.publicState;
      sessionStorage.setItem('publicState', JSON.stringify(publicState));
    }
    checkMyTurn();
    renderPublicState();

    if (isMyTurn) {
      if (publicState.turnPhase === 'act' && turnPhase === 'draw') {
        setPhase('act');
        addToLog('Card drawn. Select cards to meld or discard.', 'action');
      }
    } else {
      if (turnPhase !== 'wait') setPhase('wait');
    }
  });

  /* Private hand update */
  socket.on('hand-update', function (data) {
    if (data.hand) {
      myHand = data.hand;
      sessionStorage.setItem('hand', JSON.stringify(myHand));
    }
    renderHand();
  });

  /* Server tells this player it's their turn */
  socket.on('your-turn', function (data) {
    isMyTurn = true;

    const mustDraw = data && data.mustDraw !== false; // default true
    const phase = mustDraw ? 'draw' : 'act';
    setPhase(phase);

    addToLog("It's your turn!", 'system');
    showToast("It's your turn!", 'success');

    // Refresh piles so they're interactive
    renderPiles();
  });

  /* Another player's turn started */
  socket.on('player-turn', function (data) {
    isMyTurn = false;
    setPhase('wait');

    if (data && data.playerName) {
      addToLog(data.playerName + "'s turn.", 'action');
    }

    if (publicState) {
      publicState.currentPlayerId = data && data.playerId;
      renderPlayers();
    }
  });

  /* Draw successful — transition to act phase */
  socket.on('card-drawn', function (data) {
    if (data && data.hand) {
      myHand = data.hand;
      sessionStorage.setItem('hand', JSON.stringify(myHand));
    }
    if (isMyTurn) {
      setPhase('act');
      addToLog('You drew a card.', 'action');
    }
    renderHand();
    updateActionButtonStates();
  });

  /* Meld placed successfully */
  socket.on('meld-placed', function (data) {
    addToLog('Meld placed on the table.', 'action');
    if (data && data.hand) {
      myHand = data.hand;
      sessionStorage.setItem('hand', JSON.stringify(myHand));
      renderHand();
    }
    if (data && data.publicState) {
      publicState = data.publicState;
      renderPublicState();
    }
    selectedCardIndices.clear();
    updateActionButtonStates();
  });

  /* Discard acknowledged — turn ends */
  socket.on('card-discarded', function (data) {
    addToLog('Card discarded. Turn ended.', 'action');
    if (data && data.hand) {
      myHand = data.hand;
      sessionStorage.setItem('hand', JSON.stringify(myHand));
    }
    isMyTurn = false;
    setPhase('wait');
    renderHand();
  });

  /* Room update (player joined/left) */
  socket.on('room-update', function (data) {
    if (data && data.players && publicState) {
      publicState.players = data.players;
      renderPlayers();
    }
    if (data && data.message) {
      addToLog(data.message, 'system');
    }
  });

  /* Game over */
  socket.on('game-ended', function (data) {
    // data: { scores: [{name, score}], winnerName }
    isMyTurn = false;
    setPhase('wait');

    winnerNameEl.textContent = data.winnerName
      ? (data.winnerName + ' wins!')
      : 'Game Over!';

    finalScoresList.innerHTML = '';
    if (data.scores && data.scores.length) {
      data.scores
        .sort(function (a, b) { return a.score - b.score; })
        .forEach(function (s) {
          const li = document.createElement('li');
          li.innerHTML =
            '<span>' + escHtml(s.name) + '</span>' +
            '<span class="score-val">' + s.score + ' pts</span>';
          finalScoresList.appendChild(li);
        });
    }

    gameOverOverlay.classList.add('visible');
    addToLog('Game ended. Winner: ' + (data.winnerName || 'Unknown'), 'system');
  });

  /* Generic error events */
  socket.on('error', function (data) {
    const msg = (data && data.message) ? data.message : 'An error occurred.';
    showToast(msg, 'error');
    addToLog('Error: ' + msg, 'error');

    // Re-enable buttons on error
    drawFromDeckBtn.disabled = false;
    if (isMyTurn && turnPhase === 'act') {
      updateActionButtonStates();
    }
  });

  socket.on('game-error', function (data) {
    const msg = (data && data.message) ? data.message : 'Game error.';
    showToast(msg, 'error');
    addToLog('Error: ' + msg, 'error');
  });

  /* Chat / system messages */
  socket.on('game-message', function (data) {
    if (data && data.message) {
      addToLog(data.message, data.type || 'action');
    }
  });

  /* ===========================================================
     Initial render on page load
     =========================================================== */
  if (roomCodeEl) roomCodeEl.textContent = roomId || '------';

  // If we have state from sessionStorage (navigated from home), render immediately
  if (publicState) {
    checkMyTurn();
    renderPublicState();
    renderHand();
    setPhase(isMyTurn ? 'draw' : 'wait');
  } else {
    // Wait for server to send state
    setPhase('wait');
  }

  // Initially disable action buttons
  placeMeldBtn.disabled = true;
  discardBtn.disabled   = true;

  addToLog('Connecting to game room ' + (roomId || '?') + '...', 'system');

}());

/**
 * home.js — Logic for the Concan home page (index.html).
 * Handles create/join game forms and the pre-game lobby.
 */

(function () {
  'use strict';

  /* ---- Socket ---- */
  const socket = io(window.location.origin);

  /* ---- State ---- */
  let isHost = false;
  let currentRoomId = null;

  /* ---- DOM references ---- */
  // Sections
  const homeCards    = document.getElementById('home-cards');
  const lobbySection = document.getElementById('lobby-section');

  // Create form
  const createNameInput  = document.getElementById('create-player-name');
  const competitiveToggle = document.getElementById('competitive-mode');
  const teamToggle       = document.getElementById('team-mode');
  const createBtn        = document.getElementById('create-btn');

  // Join form
  const joinNameInput  = document.getElementById('join-player-name');
  const joinCodeInput  = document.getElementById('join-room-code');
  const joinBtn        = document.getElementById('join-btn');

  // Lobby
  const lobbyRoomCode  = document.getElementById('lobby-room-code');
  const playerListEl   = document.getElementById('lobby-player-list');
  const startBtn       = document.getElementById('start-btn');
  const waitingText    = document.getElementById('waiting-text');

  // Toast
  const toast = document.getElementById('toast');

  /* ---- Toast helper ---- */
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

  /* ---- Show lobby ---- */
  function showLobby(roomId, host) {
    isHost        = !!host;
    currentRoomId = roomId;

    homeCards.classList.add('hidden');
    lobbySection.classList.add('visible');
    lobbySection.classList.remove('hidden');

    lobbyRoomCode.textContent = roomId;
    updateStartButton([]);
  }

  /* ---- Copy room code on click ---- */
  lobbyRoomCode.addEventListener('click', function () {
    navigator.clipboard.writeText(currentRoomId).then(function () {
      lobbyRoomCode.classList.add('copied');
      setTimeout(function () {
        lobbyRoomCode.classList.remove('copied');
      }, 2000);
    }).catch(function () {
      // Fallback: select text
      const range = document.createRange();
      range.selectNode(lobbyRoomCode);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
  });

  /* ---- Update player list in lobby ---- */
  function updatePlayerList(players) {
    playerListEl.innerHTML = '';
    players.forEach(function (p, i) {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name || p.playerName || ('Player ' + (i + 1));
      li.appendChild(nameSpan);

      if (i === 0) {
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = 'HOST';
        li.appendChild(badge);
      }
      playerListEl.appendChild(li);
    });
    updateStartButton(players);
  }

  /* ---- Show/hide Start button ---- */
  function updateStartButton(players) {
    if (isHost && players.length >= 2) {
      startBtn.classList.remove('hidden');
      waitingText.classList.add('hidden');
    } else {
      startBtn.classList.add('hidden');
      if (isHost) {
        waitingText.classList.remove('hidden');
        waitingText.textContent = 'Waiting for players to join... (' + players.length + '/2 minimum)';
      } else {
        waitingText.classList.remove('hidden');
        waitingText.textContent = 'Waiting for the host to start the game...';
      }
    }
  }

  /* ---- Validate name helper ---- */
  function validateName(name) {
    if (!name || name.trim().length < 1) {
      showToast('Please enter your player name.');
      return false;
    }
    if (name.trim().length > 20) {
      showToast('Name must be 20 characters or less.');
      return false;
    }
    return true;
  }

  /* ---- Create Game ---- */
  createBtn.addEventListener('click', function () {
    const playerName = createNameInput.value.trim();
    if (!validateName(playerName)) return;

    const settings = {
      competitive: competitiveToggle.checked,
      teamMode:    teamToggle.checked,
    };

    createBtn.disabled = true;
    socket.emit('create-room', { playerName: playerName, settings: settings }, function (err, data) {
      createBtn.disabled = false;
      if (err) { showToast(err.error || 'Could not create room.'); return; }
      sessionStorage.setItem('playerId', socket.id);
      sessionStorage.setItem('playerName', playerName);
      showLobby(data.roomId, true);
    });
  });

  /* ---- Join Game ---- */
  joinBtn.addEventListener('click', function () {
    const playerName = joinNameInput.value.trim();
    const roomCode   = joinCodeInput.value.trim().toUpperCase();

    if (!validateName(playerName)) return;
    if (!roomCode || roomCode.length !== 6) {
      showToast('Please enter a valid 6-character room code.');
      return;
    }

    joinBtn.disabled = true;
    socket.emit('join-room', { roomId: roomCode, playerName: playerName }, function (err) {
      joinBtn.disabled = false;
      if (err) { showToast(err.error || 'Could not join room.'); return; }
      sessionStorage.setItem('playerId', socket.id);
      sessionStorage.setItem('playerName', playerName);
      showLobby(roomCode, false);
    });
  });

  /* ---- Allow Enter key to submit ---- */
  function onEnterKey(inputEl, btn) {
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });
  }
  onEnterKey(createNameInput, createBtn);
  onEnterKey(joinNameInput,   joinBtn);
  onEnterKey(joinCodeInput,   joinBtn);

  /* ---- Room code input — auto uppercase ---- */
  joinCodeInput.addEventListener('input', function () {
    const pos   = this.selectionStart;
    this.value  = this.value.toUpperCase();
    this.setSelectionRange(pos, pos);
  });

  /* ---- Start Game ---- */
  startBtn.addEventListener('click', function () {
    startBtn.disabled = true;
    socket.emit('start-game');
  });

  /* ===========================================================
     Socket event listeners
     =========================================================== */

  socket.on('connect', function () {
    createBtn.disabled = false;
    joinBtn.disabled   = false;
  });

  socket.on('disconnect', function () {
    showToast('Disconnected from server. Please refresh.', 'error');
  });

  /* Player list update while in lobby */
  socket.on('room-update', function (data) {
    // data: { players }
    updatePlayerList(data.players || []);
  });

  /* Game started — navigate to game room */
  socket.on('game-started', function (data) {
    if (data.hand) {
      sessionStorage.setItem('hand', JSON.stringify(data.hand));
    }
    if (data.publicState) {
      sessionStorage.setItem('publicState', JSON.stringify(data.publicState));
    }
    window.location.href = '/game.html?room=' + encodeURIComponent(currentRoomId);
  });

  /* Error from server */
  socket.on('error', function (data) {
    createBtn.disabled = false;
    joinBtn.disabled   = false;
    startBtn.disabled  = false;
    const msg = (data && data.message) ? data.message : 'An error occurred.';
    showToast(msg, 'error');
  });

  /* Generic catch-all for server errors emitted differently */
  socket.on('game-error', function (data) {
    const msg = (data && data.message) ? data.message : 'Game error.';
    showToast(msg, 'error');
    createBtn.disabled = false;
    joinBtn.disabled   = false;
    startBtn.disabled  = false;
  });

}());

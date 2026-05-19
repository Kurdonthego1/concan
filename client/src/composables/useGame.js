import { reactive } from 'vue'
import { useSocket } from './useSocket.js'

const state = reactive({
  roomId: null,
  isHost: false,
  lobbyPlayers: [],
  myPlayerId: null,
  myHand: [],
  publicState: null,
  isMyTurn: false,
  turnPhase: 'wait',
  selectedIndices: new Set(),
  pendingMelds: [],
  gameLog: [],
  toast: { visible: false, message: '', type: 'error' },
})

let toastTimer = null
let lobbyListenersRegistered = false
let gameListenersRegistered = false

export function useGame() {
  const socket = useSocket()

  function showToast(message, type = 'error') {
    state.toast = { visible: true, message, type }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { state.toast.visible = false }, 3500)
  }

  function addLog(message, type = 'action') {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    state.gameLog.push({ message, type, time })
  }

  function checkMyTurn() {
    if (!state.publicState) return
    const current = state.publicState.players?.[state.publicState.currentPlayerIndex]
    state.isMyTurn = !!(current && current.id === state.myPlayerId)
  }

  function setPhase(phase) {
    state.turnPhase = phase
  }

  function createRoom(playerName, settings) {
    return new Promise((resolve, reject) => {
      socket.emit('create-room', { playerName, settings }, (err, data) => {
        if (err) { showToast(err.error || 'Could not create room.'); reject(err); return }
        state.myPlayerId = socket.id
        state.roomId = data.roomId
        state.isHost = true
        resolve(data)
      })
    })
  }

  function joinRoom(roomId, playerName) {
    return new Promise((resolve, reject) => {
      socket.emit('join-room', { roomId, playerName }, (err) => {
        if (err) { showToast(err.error || 'Could not join room.'); reject(err); return }
        state.myPlayerId = socket.id
        state.roomId = roomId.toUpperCase()
        state.isHost = false
        resolve()
      })
    })
  }

  function startGame() {
    socket.emit('start-game', (err) => {
      if (err) showToast(err.error || 'Could not start game.')
    })
  }

  function drawCard(fromDiscard = false) {
    socket.emit('draw-card', { fromDiscard }, (err) => {
      if (err) showToast(err.error || 'Could not draw card.')
    })
  }

  function placeMelds(cardIndices, meldIds) {
    socket.emit('place-melds', { cardIndices, meldIds }, (err) => {
      if (err) showToast(err.error || 'Could not place meld.')
    })
  }

  function discardCard(cardIndex) {
    socket.emit('discard-card', { cardIndex }, (err) => {
      if (err) showToast(err.error || 'Could not discard.')
    })
  }

  function rejoinRoom(roomId, playerName) {
    socket.emit('rejoin-room', { roomId, playerName }, (err) => {
      if (err) showToast('Could not rejoin game.')
    })
  }

  function leaveRoom() {
    socket.disconnect()
    socket.connect()
    state.roomId = null
    state.isHost = false
    state.lobbyPlayers = []
    state.myHand = []
    state.publicState = null
    state.isMyTurn = false
    state.turnPhase = 'wait'
    state.selectedIndices.clear()
    state.pendingMelds = []
    state.gameLog = []
    lobbyListenersRegistered = false
    gameListenersRegistered = false
  }

  function registerLobbyListeners(router) {
    if (lobbyListenersRegistered) return
    lobbyListenersRegistered = true

    socket.on('room-update', ({ players }) => {
      state.lobbyPlayers = players
    })

    socket.on('game-started', ({ hand, publicState }) => {
      state.myHand = hand || []
      state.publicState = publicState || null
      checkMyTurn()
      setPhase(state.isMyTurn ? 'draw' : 'wait')
      router.push('/game')
    })

    socket.on('your-turn', ({ mustDraw }) => {
      state.isMyTurn = true
      addLog("It's your turn!", 'system')
      showToast("It's your turn!", 'success')
      setPhase(mustDraw === false ? 'act' : 'draw')
    })

    socket.on('state-update', ({ publicState }) => {
      state.publicState = publicState
      const wasMyTurn = state.isMyTurn
      checkMyTurn()
      if (!state.isMyTurn && wasMyTurn) {
        state.pendingMelds = []
        state.selectedIndices.clear()
      }
      if (state.isMyTurn) {
        if (publicState.turnPhase === 'act' && state.turnPhase === 'draw') {
          setPhase('act')
          addLog('Card drawn. Select cards to meld or discard.', 'action')
        }
      } else {
        if (state.turnPhase !== 'wait') setPhase('wait')
      }
    })

    socket.on('hand-update', ({ hand }) => {
      state.myHand = hand || []
    })

    socket.on('game-ended', ({ scores, winnerName }) => {
      if (state.publicState) {
        state.publicState.phase = 'ended'
        state.publicState.winnerName = winnerName
        state.publicState._scores = scores
      }
      addLog(`Game over! ${winnerName} wins!`, 'system')
    })

    socket.on('error', ({ message }) => {
      showToast(message || 'An error occurred.')
    })
  }

  function registerGameListeners() {
    // All listeners are now registered in registerLobbyListeners
  }

  return {
    state,
    showToast,
    addLog,
    checkMyTurn,
    setPhase,
    createRoom,
    joinRoom,
    startGame,
    drawCard,
    placeMelds,
    discardCard,
    rejoinRoom,
    registerLobbyListeners,
    registerGameListeners,
    leaveRoom,
  }
}

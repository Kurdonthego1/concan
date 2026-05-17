/**
 * CardRenderer — utility object for rendering playing cards in the DOM.
 * Exposed as window.CardRenderer (no module system required).
 */
window.CardRenderer = (function () {

  /**
   * Returns the Unicode symbol for a suit string.
   * @param {string} suit — 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker'
   * @returns {string}
   */
  function suitSymbol(suit) {
    const map = {
      hearts:   '♥',
      diamonds: '♦',
      clubs:    '♣',
      spades:   '♠',
      joker:    '🃏',
    };
    return map[suit] || '?';
  }

  /**
   * Returns 'red' for hearts/diamonds, 'black' for clubs/spades/joker.
   * @param {string} suit
   * @returns {'red'|'black'}
   */
  function suitColor(suit) {
    return (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
  }

  /**
   * Human-readable display string for a numeric card value.
   * @param {number} value — 2-15 (14=Ace, 15=Joker)
   * @returns {string}
   */
  function valueDisplay(value) {
    if (value === 15) return '🃏';
    if (value === 14) return 'A';
    if (value === 13) return 'K';
    if (value === 12) return 'Q';
    if (value === 11) return 'J';
    return value.toString();
  }

  /**
   * Returns true if the value is a face card (J, Q, K, Joker).
   * @param {number} value
   * @returns {boolean}
   */
  function isFaceCard(value) {
    return value === 11 || value === 12 || value === 13 || value === 15;
  }

  /**
   * Creates and returns a .card HTMLElement.
   *
   * @param {object|null} card  — { value: number, suit: string } or null for back
   * @param {object} options
   *   @param {boolean} [options.faceDown=false]    — render card back
   *   @param {boolean} [options.selected=false]    — apply selected styling
   *   @param {function} [options.onClick]          — click handler
   *   @param {boolean} [options.small=false]       — smaller card size
   *   @param {boolean} [options.interactive=true]  — whether hover/cursor applies
   * @returns {HTMLElement}
   */
  function createCardElement(card, options) {
    options = options || {};
    const faceDown   = !!options.faceDown || !card;
    const selected   = !!options.selected;
    const small      = !!options.small;
    const interactive = options.interactive !== false;

    const el = document.createElement('div');
    el.classList.add('card');

    if (small) el.classList.add('small');
    if (selected) el.classList.add('selected');
    if (!interactive) el.classList.add('non-interactive');

    if (faceDown) {
      el.classList.add('face-down');
      const pattern = document.createElement('div');
      pattern.className = 'card-back-pattern';
      el.appendChild(pattern);
    } else {
      const suit  = card.suit || 'spades';
      const value = card.value;

      el.classList.add('suit-' + suit);

      const display = valueDisplay(value);
      const symbol  = suitSymbol(suit);

      // Top-left corner
      const topCorner = document.createElement('div');
      topCorner.className = 'card-corner card-corner-top';
      topCorner.innerHTML =
        '<span class="corner-value">' + display + '</span>' +
        '<span class="corner-suit">'  + symbol  + '</span>';
      el.appendChild(topCorner);

      // Bottom-right corner (rotated via CSS)
      const botCorner = document.createElement('div');
      botCorner.className = 'card-corner card-corner-bottom';
      botCorner.innerHTML =
        '<span class="corner-value">' + display + '</span>' +
        '<span class="corner-suit">'  + symbol  + '</span>';
      el.appendChild(botCorner);

      // Center content
      if (suit === 'joker' || value === 15) {
        // Joker — just show the emoji large
        const center = document.createElement('div');
        center.className = 'card-center';
        center.textContent = '🃏';
        el.appendChild(center);
      } else if (isFaceCard(value)) {
        // J / Q / K — show letter prominently
        const face = document.createElement('div');
        face.className = 'card-face';
        face.textContent = display;
        el.appendChild(face);
      } else {
        // Number card — show suit symbol
        const center = document.createElement('div');
        center.className = 'card-center';
        center.textContent = symbol;
        el.appendChild(center);
      }
    }

    if (typeof options.onClick === 'function') {
      el.addEventListener('click', options.onClick);
    }

    return el;
  }

  /**
   * Renders an array of cards into a container element.
   * Clears the container first.
   *
   * @param {HTMLElement} container
   * @param {Array<object>} cards            — array of { value, suit }
   * @param {object} options
   *   @param {boolean} [options.selectable=false]
   *   @param {Set<number>} [options.selectedIndices]  — indices that are selected
   *   @param {function} [options.onSelect]             — fn(index) called on card click
   *   @param {boolean} [options.small=false]
   *   @param {boolean} [options.faceDown=false]        — render all face-down
   */
  function renderHand(container, cards, options) {
    options = options || {};
    container.innerHTML = '';

    if (!cards || cards.length === 0) {
      const empty = document.createElement('span');
      empty.style.color = 'rgba(255,255,255,0.2)';
      empty.style.fontSize = '0.9rem';
      empty.style.fontStyle = 'italic';
      empty.style.alignSelf = 'center';
      empty.textContent = 'No cards';
      container.appendChild(empty);
      return;
    }

    const selectedIndices = options.selectedIndices || new Set();

    cards.forEach(function (card, index) {
      const isSelected = selectedIndices.has(index);
      const cardEl = createCardElement(card, {
        faceDown:    !!options.faceDown,
        selected:    isSelected,
        small:       !!options.small,
        interactive: !!options.selectable,
        onClick: options.selectable && typeof options.onSelect === 'function'
          ? function () { options.onSelect(index); }
          : undefined,
      });
      cardEl.dataset.index = index;
      container.appendChild(cardEl);
    });
  }

  /**
   * Creates and returns a .meld-group HTMLElement.
   *
   * @param {Array<object>} cards   — array of { value, suit }
   * @param {string|number} meldId  — identifier for this meld
   * @param {object} options
   *   @param {boolean} [options.canExtend=false]  — show extend button
   *   @param {function} [options.onExtend]         — fn(meldId) when extend clicked
   * @returns {HTMLElement}
   */
  function renderMeldGroup(cards, meldId, options) {
    options = options || {};

    const group = document.createElement('div');
    group.className = 'meld-group';
    group.dataset.meldId = meldId;

    const cardsRow = document.createElement('div');
    cardsRow.className = 'meld-cards';

    (cards || []).forEach(function (card) {
      const cardEl = createCardElement(card, {
        small:       true,
        interactive: false,
      });
      cardsRow.appendChild(cardEl);
    });

    group.appendChild(cardsRow);

    if (options.canExtend) {
      const extBtn = document.createElement('button');
      extBtn.className = 'meld-extend-btn';
      extBtn.textContent = '+ Extend';
      extBtn.addEventListener('click', function () {
        if (typeof options.onExtend === 'function') {
          options.onExtend(meldId);
        }
      });
      group.appendChild(extBtn);
    }

    return group;
  }

  // Public API
  return {
    suitSymbol:       suitSymbol,
    suitColor:        suitColor,
    valueDisplay:     valueDisplay,
    createCardElement: createCardElement,
    renderHand:       renderHand,
    renderMeldGroup:  renderMeldGroup,
  };

}());

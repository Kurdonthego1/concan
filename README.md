# concan

## Project building
- Build this project by orchestrating agents, one needs to handle the UI, one should have the logic and one should build the backend
- Create git commits every so often when a function or part of code is done

## UI
- The UI should be simple, the cards should be realistic, we do not need any animations or crazy things for now
- Game needs to include SOCKET connection like Skribbl.io so that it can just be lobby based by URL

## Game Logic
- 2 decks of 52 cards
- Players get 14 cards each, starting player gets a 15th to start the game
- Winner determined by player or team (Only 1 player needs to fullfil) with no cards left
- Players between 2 to 4
- Games are played 1v1, 1v1v1, 1v1v1v1 or 2v2
- End game scoring is by 100, 0 or addition of cards
    - 100pt if the player has not placed cards
    - 0 if the player wins the round
    - addition of cards if the player has played on the table but not completed there hand
- Cards hold weight equal to the value except Ace and Face cards which are all 10
- Players must have a card value of 51 before player on the table
    - Two sets of rules
        - One is to beat the value that the previous player plays on the table with.
        - 51 Normally, player A plays 60, player B must play 61
        - or
        - 51 Normally, all players just need to beat it
    - Make that a toggle in the settings before hand
- Within the deck is 2 joker cards, at the start of the game a random card is drawn from the deck.
- If the card drawn is say 6 or lower, its suit is taken as the joker card. 
    - The ace is then taking as the joker of the same suit.
    - Joker cards become the Ace
    - Example
        - 6 of hearts is pulled
        - Ace of hearts is joker
        - Joker becomes ace of hearts

## MELD LOGIC
- Melds are SAME SUITS chronoligical or 3 of the same value but different suits. MUST BE 3 OR MORE
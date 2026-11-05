# Monopoly

A browser-based Monopoly game for 2–6 players sharing one device. Choose **Play** on the home page, enter the players' names, and start a game. An in-progress game is saved in the browser and resumes when you return.

The unified game uses a React board and a shared rules engine. It includes dice animation and sound, moving tokens, purchases, auctions, rent, houses and hotels, direct property sales, local cash and property trades, jail, Chance and Community Chest decks, and a simplified bankruptcy flow.

The optional loan house rule allows one outstanding bank loan (up to $500) and multiple loans from other players with their approval. Loans accrue a one-time 10% charge, rounded up, and can be repaid in full voluntarily with no automatic deadline. When a borrower goes bankrupt, their bank loans are written off and the bank pays player lenders the full outstanding amount. Loans owed to a bankrupt lender transfer to the bankruptcy creditor or the bank.

The game is still in development: full bankruptcy rules and online multiplayer are not yet implemented. Profile, leaderboard and friend pages contain placeholder functionality. The account server stores passwords in plaintext and is not suitable for production.

Properties can be sold directly to the bank for half their purchase price. All buildings in the color group must be sold first. Properties and get-out-of-jail cards can also be traded with other players.

On an unowned property, a player may buy it, send it to auction, or pass and leave it unowned.

## Run the game

```sh
cd Client
npm ci
npm start
```

Open the address printed by the development server and select **Play**. The game itself does not require the account server or MongoDB.

To start the optional account server, install dependencies in `server`, run MongoDB locally, and run `npm start` there. The server currently expects MongoDB at `mongodb://localhost:27017/employee` and listens on port 3001.

## Test

```sh
node --test Client/src/game/engine.test.cjs
cd Client
npm test -- --watch=false --runInBand
npm run build
```

The game lives at `/game`. The former `/local-game`, `/game2`, `/game3`, `/game5`, and `/game6` routes redirect to it. The saved game uses the same browser storage as the previous local preview.

See [GAME_PLAN.md](GAME_PLAN.md) for the remaining work.

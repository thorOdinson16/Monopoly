# Monopoly

A browser-based Monopoly game for 2–6 players sharing one device. Choose **Play** on the home page, enter the players' names, and start a game. An in-progress game is saved in the browser and resumes when you return.

The unified game uses a React board and a shared rules engine. It includes dice animation and sound, moving tokens, purchases, auctions, rent, houses and hotels, direct property sales, local cash and property trades, jail, Chance and Community Chest decks, and a simplified bankruptcy flow.

The optional loan house rule allows one outstanding bank loan (up to $500) and multiple loans from other players with their approval. Loans accrue a one-time 10% charge, rounded up, and can be repaid in full voluntarily with no automatic deadline. When a borrower goes bankrupt, their bank loans are written off and the bank pays player lenders the full outstanding amount. Loans owed to a bankrupt lender transfer to the bankruptcy creditor or the bank.

The profile, leaderboard and saved-player list use data stored in the current browser. Accounts are optional and do not sync local games or results. Online rooms are experimental.

Properties can be sold directly to the bank for half their purchase price. All buildings in the color group must be sold first. Properties and get-out-of-jail cards can also be traded with other players.

On an unowned property, a player may buy it, send it to auction, or pass and leave it unowned.

## Run the game

```sh
cd Client
npm ci
npm start
```

Open the address printed by the development server and select **Play**. The game itself does not require the account server or MongoDB.

## Share through Tailscale Funnel

This shares the game over a public HTTPS link. Visitors do not need Tailscale or an account. The online room feature is under development and is not yet ready for public use. Your computer and Tailscale must remain running.

Install and sign in to Tailscale on the host. Funnel requires MagicDNS, HTTPS and Funnel permission on the tailnet; its first use may prompt an administrator to enable them. See [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel).

Start local MongoDB first. Install dependencies in both folders, then build the hosted version and start its loopback server:

```powershell
cd server
npm ci
cd ..\Client
npm ci
node build-public.cjs
$env:PORT='3100'
node serve-public.cjs
```

Keep that window open. In another window run:

```powershell
tailscale funnel --https=8443 http://127.0.0.1:3100
```

Share the HTTPS URL printed by Tailscale, including `:8443`. Keep Funnel running; Ctrl+C stops this foreground sharing session. Monopoly uses its own local port (3100) and Funnel port (8443); it does not reset Tailscale's other routes. If you previously started Monopoly's Funnel in the background, stop just this route with `tailscale funnel --https=8443 off`. Run the public build again after making changes.

Accounts and sessions use MongoDB at `mongodb://127.0.0.1:27017/monopoly` by default; set `MONGODB_URI` to use another local database. Passwords are hashed and session tokens are stored as hashes. Online game rooms are still stored separately in `data/online-rooms.json`; local games and results remain in each browser. The account service and online mode still need a full public deployment review.

For the React development server, start the account server separately with `npm start` in `server` (port 3001), then run the client as above. `ALLOWED_ORIGINS` configures extra development origins.

## Test

```sh
node --test Client/src/game/engine.test.cjs
cd Client
npm test -- --watch=false --runInBand
npm run build
```

The game lives at `/game`. The former `/local-game`, `/game2`, `/game3`, `/game5`, and `/game6` routes redirect to it. The saved game uses the same browser storage as the previous local preview.


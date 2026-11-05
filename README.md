# Monopoly

A browser-based Monopoly game for 2–6 players. Play together on one device, or host an online room and invite players with a room code or link. Online play is experimental.

## Playing

- **Local game:** choose **Play**, enter the players' names, and share one device. The game resumes from the same browser.
- **Online game:** choose **Play online** in the hosted app. The host creates a room and shares its code or link; other players enter a name and request to join. The host approves players and starts the game. A player can reconnect using the same browser, as long as its saved room credential remains available.
- The online host can end a room for everyone. Individual players can resign when no card, debt, auction or offer is awaiting resolution. Their properties return to the bank; if one player remains, that player wins.

The board includes animated dice and pawns with sound, property cards, purchases, auctions, rent, houses and hotels, trades, jail, Chance and Community Chest. Click a board space to see its card and manage an eligible property. The **Activity log** contains the full history.

Properties sell directly to the bank for half their purchase price; buildings in the color group must be sold first. On an unowned property, the player can buy, auction, or pass and leave it available.

### Loan house rule

A player may have one bank loan of up to $500 and multiple loans from other players, subject to lender approval. Loans have a one-time 10% charge, rounded up, and can be repaid in full voluntarily; there is no automatic deadline. When a borrower goes bankrupt, bank loans are written off and the bank pays player lenders the full outstanding amount. Loans owed to a bankrupt lender transfer to the bankruptcy creditor or the bank.

## Install

You need Node.js and npm. MongoDB is required for accounts and for starting the hosted server; local play in the React development server works without it. Tailscale is needed only when sharing with Funnel.

From the repository root, install both sets of dependencies:

```sh
cd server
npm ci
cd ../Client
npm ci
```

### Local development

Run `npm start` in `Client` and open the displayed address. To use sign-in and registration in development, start MongoDB and run `npm start` separately in `server`; the account server listens on port 3001. `REACT_APP_API_URL` can override the account API address, and `ALLOWED_ORIGINS` can specify permitted development origins.

### Host online with Tailscale Funnel

Start MongoDB and sign in to Tailscale on the host. Funnel needs MagicDNS, HTTPS certificates and Funnel permission on the tailnet; setup may prompt a tailnet administrator. See the [Tailscale Funnel documentation](https://tailscale.com/docs/features/tailscale-funnel).

On Windows, create desktop shortcuts once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Client/make-desktop-shortcuts.ps1
```

Use **Start Monopoly** to build and start the hosted app and Funnel, and **Stop Monopoly** to stop them. The start shortcut displays the address to share. The host computer, MongoDB and Tailscale must remain running while people play.

Alternatively, from `Client`, build and run the server, then keep the window open:

```powershell
node build-public.cjs
$env:PORT='3100'
node serve-public.cjs
```

In another window, run:

```powershell
tailscale funnel --https=8443 http://127.0.0.1:3100
```

Share the HTTPS address printed by Tailscale, including `:8443`. Visitors do not need Tailscale or an account. The link is publicly reachable, so share room codes and links with the people you want to invite. Ctrl+C stops foreground Funnel sharing. For a background Funnel, `tailscale funnel --https=8443 off` stops that port. The hosted server listens locally on port 3100 and serves both the app and account API.

## Data and accounts

- **Accounts and sessions:** MongoDB defaults to `mongodb://127.0.0.1:27017/monopoly`. Set `MONGODB_URI` to use another MongoDB database. Passwords and session tokens are stored as hashes. Accounts do not currently sync games or results.
- **Online rooms and games:** saved on the host in `data/online-rooms.json`. Keep this file if you want to retain rooms across server restarts. The host's browser stores its seat credential, as does each player's browser.
- **Local games, results and saved player names:** stored in the browser on the device used to play. Clearing browser storage removes that local data.

## Tests

From the repository root:

```sh
node --test Client/src/game/engine.test.cjs Client/rooms.test.cjs
node --test server/app.test.js
cd Client
npm test -- --watch=false --runInBand
npm run build
```

The MongoDB integration test is opt-in and should use a test database. For example, in PowerShell from the repository root:

```powershell
$env:MONOPOLY_MONGO_TEST_URI='mongodb://127.0.0.1:27017/monopoly_account_test'
node --test server/database.test.js
```

The board lives at `/game`; legacy game routes redirect there. Online rooms use `/online` in the hosted app. The account service and online mode still need a full public deployment review.

# Mine Descent 4.0.1 — Two-player mode

Single-player campaign remains available. The new **Two player · Create match** button starts an online duel in Iron Hollow, the first mine.

## Deploy the update

Upload **all the files inside this folder** to the existing game's repository, preserving the `src`, `worker`, `scripts`, and `tests` folders. Keep your existing Worker name in `wrangler.jsonc`. Do not delete the Worker.

Cloudflare build command: `npm run build`

Cloudflare deploy command: `npx wrangler deploy --config wrangler.jsonc`

The included Wrangler configuration creates the `MATCHES` Durable Object binding and its migration automatically. Keep the migration in the configuration for future deployments. No D1, R2, TURN service, passwords, or API keys are needed. Keep any existing custom-domain configuration from your deployment.

For command-line deployment, use Node.js 22+, install Wrangler, sign in with `npx wrangler login`, and run `npm run deploy`.

## Play together

1. Player one clicks **Two player · Create match** and copies the match link.
2. Player two opens that link and clicks **Join two-player match**.
3. A three-second countdown starts once both ships are ready.
4. Fly and fight using the existing controls. Player one is blue; player two is gold. The server runs both ships, robots, doors, pickups, projectiles, and damage.

Each player has one life with 100 shield and 100 hull. The last surviving ship wins, whether the other ship is destroyed by robots, the other player, or the reactor. Destroying the reactor starts a 12-second countdown; the center of the starting room is a blast shelter (within 12 meters). If both survive the blast, or both die together, the match is a draw. Disconnecting forfeits a started match. A match ends after 20 minutes if neither player has won.

Escape opens settings but **does not pause the online match**. Lobby links admit two players only; make a new match after a finished game. Reloading does not reconnect a ship. Server restarts or deployments can interrupt a match. There are no persistent match saves or ranked scores.

Multiplayer currently uses the first mine at normal difficulty. Special weapons can be found and equipped; robot-targeting homing missiles can also hit the other ship directly. The reactor access key unlocks the shared bulkhead for both players. Campaign progress and upgrades remain separate from multiplayer.

## Local preview

`npm start` previews the single-player game at http://127.0.0.1:8787 without dependencies. For multiplayer, install Wrangler and run `npm run dev`; the simple static preview does not provide WebSockets or Durable Objects.

Use a WebGL 2 browser with hardware acceleration, keyboard, and mouse. The game bundles its assets and Three.js; no CDN dependencies are needed.

## Verification

- `npm run build` regenerates both the shared server simulation and embedded browser assets.
- `npm run validate` checks the embedded routes against source.
- `npm run test:mechanics` checks the original gameplay mechanics plus client snapshot rendering without a GPU.
- `npm run test:multiplayer` checks separate ships, movement, actual player projectile kills, and reactor deaths.
- `npm run test:audio` checks the existing audio implementation.
- `npm run test:sockets` requires Miniflare (`npm install --no-save miniflare`) and checks two connections, movement, third-player rejection, and disconnect victory in workerd.

This package was checked with the local Cloudflare runtime and Wrangler's deployment dry run. It has not been deployed to your account or visually tested in two real browsers over the internet. The first live test should be two browser sessions on the deployed URL.

## Hosting usage

Online matches keep a Durable Object active while the simulation runs; this consumes Cloudflare Durable Object requests and duration allowance. Usage beyond your plan's included allowance can incur charges on paid plans or hit limits on free plans. This is designed for small private matches, not load-tested public matchmaking. See https://developers.cloudflare.com/durable-objects/platform/pricing/ and https://developers.cloudflare.com/durable-objects/platform/limits/.

## Source

`src/` contains the browser game. `worker/match.js` manages rooms and validates input. `scripts/multiplayer-engine.mjs` generates the server simulation from the same mechanics used by single player. `worker/index.js` and `worker/engine.js` are generated; edit source and rebuild instead. Include every source folder when deploying because the server also imports shared modules.

Three.js license: `src/vendor/LICENSE`. Existing controls and campaign instructions: `GAME-GUIDE.md`.

## 4.0.1 startup fix

A live test reproduced both clients closing with code 1008 (Too many messages). Normal 10 Hz inputs could arrive in a burst after server initialization. Lobby heartbeats now run once per second, and the server allows bounded bursts with a token bucket while still rejecting sustained flooding. The server also skips rendering-only mesh batching, room effects, and cockpit construction. Collision geometry and browser visuals remain intact. Abnormal closes now show their close code and reason instead of a false Draw result.

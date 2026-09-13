# Mine Descent — Download Package

Latest game build: **3.2.1**, including the big golden reactor key, keyed security bulkheads with a mechanical locked sound, louder reactor guidance, distinctive room machinery and effects, rarer shield drops, and doors that open when shot. All existing flight controls and cannon systems are included.

## Play on your computer

Extract the entire ZIP. Install Node.js 22 or newer if needed, open a terminal in this folder, then run:

```sh
npm start
```

Open **http://127.0.0.1:8787** in Chrome, Edge, or another WebGL 2 browser. Leave the terminal open while playing; Ctrl+C stops the server. Local play needs no npm install, Cloudflare account, or API keys. All assets are included. Do not open src/index.html directly: the game needs its HTTP routes.

## Deploy to your Cloudflare account

The prebuilt `worker/index.js` contains every game asset. `wrangler.jsonc` points to it. Set `name` in that configuration to the Worker name you want in your account. Deploying to an existing name updates that Worker.

From this folder:

```sh
npm install --save-dev wrangler
npx wrangler login
npm run deploy
```

Wrangler opens your browser for Cloudflare login and prints the URL after deployment. Internet access and your own Cloudflare account are required. No D1, KV, R2, or secrets are needed. This standalone configuration publishes to your account's workers.dev address; the original private site's access policy is not included. Configure Cloudflare Access separately for private access.

Reference: [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and [configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Edit and rebuild

Edit files in `src/`, then run:

```sh
npm run build
npm run validate
npm start
```

Restart the local server after rebuilding. The build embeds source and images into `worker/index.js`. Optional checks:

```sh
npm run test:audio
npm run test:mechanics
```

The mechanics checks use real Three.js math and raycasting with mocked browser rendering. They do not replace checking graphics and sound in your browser.

## Included

- `worker/index.js`: complete prebuilt Cloudflare Worker.
- `src/`: editable game, textures, and vendored Three.js.
- `scripts/`: build, validation, and local server.
- `tests/`: gameplay and audio checks.
- `wrangler.jsonc`: standalone Cloudflare configuration.
- `GAME-GUIDE.md`: controls and gameplay details.
- `src/vendor/LICENSE`: Three.js MIT license.

Checkpoints and settings are stored per browser and site address. Existing hosted-game progress does not automatically transfer to localhost or a new domain.

# Palm Prix — Cloud Carnival

A Three.js kart racer controlled with your webcam or keyboard. The current course is a floating amusement park: a 397-metre ribbon road above painted cloud banks, with a moving carousel, sculpted horses, wind-up airship, balloon fleet, island gardens and a flowing waterfall tunnel.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:5173. For the production client, run `npm run build` followed by `npm run preview`. Camera permission works on localhost; remote hosting requires HTTPS. Tracking downloads MediaPipe's WASM runtime and model at startup. Keyboard racing works without camera permission.

## Controls

- **Two closed fists:** accelerate. Rotate the line between your hands like a steering wheel.
- **Open either palm:** brake forward motion, then reverse while held. Reverse tops out at 8m/s (29km/h).
- **One fist, uncertain pose or lost tracking:** release the pedals and coast; steering recenters gradually.
- **WASD / arrow keys:** drive and brake. Keyboard pedals override hand pedals.
- **Shift + turn:** drift; release a charged drift for a mini turbo.
- **Space / thumb flick:** item boost, with a cooldown.

Use Set up hand controls, keep your wrists and all fingers visible, close both fists at shoulder width, and save your neutral wheel position. The camera overlay draws all 21 landmarks and shows measured tracking/inference latency. Physical webcam performance depends on lighting, camera quality and hardware; synthetic tests do not establish real-hand recognition accuracy.

## Course and graphics

The 16-metre racing surface follows a shared flowing spline with changing corner direction. Four directional boost strips and eighteen collectible tokens per lap reward line choice. The race ends after three ordered laps against five scripted rivals.

The active world uses original curved carnival architecture, instanced carousel horses, a decorated start gateway, a wind-up toy airship with animated propellers, floating textured islands, translucent animated water and a painted sky panorama. The older stadium and asphalt remain in the source tree but are not mounted. Driver avatar personalization is deferred.

Third-party assets are local CC0 Kenney kart/driver and garden models plus Poly Haven cliff textures. The sky painting is original AI-generated project artwork; it is documented separately from third-party CC0 assets. Use the in-game Credits button, [full asset credits](public/assets/ASSET-CREDITS.md), and [artwork provenance and generation prompt](public/assets/cloud-carnival/ARTWORK.md). The reusable checkout uses original and CC0 art. An optional personal-only model set is documented below.

## Performance and validation

Physics uses a fixed 120Hz step with interpolation. The Three.js frame loop owns simulation and visual motion, and React receives HUD snapshots at 10Hz. Camera inference runs in a CPU worker with at most one resized 640px frame in flight. Deadline-based capture targets 30Hz, dropping to 20Hz when inference takes longer; stale frames never revive driving input.

```sh
npm test
npm run build
npm run lint
```

Tests cover acceleration and braking, reverse, drift rewards, frame-rate independence, barrier containment, ordered laps, the full-width course corridor, rotated fist poses, tracking identity and occlusion, capture cadence, runtime/HUD separation, boost/token sweeps and local asset resources. Lint reports existing React compiler warnings around imperative Three.js updates; production builds retain a main-chunk size warning.

Development diagnostics are DOM data attributes on the page root: `data-race-fps`, `data-race-frame-p95`, `data-race-draw-calls`, and `data-race-triangles`. They add no visible debug HUD.

This remains an evolving browser racing game. Rivals are scripted; kart-to-kart collision, weapon items and multiplayer are not implemented. Visual quality is an aspiration, not a verified claim of parity with a commercial Mario Kart release.

## Privacy and optional avatar backend

Continuous tracking frames stay in the browser. The deferred avatar studio can send one explicitly approved still to the optional Express `/api/stylize` endpoint. `npm run dev` also starts that server on port8787; it is not required for keyboard racing or hand detection. Set `FAL_KEY` in the server environment to enable its cloud generation path; never expose a secret through a `VITE_` variable. `/api/health` reports backend availability.

OpenWii was reviewed as a handling reference: https://github.com/pattssun/OpenWii. Handling was implemented independently.

## Optional personal Nintendo models

The owner's local noncommercial build additionally uses Models Resource's textured Teddy Buggy, Sweet Sweet hot-air balloon and Aqua Cup Ride. Nintendo owns the game artwork; uploaded-model contributor credits, source links and usage limits are in [personal model credits](public/assets/personal/CREDITS.md). These are **not CC0**. Downloaded archives, converted model binaries and the local manifest are excluded from Git; the regular checkout retains the original/CC0 fallback scene.

After downloading/extracting the archives as described in that credits file, run:

```sh
blender --background --python scripts/prepare-personal-props.py -- --asset sweet-balloon
blender --background --python scripts/prepare-personal-props.py -- --asset aqua-cups
blender --background --python scripts/prepare-personal-kart.py
```

Create `public/assets/personal/manifest.json` with `balloon`, `cups` and `kart` pointing to `/assets/personal/sweet-balloon.glb`, `/assets/personal/aqua-cups.glb` and `/assets/personal/teddy-buggy.glb`. Set `VITE_PERSONAL_ASSETS=true` in the ignored `.env.local`, then restart or rebuild. Missing personal assets fall back to the regular art. Set the flag false before preparing a reusable/public build. The current local production preview is the personal build requested by the owner.

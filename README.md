# Palm Prix — Afterglow City

A Three.js kart racer controlled with your webcam or keyboard. Afterglow City is a cohesive neon sunset circuit with a coastal skyway, covered night market, terraced city blocks and an observatory halo. The sunset, architecture, racers and landmarks are modeled geometry and procedural materials; no surrounding photographic panorama is used.

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

The 16-metre racing surface follows a 430.8-metre horizontal spline with changing corner direction. Smooth ramps climb to a ten-metre coastal skyway and a separate five-metre terrace. Modest banking, visible bridge supports, suspension cables, a roofed market arcade and planted city blocks give the lap distinct spaces. Four directional boost strips, eighteen collectible tokens per lap, two construction islands and a crossing traffic drone reward line choice. The race ends after three ordered laps against five scripted rivals.

The active world uses original art-deco architecture and signs, beveled wedge karts with helmeted pilots, a geometric striped sun, procedural water, HDR neon bloom and a unified indigo/cyan/magenta/orange interface. The road mesh, racers, camera, effects, rewards and hazards share the same elevation surface. Driving remains a grounded arcade simulation in XZ; this is not an anti-gravity, airborne or branching-route implementation. Driver avatar personalization is deferred.

Active Afterglow City artwork was authored for this project. Older CC0 Kenney/Poly Haven assets and the Cloud Carnival painting remain archived in the source tree with their credits; they are not mounted by the active race. See the in-game Credits button and [full asset credits](public/assets/ASSET-CREDITS.md). No new third-party models were needed for this redesign.

## Performance and validation

Physics uses a fixed 120Hz step with interpolation. The Three.js frame loop owns simulation and visual motion, and React receives HUD snapshots at 10Hz. Camera inference runs in a CPU worker with at most one resized 640px frame in flight. Deadline-based capture targets 30Hz, dropping to 20Hz when inference takes longer; stale frames never revive driving input.

HDR bloom uses a shared postprocessing pipeline with two-sample antialiasing. After shader warm-up, sustained frame times above the 55fps budget gradually reduce only the 3D render targets to a minimum 75% resolution. The HTML HUD stays native and geometry/physics do not change. Fast displays can restore full resolution. `data-race-render-scale` exposes the current scale for profiling.

```sh
npm test
npm run build
npm run lint
```

Tests cover acceleration and braking, reverse, drift rewards, frame-rate independence, barrier containment, ordered laps, the full-width course corridor, seamless elevation/grade/banking, elevated reward/hazard alignment, swept obstacle collisions and runtime reset, rotated fist poses, tracking identity and occlusion, capture cadence, runtime/HUD separation, boost/token sweeps and retained local asset resources. Lint reports existing React compiler warnings around imperative Three.js updates; production builds retain a main-chunk size warning.

Development diagnostics are DOM data attributes on the page root: `data-race-fps`, `data-race-frame-p95`, `data-race-draw-calls`, and `data-race-triangles`. They add no visible debug HUD.

This remains an evolving browser racing game. Rivals are scripted; kart-to-kart collision, weapon items and multiplayer are not implemented. Visual quality is an aspiration, not a verified claim of parity with a commercial Mario Kart release.

## Privacy and optional avatar backend

Continuous tracking frames stay in the browser. The deferred avatar studio can send one explicitly approved still to the optional Express `/api/stylize` endpoint. `npm run dev` also starts that server on port8787; it is not required for keyboard racing or hand detection. Set `FAL_KEY` in the server environment to enable its cloud generation path; never expose a secret through a `VITE_` variable. `/api/health` reports backend availability.

OpenWii was reviewed as a handling reference: https://github.com/pattssun/OpenWii. Handling was implemented independently.

## Archived personal Nintendo models

The earlier local noncommercial Carnival scene used Models Resource's textured Teddy Buggy, Sweet Sweet hot-air balloon and Aqua Cup Ride. They are not loaded by Afterglow City, including when the older environment flag remains enabled. Nintendo owns that artwork; uploaded-model contributor credits, source links and usage limits are in [personal model credits](public/assets/personal/CREDITS.md). These are **not CC0**. Downloaded archives, converted model binaries and the local manifest remain excluded from Git.

After downloading/extracting the archives as described in that credits file, run:

```sh
blender --background --python scripts/prepare-personal-props.py -- --asset sweet-balloon
blender --background --python scripts/prepare-personal-props.py -- --asset aqua-cups
blender --background --python scripts/prepare-personal-kart.py
```

The archived components read `public/assets/personal/manifest.json` and the older `VITE_PERSONAL_ASSETS` flag. Re-enabling those components requires an intentional scene change; that flag alone does not alter the active neon race.

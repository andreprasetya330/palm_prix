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

The active world uses original art-deco architecture and signs, a geometric striped sun, procedural water, HDR neon bloom and a unified indigo/cyan/magenta/orange interface. Original beveled racers remain the public fallback. The owner's optional personal build uses Circuit Special bodies and posed Mario Kart Tour Mii drivers, with distinct matching kart/suit colors for every rival and original Palm Prix wheels/tires. The road mesh, racers, camera, effects, rewards and hazards share the same elevation surface. Driving remains a grounded arcade simulation in XZ; this is not an anti-gravity, airborne or branching-route implementation. Driver face personalization is deferred.

Afterglow City's environment was authored for this project. Optional Nintendo racers are local personal assets, not CC0; they and their original contributors are credited in [personal model credits](public/assets/personal/CREDITS.md). Extracted binaries are ignored by Git. Older CC0 Kenney/Poly Haven assets and the Cloud Carnival painting remain archived with their credits. See the in-game Credits button and [full asset credits](public/assets/ASSET-CREDITS.md).

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

## Optional personal Circuit Special / Mii racers

Download Circuit Special (Models Resource asset342345) and Mario Kart Tour Mii (asset351442), extract into `assets/source/personal/circuit-special/` and `assets/source/personal/tour-mii/`, then run:

```sh
blender --background --python scripts/prepare-circuit-racer.py
```

Set `VITE_PERSONAL_ASSETS=true` in ignored `.env.local` and rebuild. This loads the local embedded-texture `public/assets/personal/circuit-special.glb`. Without the flag or model, each racer safely falls back to the original model. The player is cyan; CORAL, VOLT, AZURE, ORCHID and MINT have matching paint, suit and rim accents. Skin/visor, white stripes and dark carbon remain unchanged. All six instances share geometry/maps and animate only steering/spinning wheel pivots. Nintendo owns the source art; full contributor credits and personal-use notes are retained in [personal/CREDITS.md](public/assets/personal/CREDITS.md).

## Archived personal Carnival models

The earlier local noncommercial Carnival scene used Models Resource's textured Teddy Buggy, Sweet Sweet hot-air balloon and Aqua Cup Ride. They are not loaded by Afterglow City, including when the older environment flag remains enabled. Nintendo owns that artwork; uploaded-model contributor credits, source links and usage limits are in [personal model credits](public/assets/personal/CREDITS.md). These are **not CC0**. Downloaded archives, converted model binaries and the local manifest remain excluded from Git.

After downloading/extracting the archives as described in that credits file, run:

```sh
blender --background --python scripts/prepare-personal-props.py -- --asset sweet-balloon
blender --background --python scripts/prepare-personal-props.py -- --asset aqua-cups
blender --background --python scripts/prepare-personal-kart.py
```

The archived Carnival components read `public/assets/personal/manifest.json`. They are not mounted in the active city. The personal-assets flag now selects the Circuit Special/Mii racer; restoring the older Carnival props requires an intentional scene change.

## Afterglow Grand Prix

The expanded circuit is 764 metres per lap across seven connected districts: Marina Launch, Coastal Skyway, Sunset Switchbacks, Uptown Ascent, Rooftop Run, Night Market and Neon Mile. The road climbs through smooth banked ramps to 24 metres. Explore the circuit from the menu to preview each section.

Collect amber Turbo or cyan Phase Shield cells, then press Space (or use the hand item gesture) to activate the held ability. Turbo lasts two seconds; Phase Shield passes through course hazards for 4.5 seconds. With an empty slot, Space uses the rechargeable boost. Hold Shift while turning to charge one of three drift tiers, then release for a mini turbo.

The new score, wind/road layers, engine voices, pickup chimes and drift cues are original procedural WebAudio; no external recording or music download is used. Sound begins after pressing Let's Race and can be muted in the header. The UI stays at full resolution while the 3D render budget adapts under sustained load.

## CPU racing

Rivals use a shared fixed-step race state for their rendered positions, minimap and standings. Each driver has a different straight-line pace and cornering grip. They anticipate bends, choose lanes around hazards and traffic, draft, and deploy short boosts on straights. Their bounded pace adjustment (at most 2.2 m/s) responds to a moving player's gap; it never changes their position directly. CPU boost speed stays below the player's boost speed. Finished rivals retain their finishing order, and every rematch starts from a fresh grid.

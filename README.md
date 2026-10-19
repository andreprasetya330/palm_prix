# Palm Kart (kart-cv)

Browser MVP scaffold: **webcam hand-tracking kart racing** with wheel-style fist steering and optional **cloud AI** cartoon selfie avatars.

Stack: Vite + React + TypeScript · MediaPipe Hands (`@mediapipe/tasks-vision`) · Three.js (`@react-three/fiber` + `@react-three/drei`) · tiny Express stylize proxy (fal.ai).

## Quick start

```bash
cd kart-cv
cp .env.example .env   # optional: add FAL_KEY for real stylize
npm install
npm run dev            # Vite :5173 + stylize API :8787
```

Open **http://localhost:5173** (HTTPS not required on localhost for `getUserMedia`).

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Concurrently runs stylize server + Vite (proxies `/api` → `:8787`) |
| `npm run dev:client` | Vite only |
| `npm run server` | Stylize API only |
| `npm run build` | Production client build |
| `npm run preview` | Preview production build (still need `npm run server` for stylize) |

## Environment variables

| Var | Where | Required | Purpose |
| --- | --- | --- | --- |
| `FAL_KEY` | server `.env` / shell | No (placeholder if missing) | fal.ai API key — **never** commit or use `VITE_` prefix |
| `FAL_STYLIZE_MODEL` | server | No | Defaults to `fal-ai/flux/dev/image-to-image` |
| `STYLIZE_PORT` | server | No | Defaults to `8787` |
| `VITE_STYLIZE_MODE` | client | No | Set to `local` to skip API and use canvas posterize fallback |

Load server env yourself (`export FAL_KEY=...` or a dotenv tool). The Express process reads `process.env.FAL_KEY`.

### fal model

Default stylize model id: **`fal-ai/flux/dev/image-to-image`**

Prompt asks for a cartoon/anime driver portrait. Override with `FAL_STYLIZE_MODEL` if you prefer another fal img2img endpoint.

## Controls

**Hands (preferred)**

- Two fists = steering wheel; twist left/right (wheel angle vs calibrated neutral) — **not** palm-X.
- Fists in chest–shoulder “drive zone” → accelerate; drop / pull back → brake.
- Thumb flick → boost item (edge-triggered).
- One fist → yaw fallback. Lost tracking → steer decays (~200ms).

**Keyboard fallback:** WASD / arrow keys · Space = boost.

Calibrate: menu → Calibrate → **Save neutral pose** with level fists.

## Privacy

- Continuous webcam frames for hand tracking stay **in the browser** (MediaPipe WASM).
- Avatar stylize sends **one still** to `POST /api/stylize` only after explicit opt-in.
- “Clear my data” removes the cached avatar from `localStorage`.

## Project layout

```
kart-cv/
  server/index.ts          # /api/stylize + /api/health
  src/vision/              # camera, MediaPipe, wheel GestureMapper, debug overlay
  src/game/                # ControlState, arcade kart, race loop stub
  src/scene/               # R3F track, kart, follow camera
  src/avatar/              # stylize client + local filter fallback
  src/ui/                  # menu, avatar studio, calibrate, HUD
```

## What’s real vs stubbed

| Feature | Status |
| --- | --- |
| Webcam + MediaPipe Hands (2 hands) + skeleton / wheel overlay | **Real** |
| Wheel-angle `ControlState` + keyboard merge | **Real** |
| Three.js oval track, kart, chase camera, arcade move | **Real** (minimal art) |
| Countdown → drive → finish (checkpoint laps) | **Stub / minimal** (2 laps, no AI opponent) |
| Avatar capture → `POST /api/stylize` → driver texture | **Real path**; placeholder SVG if no `FAL_KEY`; local posterize on error |
| Items / SFX / dummy AI / polish | **Stubbed / deferred** |
| Online multiplayer | **Not in MVP** (`ControlState` kept clean for Phase 2) |

## API

`POST /api/stylize` — multipart field `image` → `{ ok, imageUrl, placeholder? }`

`GET /api/health` — `{ ok, falConfigured, model }`

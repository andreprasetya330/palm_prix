import type { KartState } from '../../game/kartPhysics'
import type { RaceStatus } from '../../game/raceLoop'
import { ITEM_BOXES, POND, SAND, ovalRadius } from '../vfx/world'
import './hud.css'

export type Rival = { x: number; z: number }

type Props = {
  race: RaceStatus
  kart: KartState
  rivals?: Rival[]
}

const BOOST_TOP = 28 * 1.45

export function RaceHud({ race, kart, rivals = [] }: Props) {
  const boosting = kart.boostTimer > 0
  const place = placeWhenContested(kart, rivals)
  const pace = Math.min(100, Math.round((Math.abs(kart.speed) / BOOST_TOP) * 100))
  const fill = pace
  const count = Math.max(1, Math.ceil(race.countdown))
  const go = race.phase === 'racing' && race.elapsed < 1.05
  const showCount = race.phase === 'countdown' || go

  return (
    <div className={`pp-race${boosting ? ' is-boost' : ''}`}>
      {place != null && (
        <div className="pp-place">
          <span>Place</span>
          <strong>
            {place}
            <sup>{ordinal(place)}</sup>
          </strong>
        </div>
      )}
      <div className="pp-ticket">
        <div className="pp-laps">
          <span>Lap</span>
          <div className="pp-pips" aria-label={`Lap ${race.lap} of ${race.totalLaps}`}>
            {Array.from({ length: race.totalLaps }, (_, i) => {
              const n = i + 1
              const mode = n < race.lap ? 'done' : n === race.lap ? 'now' : 'next'
              return <i key={n} className={`pp-pip is-${mode}`} />
            })}
          </div>
        </div>
        <div className="pp-time">
          <span>Time</span>
          <strong>{formatTime(race.elapsed)}</strong>
        </div>
      </div>

      {showCount && (
        <div className={`pp-count${go ? ' is-go' : ` is-${count}`}`}>
          <div className="pp-count-burst" key={go ? 'go' : count}>
            <b>{go ? 'GO' : count}</b>
          </div>
        </div>
      )}

      {boosting && race.phase === 'racing' && (
        <div className="pp-skyword">Zephyr</div>
      )}

      {race.phase === 'finish' && (
        <div className="pp-clear">
          <span>Palm Prix</span>
          <strong>Heat clear</strong>
          <em>{formatTime(race.elapsed)}</em>
        </div>
      )}

      <MiniMap kart={kart} />

      <div className={`pp-pace${boosting ? ' is-hot' : ''}`}>
        <div className="pp-pace-top">
          <span>Pace</span>
          <strong>{pace}</strong>
        </div>
        <div className="pp-pace-track">
          <div className="pp-pace-fill" style={{ width: `${fill}%` }} />
        </div>
      </div>

      <div className={`pp-slot${boosting ? ' is-burst' : ''}`}>
        <div className="pp-slot-frame" aria-label={boosting ? 'Zephyr burst' : 'Zephyr ready'}>
          <ZephyrIcon />
        </div>
        <div className="pp-slot-meta">
          <span>Item</span>
          <strong>Zephyr</strong>
          <em>{boosting ? 'Burst' : 'Ready'}</em>
        </div>
      </div>
    </div>
  )
}

const MAP_X = 7.6
const MAP_Z = 2.55

function MiniMap({ kart }: { kart: KartState }) {
  const px = (x: number) => 230 + x * MAP_X
  const py = (z: number) => 78 - z * MAP_Z
  const rx = (r: number) => r * 1.15 * MAP_X
  const ry = (r: number) => r * MAP_Z
  const dot = ribbonDot(kart.x, kart.z)
  const yaw = (kart.yaw * 180) / Math.PI
  return (
    <div className="pp-map" aria-label="Oval course">
      <svg viewBox="0 0 460 156">
        <rect width="460" height="156" rx="18" className="pp-map-grass" />
        <ellipse cx="230" cy="78" rx={rx(21.85)} ry={ry(21.85)} className="pp-map-asphalt" />
        <ellipse cx="230" cy="78" rx={rx(14.15)} ry={ry(14.15)} className="pp-map-infield" />
        <ellipse
          cx="230"
          cy="78"
          rx={rx(18)}
          ry={ry(18)}
          fill="none"
          stroke="#ffe566"
          strokeWidth="2.2"
          strokeDasharray="7 5"
        />
        {CURBS.map((c, i) => (
          <rect
            key={i}
            x={-3.3}
            y={-1.5}
            width="6.6"
            height="3"
            className={c.red ? 'pp-map-curb-red' : 'pp-map-curb-white'}
            transform={`translate(${px(c.x)} ${py(c.z)}) rotate(${c.deg})`}
          />
        ))}
        {SAND.map((s, i) => (
          <ellipse
            key={i}
            cx={px(s.x)}
            cy={py(s.z)}
            rx={s.radius * MAP_X * 0.45}
            ry={s.radius * MAP_Z * 0.45}
            className="pp-map-sand"
          />
        ))}
        <ellipse
          cx={px(POND.x)}
          cy={py(POND.z)}
          rx={POND.radius * MAP_X}
          ry={POND.radius * MAP_Z}
          className="pp-map-pond"
        />
        <rect x={px(0) - 2.2} y={py(18) - 7} width="4.4" height="14" className="pp-map-start" />
        {ITEM_BOXES.map((b, i) => (
          <rect
            key={i}
            x={px(b.x) - 3.2}
            y={py(b.z) - 3.2}
            width="6.4"
            height="6.4"
            className="pp-map-box"
          />
        ))}
        <g transform={`translate(${px(dot.x)} ${py(dot.z)}) rotate(${yaw})`}>
          <circle r="7.2" className="pp-map-kart" />
          <path d="M0 -7.2 L0 -14" className="pp-map-heading" />
        </g>
      </svg>
    </div>
  )
}

const CURBS = Array.from({ length: 64 }, (_, i) => {
  const t = (i / 64) * Math.PI * 2
  const r = 23.2
  return {
    x: Math.sin(t) * r * 1.15,
    z: Math.cos(t) * r,
    deg: (t * 180) / Math.PI,
    red: i % 2 === 0,
  }
})

/** Off the asphalt, the dot sits on this oval's centerline. */
function ribbonDot(x: number, z: number) {
  const r = ovalRadius(x, z)
  if (r > 14.15 && r < 21.85) return { x, z }
  const s = 18 / Math.max(r, 0.001)
  return { x: x * s, z: z * s }
}

function ZephyrIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M8 40c10-1 16 3 22 8"
        fill="none"
        stroke="#fffaf0"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M12 48c12-2 20 1 28 7"
        fill="none"
        stroke="#ff8a3d"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="40" cy="30" r="14" fill="#ffc83d" />
      <path d="M40 16c2 7-1 12-7 14 7 0 12-3 14-10-2 2-5 2-7-4z" fill="#1f9e45" />
    </svg>
  )
}

/** A solo heat has nobody to pass, so it does not claim a place. */
function placeWhenContested(kart: KartState, rivals: Rival[]): number | null {
  if (rivals.length === 0) return null
  const mine = trackAngle(kart.x, kart.z)
  let ahead = 0
  for (const rival of rivals) {
    if (trackAngle(rival.x, rival.z) > mine) ahead += 1
  }
  return ahead + 1
}

function trackAngle(x: number, z: number): number {
  const ang = Math.atan2(x / 1.15, z)
  return ang < 0 ? ang + Math.PI * 2 : ang
}

function ordinal(n: number): string {
  const teen = n % 100
  if (teen >= 11 && teen <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const rem = safe - m * 60
  const whole = Math.floor(rem)
  const tenth = Math.floor((rem - whole) * 10)
  return `${m}:${whole.toString().padStart(2, '0')}.${tenth}`
}


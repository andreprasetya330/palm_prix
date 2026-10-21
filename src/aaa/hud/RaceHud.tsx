import { useEffect, useState } from 'react'
import type { KartState } from '../../game/kartPhysics'
import type { RaceStatus } from '../../game/raceLoop'
import { ITEM_BOXES, POND, ovalRadius } from '../vfx/world'
import './hud.css'

type Props = {
  race: RaceStatus
  kart: KartState
}

const BOOST_TOP = 28 * 1.45

export function RaceHud({ race, kart }: Props) {
  const camLive = useWebcamLive()
  const boosting = kart.boostTimer > 0
  const pace = Math.min(100, Math.round((Math.abs(kart.speed) / BOOST_TOP) * 100))
  const fill = pace
  const count = Math.max(1, Math.ceil(race.countdown))
  const go = race.phase === 'racing' && race.elapsed < 1.05
  const showCount = race.phase === 'countdown' || go

  return (
    <div className={`pp-race${boosting ? ' is-boost' : ''}${camLive ? ' pp-cam-live' : ''}`}>
      <div className="pp-place">
        <span>Place</span>
        <strong>
          1<sup>st</sup>
        </strong>
      </div>

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

      {!camLive && (
        <div className="pp-keys">Keyboard</div>
      )}
    </div>
  )
}

function MiniMap({ kart }: { kart: KartState }) {
  const px = (x: number) => 88 + x * 2.72
  const py = (z: number) => 54 - z * 1.68
  const rx = (r: number) => r * 1.15 * 2.72
  const ry = (r: number) => r * 1.68
  const dot = ribbonDot(kart.x, kart.z)
  return (
    <div className="pp-map" aria-label="Oval map">
      <svg viewBox="0 0 176 108">
        <ellipse cx="88" cy="54" rx="84" ry="50" className="pp-map-grass" />
        <ellipse cx="88" cy="54" rx={rx(21.85)} ry={ry(21.85)} className="pp-map-asphalt" />
        <ellipse cx="88" cy="54" rx={rx(14.15)} ry={ry(14.15)} className="pp-map-infield" />
        <ellipse
          cx="88"
          cy="54"
          rx={rx(18)}
          ry={ry(18)}
          fill="none"
          stroke="#ffe566"
          strokeWidth="1.5"
          strokeDasharray="4 3.2"
        />
        <ellipse
          cx={px(POND.x)}
          cy={py(POND.z)}
          rx={POND.radius * 2.72}
          ry={POND.radius * 1.68}
          className="pp-map-pond"
        />
        {ITEM_BOXES.map((b, i) => (
          <rect
            key={i}
            x={px(b.x) - 1.8}
            y={py(b.z) - 1.8}
            width="3.6"
            height="3.6"
            className="pp-map-box"
          />
        ))}
        <circle cx={px(dot.x)} cy={py(dot.z)} r="3.5" className="pp-map-kart" />
      </svg>
    </div>
  )
}

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

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const rem = safe - m * 60
  const whole = Math.floor(rem)
  const tenth = Math.floor((rem - whole) * 10)
  return `${m}:${whole.toString().padStart(2, '0')}.${tenth}`
}

function useWebcamLive(): boolean {
  const [live, setLive] = useState(false)
  useEffect(() => {
    const tick = () => {
      const video = document.querySelector('.webcam-pip video')
      if (!(video instanceof HTMLVideoElement)) {
        setLive(false)
        return
      }
      const next = video.readyState >= 2 && video.videoWidth > 8
      setLive((prev) => (prev === next ? prev : next))
    }
    tick()
    const id = window.setInterval(tick, 400)
    return () => window.clearInterval(id)
  }, [])
  return live
}

import { useEffect, useRef, useState } from 'react'
import type { KartState } from '../../game/kartPhysics'
import type { RaceStatus } from '../../game/raceLoop'
import { ITEM_BOXES, POND } from '../vfx/world'
import './hud.css'

type Props = {
  race: RaceStatus
  kart: KartState
}

const BOOST_TOP = 28 * 1.45

export function RaceHud({ race, kart }: Props) {
  const camLive = useWebcamLive()
  const go = useGoFlash(race.phase)
  const boosting = kart.boostTimer > 0
  const pace = Math.round(Math.abs(kart.speed) * 8)
  const fill = Math.min(100, (Math.abs(kart.speed) / BOOST_TOP) * 100)
  const count = Math.max(1, Math.ceil(race.countdown))
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
  const px = (x: number) => 70 + (x / 34) * 54
  const py = (z: number) => 70 - (z / 34) * 54
  const yaw = (kart.yaw * 180) / Math.PI
  const rx = (r: number) => (r * 1.15 * 54) / 34
  const ry = (r: number) => (r * 54) / 34
  return (
    <div className="pp-map" aria-label="Oval map">
      <svg viewBox="0 0 140 140">
        <ellipse cx="70" cy="70" rx="64" ry="56" className="pp-map-grass" />
        <ellipse
          cx="70"
          cy="70"
          rx={rx(18)}
          ry={ry(18)}
          fill="none"
          stroke="#2c3142"
          strokeWidth={ry(8.2)}
        />
        <ellipse
          cx="70"
          cy="70"
          rx={rx(18)}
          ry={ry(18)}
          fill="none"
          stroke="#ffe566"
          strokeWidth="1.6"
          strokeDasharray="3.2 2.4"
        />
        <circle cx={px(POND.x)} cy={py(POND.z)} r={(POND.radius * 54) / 34} className="pp-map-pond" />
        {ITEM_BOXES.map((b, i) => (
          <rect
            key={i}
            x={px(b.x) - 2.2}
            y={py(b.z) - 2.2}
            width="4.4"
            height="4.4"
            className="pp-map-box"
          />
        ))}
        <g transform={`translate(${px(kart.x)} ${py(kart.z)}) rotate(${yaw})`}>
          <path d="M0 -6 L4.2 5 L0 2.6 L-4.2 5 Z" className="pp-map-kart" />
        </g>
      </svg>
    </div>
  )
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

function useGoFlash(phase: RaceStatus['phase']): boolean {
  const [go, setGo] = useState(false)
  const prev = useRef(phase)
  useEffect(() => {
    const from = prev.current
    prev.current = phase
    if (from !== 'countdown' || phase !== 'racing') return
    setGo(true)
    const id = window.setTimeout(() => setGo(false), 680)
    return () => {
      window.clearTimeout(id)
      prev.current = 'countdown'
    }
  }, [phase])
  return go
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadCachedAvatar } from './avatar/stylizeClient'
import { type ControlState } from './game/controlState'
import { DEFAULT_KART, stepKart, type KartState } from './game/kartPhysics'
import {
  createRaceStatus,
  updateCheckpoints,
  type RaceStatus,
} from './game/raceLoop'
import { RaceScene } from './scene/RaceScene'
import { AvatarStudio } from './ui/AvatarStudio'
import { CalibrateScreen } from './ui/CalibrateScreen'
import { Hud } from './ui/Hud'
import { WebcamPip } from './ui/WebcamPip'
import { loadCalibration, type Calibration } from './vision/calibration'
import { GestureMapper, mergeControls } from './vision/gestureMapper'
import { useHandTracker } from './vision/useHandTracker'
import { useKeyboardControls } from './vision/useKeyboardControls'
import './App.css'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, error, hands } = useHandTracker(videoRef)
  const readKeyboard = useKeyboardControls()
  const mapper = useMemo(() => new GestureMapper(), [])

  const [calibration, setCalibration] = useState<Calibration>(() =>
    loadCalibration(),
  )
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    loadCachedAvatar(),
  )
  const [race, setRace] = useState<RaceStatus>(() => createRaceStatus())
  const [kart, setKart] = useState<KartState>(DEFAULT_KART)
  const [control, setControl] = useState<ControlState>({
    steer: 0,
    throttle: 0,
    brake: 0,
    item: false,
  })
  const [showPip, setShowPip] = useState(true)

  const raceRef = useRef(race)
  const kartRef = useRef(kart)
  const calRef = useRef(calibration)
  const handsRef = useRef(hands)
  const phaseRef = useRef(race.phase)
  raceRef.current = race
  kartRef.current = kart
  calRef.current = calibration
  handsRef.current = hands
  phaseRef.current = race.phase

  // Vision → ControlState + race tick
  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dtMs = Math.min(50, now - last)
      last = now
      const dt = dtMs / 1000

      const handCtrl = mapper.update(handsRef.current, calRef.current, dtMs)
      const merged = mergeControls(handCtrl, readKeyboard())
      setControl(merged)

      const phase = phaseRef.current
      if (phase === 'countdown') {
        setRace((r) => {
          const countdown = r.countdown - dt
          if (countdown <= 0) {
            return { ...r, countdown: 0, phase: 'racing' }
          }
          return { ...r, countdown }
        })
      } else if (phase === 'racing') {
        const nextKart = stepKart(kartRef.current, merged, dt)
        setKart(nextKart)
        setRace((r) => {
          const withTime = { ...r, elapsed: r.elapsed + dt }
          return updateCheckpoints(withTime, nextKart.x, nextKart.z)
        })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mapper, readKeyboard])

  const startCountdown = () => {
    mapper.reset()
    setKart({ ...DEFAULT_KART })
    setRace({
      ...createRaceStatus(),
      phase: 'countdown',
      countdown: 3,
    })
  }

  const goMenu = () => {
    setRace(createRaceStatus())
    setKart({ ...DEFAULT_KART })
  }

  const inRace =
    race.phase === 'countdown' ||
    race.phase === 'racing' ||
    race.phase === 'finish'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Palm Prix</span>
          <span className="brand-sub">webcam hand-tracking kart · MVP scaffold</span>
        </div>
        <div className="topbar-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showPip}
              onChange={(e) => setShowPip(e.target.checked)}
            />
            Webcam PIP
          </label>
          <span className={`cam-status ${status}`}>{status}</span>
        </div>
      </header>

      <main className={`stage ${inRace ? 'racing' : ''}`}>
        {(inRace || race.phase === 'calibrate' || race.phase === 'avatar') && (
          <div className="scene-wrap">
            <RaceScene kart={kart} driverTextureUrl={avatarUrl} />
            {inRace && (
              <Hud
                race={race}
                kart={kart}
                control={control}
                debug={mapper.debug}
                showPipHint={mapper.debug.mode !== 'two-fist'}
              />
            )}
          </div>
        )}

        <div
          className={`pip-dock ${inRace ? 'corner' : 'hero'}`}
          style={showPip ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        >
          <WebcamPip
            videoRef={videoRef}
            hands={hands}
            wheelAngle={mapper.debug.wheelAngle}
            compact={inRace}
          />
          {error && showPip && <p className="cam-error">{error}</p>}
        </div>

        {race.phase === 'menu' && (
          <div className="panel menu">
            <h1>Palm Prix</h1>
            <p>
              Drive with a virtual steering wheel — two fists twist to steer.
              Camera stays local; only an opt-in selfie still hits the stylize
              API.
            </p>
            <ul className="privacy-list">
              <li>Hand video: in-browser MediaPipe only</li>
              <li>Avatar: one still, cloud fal via /api/stylize (opt-in)</li>
              <li>Keyboard fallback always on (WASD / arrows + Space)</li>
            </ul>
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() => setRace((r) => ({ ...r, phase: 'avatar' }))}
              >
                Avatar studio
              </button>
              <button
                type="button"
                onClick={() => setRace((r) => ({ ...r, phase: 'calibrate' }))}
              >
                Calibrate & race
              </button>
            </div>
            {status === 'denied' && (
              <p className="cam-error">
                Camera denied — use keyboard, or allow webcam and reload.
              </p>
            )}
          </div>
        )}

        {race.phase === 'avatar' && (
          <AvatarStudio
            videoRef={videoRef}
            currentAvatar={avatarUrl}
            onAvatar={setAvatarUrl}
            onBack={goMenu}
            onDone={() => setRace((r) => ({ ...r, phase: 'calibrate' }))}
          />
        )}

        {race.phase === 'calibrate' && (
          <CalibrateScreen
            hands={hands}
            control={control}
            debug={mapper.debug}
            calibration={calibration}
            onCalibration={setCalibration}
            onBack={goMenu}
            onDone={startCountdown}
          />
        )}

        {race.phase === 'finish' && (
          <div className="panel finish-panel">
            <div className="row">
              <button type="button" className="primary" onClick={startCountdown}>
                Rematch
              </button>
              <button type="button" onClick={goMenu}>
                Menu
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

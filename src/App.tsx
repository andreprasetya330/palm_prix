import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { loadDriverStyle, saveDriverStyle, type DriverStyle } from './avatar/driverStyle'
import { useRaceAudio } from './game/useRaceAudio'
import './App.css'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, error, hands, retry } = useHandTracker(videoRef)
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
  const [driverStyle, setDriverStyle] = useState<DriverStyle>(loadDriverStyle)
  const updateDriverStyle = (style: DriverStyle) => { setDriverStyle(style); saveDriverStyle(style) }
  const audio = useRaceAudio(kart, race)
  const [showPip, setShowPip] = useState(true)

  const kartRef = useRef(kart)
  const calRef = useRef(calibration)
  const handsRef = useRef(hands)
  const phaseRef = useRef(race.phase)
  useLayoutEffect(() => {
    kartRef.current = kart
    calRef.current = calibration
    handsRef.current = hands
    phaseRef.current = race.phase
  }, [kart, calibration, hands, race.phase])

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
    void audio.enable()
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
          <span className="brand-sub">THE ISLAND CIRCUIT</span>
        </div>
        <div className="topbar-actions">
          <button className="retry-camera" onClick={audio.toggleMute}>{audio.muted ? 'Sound off' : 'Sound on'}</button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showPip}
              onChange={(e) => setShowPip(e.target.checked)}
            />
            Camera view
          </label>
          <span className={`cam-status ${status}`}>{status === 'ready' ? 'Hands ready' : status === 'loading' ? 'Connecting camera' : 'Keyboard ready'}</span>
          {(status === 'error' || status === 'denied') && <button className="retry-camera" onClick={retry} title={error ?? 'Retry camera'}>Retry camera</button>}
        </div>
      </header>

      <main className={`stage ${inRace ? 'racing' : ''}`}>
        {(
          <div className={`scene-wrap ${race.phase === 'menu' ? 'showcase' : ''}`}>
            <RaceScene driverStyle={driverStyle} kart={kart} driverTextureUrl={avatarUrl} race={race} showcase={race.phase === 'menu'} />
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
          className={`pip-dock ${inRace ? 'corner' : 'hero'} ${race.phase === 'menu' ? 'menu-pip' : ''}`}
          style={showPip && status === 'ready' ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
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
            <div className="eyebrow"><span /> SEASIDE GRAND PRIX / VOL. 01</div>
            <h1>GOOD TIMES.<br /><em>FULL THROTTLE.</em></h1>
            <p className="menu-description">An island escape with a competitive streak. Take the wheel with your hands and chase the perfect lap.</p>
            <div className="circuit-card"><span className="circuit-icon">↗</span><div><small>YOUR NEXT DESTINATION</small><strong>Sunset Palms</strong><span>Coastal S-curves · 3 laps · 6 racers</span></div><span className="difficulty">150<small>CC</small></span></div>
            <div className="row menu-actions">
              <button type="button" className="primary" onClick={startCountdown}>LET’S RACE <span>→</span></button>
              <button type="button" onClick={() => setRace(r => ({ ...r, phase: 'calibrate' }))}>Set up hand controls</button>
            </div>
            <div className="menu-secondary"><button type="button" onClick={() => setRace(r => ({ ...r, phase: 'avatar' }))}>Customize driver ↗</button><span>Two fists to accelerate · Open palms to brake</span></div>
            <p className="privacy-note">Hand tracking runs on your device. Your camera feed stays yours.</p>
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
            currentStyle={driverStyle}
            onStyleChange={updateDriverStyle}
            onEnableCamera={retry}
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
        {inRace && <button className="exit-race" onClick={goMenu}>← Paddock</button>}
        {race.phase === 'menu' && <div className="edition">PALM PRIX <span>RACE THE SUN.</span></div>}
      </main>
    </div>
  )
}

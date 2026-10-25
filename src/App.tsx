import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadCachedAvatar } from './avatar/stylizeClient'
import { type ControlState } from './game/controlState'
import { DEFAULT_KART, type KartState } from './game/kartPhysics'
import {
  createRaceStatus,
  type RaceStatus,
} from './game/raceLoop'
import { RaceScene } from './scene/RaceScene'
import {usePersonalAssets} from './scene/personalAssets'
const AvatarStudio=lazy(()=>import('./ui/AvatarStudio').then(module=>({default:module.AvatarStudio})))
import { CalibrateScreen } from './ui/CalibrateScreen'
import { AssetLoadingOverlay } from './ui/AssetLoadingOverlay'
import { Hud } from './ui/Hud'
import { WebcamPip } from './ui/WebcamPip'
import { loadCalibration, type Calibration } from './vision/calibration'
import { GestureMapper, mergeControls } from './vision/gestureMapper'
import { useHandTracker } from './vision/useHandTracker'
import { useKeyboardControls } from './vision/useKeyboardControls'
import { loadDriverStyle, saveDriverStyle, type DriverStyle } from './avatar/driverStyle'
import { createRuntime, resetRuntime } from './game/runtime'
import { useRaceAudio } from './game/useRaceAudio'
import './App.css'

export default function App() {
  const personalAssets=usePersonalAssets()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraEnabled,setCameraEnabled] = useState(false)
  const { status, error, hands, retry } = useHandTracker(videoRef,cameraEnabled)
  const readKeyboard = useKeyboardControls()
  const mapper = useMemo(() => new GestureMapper(), [])

  const [calibration, setCalibration] = useState<Calibration>(() =>
    loadCalibration(),
  )
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    loadCachedAvatar(),
  )
  const [coins,setCoins] = useState(0)
  const [reward,setReward] = useState<string|null>(null)
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
  const audio = useRaceAudio(kart, race,coins)
  const [showCredits,setShowCredits] = useState(false)
  const [showPip, setShowPip] = useState(true)

  const runtime = useMemo(()=>createRuntime(), [])
  const calRef = useRef(calibration)
  const handsRef = useRef(hands)
  useLayoutEffect(() => {
    calRef.current = calibration
    handsRef.current = hands
    runtime.readControls = (dtMs) => mergeControls(mapper.update(handsRef.current,calRef.current,dtMs),readKeyboard())
    runtime.publish = () => {
      setCoins(runtime.rewards.coins)
      setReward(runtime.rewards.lastReward)
      setKart({...runtime.kart})
      setRace({...runtime.race})
      setControl({...runtime.control})
    }
  }, [runtime, mapper, readKeyboard, calibration, hands])

  const startCountdown = () => {
    void audio.enable()
    mapper.reset()
    resetRuntime(runtime,true)
  }
  const goMenu = () => { mapper.reset();resetRuntime(runtime) }
  const changePhase = (phase: RaceStatus['phase']) => {
    runtime.race.phase=phase;runtime.publish()
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
          <span className="brand-sub">CLOUD CARNIVAL</span>
        </div>
        <div className="topbar-actions">
          <button className="retry-camera" onClick={()=>setShowCredits(v=>!v)}>Credits</button>
          <button className="retry-camera" onClick={audio.toggleMute}>{audio.muted ? 'Sound off' : 'Sound on'}</button>
          <button className="retry-camera" onClick={()=>setCameraEnabled(v=>!v)}>{cameraEnabled ? 'Disable hands' : 'Enable hand controls'}</button>
          {cameraEnabled && <label className="toggle">
            <input
              type="checkbox"
              checked={showPip}
              onChange={(e) => setShowPip(e.target.checked)}
            />
            Camera view
          </label>}
          <span className={`cam-status ${status}`}>{status === 'ready' ? 'Hands ready' : status === 'loading' ? 'Connecting camera' : 'Keyboard ready'}</span>
          {(status === 'error' || status === 'denied') && <button className="retry-camera" onClick={retry} title={error ?? 'Retry camera'}>Retry camera</button>}
        </div>
      </header>

      <main className={`stage ${inRace ? 'racing' : ''}`}>
        {(
          <div className={`scene-wrap ${race.phase === 'menu' ? 'showcase' : ''}`}>
            <RaceScene runtime={runtime} showcase={race.phase === 'menu'} />
            {inRace && (
              <Hud
                race={race}
                coins={coins}
                reward={reward}
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
            <div className="eyebrow"><span /> CLOUD CARNIVAL / VOL. 03</div>
            <h1>HEAD IN THE CLOUDS.<br /><em>FULL THROTTLE.</em></h1>
            <p className="menu-description">A grand prix above the clouds. Chase golden tokens past carousel gardens, wind-up airships and a shimmering waterfall tunnel.</p>
            <div className="circuit-card"><span className="circuit-icon">↗</span><div><small>YOUR NEXT DESTINATION</small><strong>Cloud Carnival</strong><span>Floating roads + waterfall tunnel · 3 laps · 6 racers</span></div><span className="difficulty">150<small>CC</small></span></div>
            <div className="row menu-actions">
              <button type="button" className="primary" onClick={startCountdown}>LET’S RACE <span>→</span></button>
              <button type="button" onClick={() => {setCameraEnabled(true);changePhase('calibrate')}}>Set up hand controls</button>
            </div>
            <div className="menu-secondary"><span>ARROWS / WASD · SHIFT TO DRIFT · SPACE TO BOOST</span><span>Two fists to accelerate · Open palm to brake, then reverse</span></div>
            <p className="privacy-note">Hand tracking runs on your device. Your camera feed stays yours.</p>
            {status === 'denied' && (
              <p className="cam-error">
                Camera denied — use keyboard, or allow webcam and reload.
              </p>
            )}
          </div>
        )}

        {race.phase === 'avatar' && (
          <Suspense fallback={<div className="panel">Loading garage…</div>}><AvatarStudio
            videoRef={videoRef}
            currentAvatar={avatarUrl}
            currentStyle={driverStyle}
            onStyleChange={updateDriverStyle}
            onEnableCamera={()=>{setCameraEnabled(true);retry()}}
            onAvatar={setAvatarUrl}
            onBack={goMenu}
            onDone={() => changePhase('calibrate')}
          /></Suspense>
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
        {race.phase === 'menu' && <div className="edition">PALM PRIX <span>CHASE THE CHECKERED FLAG.</span></div>}
        {showCredits && <div className="credits-backdrop"><section className="panel credits-panel" role="dialog" aria-modal="true" aria-labelledby="credits-title">
          <div className="eyebrow">ASSETS & CONTRIBUTORS</div><h2 id="credits-title">Built to race. Full credits.</h2>
          <p>Karts, seated racers, wheels and color atlas by <a href="https://kenney.nl/assets/car-kit" target="_blank" rel="noreferrer">Kenney · Car Kit 3.1</a>.</p>
          <p>Island garden trees and mushrooms by <a href="https://kenney.nl/assets/nature-kit" target="_blank" rel="noreferrer">Kenney · Nature Kit</a>.</p>
          <p>Cliff surface detail from <a href="https://polyhaven.com/a/cliff_side" target="_blank" rel="noreferrer">Poly Haven</a>.</p>
          <p>The Kenney and Poly Haven assets are released under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0</a>, which permits personal and commercial reuse, modification and redistribution.</p>
          {Object.keys(personalAssets).length>0&&<p>This personal build also loads Nintendo Mario Kart 8 models from <a href="https://models.spriters-resource.com/wii_u/mariokart8/" target="_blank" rel="noreferrer">The Models Resource</a>: Teddy Buggy (BillyGaming964), Sweet Sweet Balloon and Aqua Cup Ride (Centrixe the Dodo). These game extracts are not CC0 or cleared for commercial use. <a href="/assets/personal/CREDITS.md" target="_blank" rel="noreferrer">Personal asset notes ↗</a></p>}
          <p>The floating circuit, original carousel and horses, wind-up airship, waterfall tunnel, signs and racing systems were built for Palm Prix. The cloud panorama is original AI-generated artwork. OpenWii was consulted as a handling reference.</p>
          <p><a href="/assets/ASSET-CREDITS.md" target="_blank" rel="noreferrer">View full asset sources and license notes ↗</a></p>
          <button type="button" className="primary" onClick={()=>setShowCredits(false)}>Back to the game</button>
        </section></div>}
        <AssetLoadingOverlay/>
      </main>
    </div>
  )
}

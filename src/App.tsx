import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {clearCachedAvatar} from './avatar/stylizeClient'
import {loadFaceProfile,saveFaceProfile,clearFaceProfile,type FaceProfile} from './avatar/faceProfile'
import { type ControlState } from './game/controlState'
import { DEFAULT_KART, type KartState } from './game/kartPhysics'
import {
  createRaceStatus,
  type RaceStatus,
} from './game/raceLoop'
import { RaceScene } from './scene/RaceScene'
const AvatarStudio=lazy(()=>import('./ui/AvatarStudio').then(module=>({default:module.AvatarStudio})))
import { CalibrateScreen } from './ui/CalibrateScreen'
import { AssetLoadingOverlay } from './ui/AssetLoadingOverlay'
import { Hud } from './ui/Hud'
import {RaceMenu} from './ui/RaceMenu'
import {CourseTour} from './ui/CourseTour'
import {COURSE_SECTORS} from './game/trackLayout'
import { WebcamPip } from './ui/WebcamPip'
import { loadCalibration, type Calibration } from './vision/calibration'
import { GestureMapper, mergeControls } from './vision/gestureMapper'
import { useHandTracker } from './vision/useHandTracker'
import { useKeyboardControls } from './vision/useKeyboardControls'
import { loadDriverStyle, saveDriverStyle, type DriverStyle } from './avatar/driverStyle'
import { createRuntime, resetRuntime } from './game/runtime'
import { useRaceAudio } from './game/useRaceAudio'
import {createAbilityState} from './game/abilities'
import './App.css'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraEnabled,setCameraEnabled] = useState(false)
  const [race, setRace] = useState<RaceStatus>(() => createRaceStatus())
  const { status, stage, error, hands, retry, trackingLatencyMs } = useHandTracker(videoRef,cameraEnabled&&race.phase!=='avatar')
  const readKeyboard = useKeyboardControls()
  const mapper = useMemo(() => new GestureMapper(), [])

  const [calibration, setCalibration] = useState<Calibration>(() =>
    loadCalibration(),
  )
  const [faceProfile,setFaceProfile]=useState(loadFaceProfile)
  const [coins,setCoins] = useState(0)
  const [impact,setImpact] = useState(false)
  const [reward,setReward] = useState<string|null>(null)
  const [kart, setKart] = useState<KartState>(DEFAULT_KART)
  const [control, setControl] = useState<ControlState>({
    steer: 0,
    throttle: 0,
    brake: 0,
    item: false,
  })
  const [driverStyle, setDriverStyle] = useState<DriverStyle>(loadDriverStyle)
  const updateDriverStyle = (style: DriverStyle) => { setDriverStyle(style); saveDriverStyle(style) }
  const applyDriver=(profile:FaceProfile,style:DriverStyle)=>{setFaceProfile(profile);updateDriverStyle(style);return saveFaceProfile(profile)}
  const [abilities,setAbilities]=useState(createAbilityState)
  const audio = useRaceAudio(kart, race,coins,abilities)
  const [showCredits,setShowCredits] = useState(false)
  const [showPip, setShowPip] = useState(true)
  const [tourSector,setTourSector]=useState<number|null>(null)

  const runtime = useMemo(()=>createRuntime(), [])
  const calRef = useRef(calibration)
  const handsRef = useRef(hands)
  useLayoutEffect(() => {
    calRef.current = calibration
    handsRef.current = hands
    runtime.readControls = (dtMs) => mergeControls(mapper.update(handsRef.current,calRef.current,dtMs),readKeyboard())
    runtime.publish = () => {
      setCoins(runtime.rewards.coins);setImpact(runtime.obstacles.flashTimer>0)
      setReward(runtime.rewards.lastReward)
      setKart({...runtime.kart})
      setRace({...runtime.race})
      setControl({...runtime.control})
      setAbilities({...runtime.abilities})
    }
  }, [runtime, mapper, readKeyboard, calibration, hands])

  const startCountdown = () => {
    setTourSector(null)
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
          <span className="brand-sub">AFTERGLOW CITY</span>
        </div>
        <div className="topbar-actions">
          <button className="retry-camera" onClick={()=>setShowCredits(v=>!v)}>Credits</button>
          <button className="retry-camera" onClick={audio.toggleMute}>{audio.muted ? 'Sound off' : 'Sound on'}</button>
          {race.phase!=='avatar'&&<><button className="retry-camera" onClick={()=>setCameraEnabled(v=>!v)}>{cameraEnabled ? 'Disable hands' : 'Enable hand controls'}</button>
          {cameraEnabled && <label className="toggle">
            <input
              type="checkbox"
              checked={showPip}
              onChange={(e) => setShowPip(e.target.checked)}
            />
            Camera view
          </label>}
          <span className={`cam-status ${status}`}>{cameraEnabled ? stage : 'Keyboard ready'}</span>
          {(status === 'error' || status === 'denied') && <button className="retry-camera" onClick={retry} title={error ?? 'Retry camera'}>Retry camera</button>}
          </>}
        </div>
      </header>

      <main className={`stage ${inRace ? 'racing' : ''}`}>
        {cameraEnabled && error && <div className="tracking-error" role="alert"><strong>Hand controls need attention</strong><p>{error}</p><button type="button" onClick={retry}>Retry camera</button></div>}
        {(
          <div className={`scene-wrap ${race.phase === 'menu' ? 'showcase' : ''}`}>
            <RaceScene runtime={runtime} showcase={race.phase === 'menu'} paused={race.phase==='avatar'} faceProfile={faceProfile} driverStyle={driverStyle} previewT={tourSector===null?undefined:(COURSE_SECTORS[tourSector].start+COURSE_SECTORS[tourSector].end)/2} />
            {inRace && (
              <Hud
                race={race}
                coins={coins}
                impact={impact}
                abilities={abilities}
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
          style={showPip && cameraEnabled && race.phase!=='avatar' ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        >
          <WebcamPip
            videoRef={videoRef}
            hands={hands}
            wheelAngle={mapper.debug.wheelAngle}
            compact={inRace}
            trackingLatencyMs={trackingLatencyMs}
            onRetry={retry}
            stage={stage}
          />
        </div>

        {race.phase === 'menu' && (tourSector===null?<RaceMenu onRace={startCountdown} onCustomize={()=>changePhase('avatar')} onTour={()=>setTourSector(0)} onSetup={() => {setCameraEnabled(true);changePhase('calibrate')}}/>:<CourseTour index={tourSector} onSelect={setTourSector} onBack={()=>setTourSector(null)} onRace={startCountdown}/>)}

        {race.phase === 'avatar' && (
          <Suspense fallback={<div className="panel">Loading garage…</div>}><AvatarStudio
            currentProfile={faceProfile}
            currentStyle={driverStyle}
            onApply={applyDriver}
            onClear={()=>{clearFaceProfile();clearCachedAvatar();setFaceProfile(null)}}
            onBack={goMenu}
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
          <div className="eyebrow">ASSETS & CONTRIBUTORS</div><h2 id="credits-title">Original art. Neon soul.</h2>
          <p>The city, sunset geometry, road, signs, arcade effects and fallback racers are original Palm Prix artwork.</p>


          <p>Earlier retained Kenney and Poly Haven assets are released under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0</a>, which permits personal and commercial reuse, modification and redistribution.</p>

          <p>The optional personal build uses Nintendo’s Circuit Special (Mario Kart 8), uploaded by BillyGaming964, and Mii (Mario Kart Tour), uploaded by Centrixe the Dodo, via Models Resource. Their matching kart/suit colors are adapted for this project; the wheels are original Palm Prix art. These extracts are not CC0 and remain local to the owner’s noncommercial build.</p>
          <p><a href="/assets/personal/CREDITS.md" target="_blank" rel="noreferrer">Personal model sources and contributor credits ↗</a>. OpenWii was consulted as a handling reference.</p>
          <p><a href="/assets/ASSET-CREDITS.md" target="_blank" rel="noreferrer">View full asset sources and license notes ↗</a></p>
          <button type="button" className="primary" onClick={()=>setShowCredits(false)}>Back to the game</button>
        </section></div>}
        <AssetLoadingOverlay/>
      </main>
    </div>
  )
}

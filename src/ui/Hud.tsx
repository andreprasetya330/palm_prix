import type { ControlState } from '../game/controlState'
import { driftTier, type KartState } from '../game/kartPhysics'
import { racePosition, RIVALS, rivalAngle, type RaceStatus } from '../game/raceLoop'
import { getTrackPoint, TRACK_SAMPLES, TRACK_BOUNDS } from '../game/trackLayout'
import {BOOST_PADS} from '../game/courseFeatures'
import type { MapperDebug } from '../vision/gestureMapper'
const mapScale=Math.min(128/(TRACK_BOUNDS.maxX-TRACK_BOUNDS.minX),112/(TRACK_BOUNDS.maxZ-TRACK_BOUNDS.minZ))
const mapX=(x:number)=>75+(x-(TRACK_BOUNDS.minX+TRACK_BOUNDS.maxX)/2)*mapScale
const mapZ=(z:number)=>70-(z-(TRACK_BOUNDS.minZ+TRACK_BOUNDS.maxZ)/2)*mapScale
type Props = { race: RaceStatus; kart: KartState; control: ControlState; debug: MapperDebug; showPipHint?: boolean; coins?:number;reward?:string|null }
export function Hud({ race, kart, control, debug,coins=0,reward }: Props) {
  const position = racePosition(race, kart.x, kart.z)
  const time = `${Math.floor(race.elapsed / 60).toString().padStart(2, '0')}:${(race.elapsed % 60).toFixed(2).padStart(5, '0')}`
  return <div className="hud">
    <div className="hud-top">
      <div className="hud-badge"><strong style={{fontSize:28}}>{position}</strong><span style={{opacity:.6}}> / 6</span></div>
      <div className="hud-badge"><small>LAP </small><strong>{race.lap}</strong> / {race.totalLaps}</div>
      <div className="hud-badge" style={{fontVariantNumeric:'tabular-nums'}}>{time}</div>
      <div className="hud-badge tokens">P · {coins}</div>
      {reward==='boost' && <div className="hud-badge boost">BOOST STRIP!</div>}
      {kart.drifting && <div className="hud-badge drift">DRIFT · {driftTier(kart.driftCharge ?? 0) || 'CHARGING'}</div>}
      {kart.boostTimer > 0 && <div className="hud-badge boost">BOOST!</div>}
    </div>
    <svg className="minimap" viewBox="0 0 150 140" aria-label="Circuit map">
      <path d={TRACK_SAMPLES.map((s,i)=>`${i ? 'L' : 'M'}${mapX(s.point.x)},${mapZ(s.point.z)}`).join(' ')+' Z'} fill="#092d3b99" stroke="#fff9e088" strokeWidth="7" strokeLinejoin="round" />
      {BOOST_PADS.map(p=><circle key={`pad-${p.id}`} cx={mapX(p.x)} cy={mapZ(p.z)} r="2" fill="#7cf2ff"/>)}
      {RIVALS.map((r,i) => {const p=getTrackPoint(rivalAngle(i,race.elapsed)/(Math.PI*2));return <circle key={r.name} cx={mapX(p.x)} cy={mapZ(p.z)} r="3.5" fill={r.color}/>})}
      <circle cx={mapX(kart.x)} cy={mapZ(kart.z)} r="5" fill="#f1ff81" stroke="white" strokeWidth="2"/>
    </svg>
    {kart.boostTimer > 0 && <div className="turbo-screen" aria-hidden="true"/>}
    {race.phase === 'countdown' && <div className="countdown" key={Math.ceil(race.countdown)}>{Math.ceil(race.countdown)}</div>}
    {race.phase === 'finish' && <div className="finish-banner"><div className="eyebrow">CLOUD CARNIVAL / COMPLETE</div><h2>{position === 1 ? 'VICTORY LAP.' : 'WHAT A RIDE.'}</h2><p>Finished {position} of 6 · {time}</p></div>}
    <div className="hud-bottom">
      <div className="speed-readout">{Math.round(Math.abs(kart.speed)*3.6)}<small>KM/H</small></div>
      <div className="hud-stats"><span>{kart.offroad ? 'OFF ROAD · FIND THE TARMAC' : kart.boostCooldown ? `BOOST RECHARGING · ${kart.boostCooldown.toFixed(1)}s` : 'BOOST READY · SPACE / THUMB FLICK'}</span></div>
      <div className="speed-bar"><div className="speed-fill" style={{width:`${Math.min(100,Math.abs(kart.speed)/46*100)}%`}} /></div>
      <div className="hud-stats tiny">{control.reverse ? (kart.speed > 0.2 ? 'OPEN PALM · BRAKING' : 'OPEN PALM · REVERSING') : debug.mode === 'two-fist' ? 'TWO FISTS · ACCELERATING' : 'WASD / ARROWS TO DRIVE'} · S / ↓ BRAKE · SHIFT + TURN TO DRIFT</div>
    </div>
  </div>
}

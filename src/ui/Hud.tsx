import type { ControlState } from '../game/controlState'
import type { KartState } from '../game/kartPhysics'
import { racePosition, RIVALS, rivalAngle, type RaceStatus } from '../game/raceLoop'
import type { MapperDebug } from '../vision/gestureMapper'
type Props = { race: RaceStatus; kart: KartState; control: ControlState; debug: MapperDebug; showPipHint?: boolean }
export function Hud({ race, kart, debug }: Props) {
  const position = racePosition(race, kart.x, kart.z)
  const time = `${Math.floor(race.elapsed / 60).toString().padStart(2, '0')}:${(race.elapsed % 60).toFixed(2).padStart(5, '0')}`
  return <div className="hud">
    <div className="hud-top">
      <div className="hud-badge"><strong style={{fontSize:28}}>{position}</strong><span style={{opacity:.6}}> / 6</span></div>
      <div className="hud-badge"><small>LAP </small><strong>{race.lap}</strong> / {race.totalLaps}</div>
      <div className="hud-badge" style={{fontVariantNumeric:'tabular-nums'}}>{time}</div>
      {kart.boostTimer > 0 && <div className="hud-badge boost">BOOST!</div>}
    </div>
    <svg className="minimap" viewBox="0 0 150 140" aria-label="Circuit map">
      <ellipse cx="75" cy="70" rx="57" ry="49" fill="#092d3b99" stroke="#fff9e055" strokeWidth="12" />
      {RIVALS.map((r,i) => <circle key={r.name} cx={75+Math.sin(rivalAngle(i,race.elapsed))*57} cy={70-Math.cos(rivalAngle(i,race.elapsed))*49} r="3.5" fill={r.color}/>)}
      <circle cx={75+kart.x/(18*1.15)*57} cy={70-kart.z/18*49} r="5" fill="#f1ff81" stroke="white" strokeWidth="2"/>
    </svg>
    {race.phase === 'countdown' && <div className="countdown" key={Math.ceil(race.countdown)}>{Math.ceil(race.countdown)}</div>}
    {race.phase === 'finish' && <div className="finish-banner"><div className="eyebrow">SUNSET PALMS / COMPLETE</div><h2>{position === 1 ? 'VICTORY LAP.' : 'WHAT A RIDE.'}</h2><p>Finished {position} of 6 · {time}</p></div>}
    <div className="hud-bottom">
      <div className="speed-readout">{Math.round(Math.abs(kart.speed)*3.6)}<small>KM/H</small></div>
      <div className="hud-stats"><span>{kart.offroad ? 'OFF ROAD · FIND THE TARMAC' : kart.boostCooldown ? `BOOST RECHARGING · ${kart.boostCooldown.toFixed(1)}s` : 'BOOST READY · SPACE / THUMB FLICK'}</span></div>
      <div className="speed-bar"><div className="speed-fill" style={{width:`${Math.min(100,Math.abs(kart.speed)/38*100)}%`}} /></div>
      <div className="hud-stats tiny">{debug.mode === 'two-fist' ? 'HANDS CONNECTED' : 'WASD / ARROWS TO DRIVE'} · S / ↓ BRAKE</div>
    </div>
  </div>
}

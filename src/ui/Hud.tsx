import {ChromeText} from './ChromeText'
import { useEffect, useRef, useState } from 'react'
import {ABILITY_PATHS} from '../game/abilityArt'
import {ABILITY_INFO,type Ability} from '../game/abilities'
import type { AbilityState } from '../game/abilities'
import type { ControlState } from '../game/controlState'
import { driftTier, type KartState } from '../game/kartPhysics'
import { racePosition, RIVALS, rivalAngle, type RaceStatus } from '../game/raceLoop'
import { getTrackPoint, TRACK_SAMPLES, TRACK_BOUNDS, getCourseSector, nearestTrack } from '../game/trackLayout'
import { BOOST_PADS } from '../game/courseFeatures'
import type { MapperDebug } from '../vision/gestureMapper'
import './RaceHud.css'
import './RetroHud.css'

const mapScale=Math.min(128/(TRACK_BOUNDS.maxX-TRACK_BOUNDS.minX),112/(TRACK_BOUNDS.maxZ-TRACK_BOUNDS.minZ))
const mapX=(x:number)=>75+(x-(TRACK_BOUNDS.minX+TRACK_BOUNDS.maxX)/2)*mapScale
const mapZ=(z:number)=>70-(z-(TRACK_BOUNDS.minZ+TRACK_BOUNDS.maxZ)/2)*mapScale
const mapPath=TRACK_SAMPLES.map((s,i)=>`${i?'L':'M'}${mapX(s.point.x)},${mapZ(s.point.z)}`).join(' ')+' Z'
export type HudAbilityState=Omit<AbilityState,'collected'>
type Props={race:RaceStatus;kart:KartState;control:ControlState;debug:MapperDebug;showPipHint?:boolean;coins?:number;reward?:string|null;impact?:boolean;abilities?:HudAbilityState}
function ItemIcon({kind='turbo'}:{kind?:Ability}) {
 return <svg viewBox="0 0 64 64" aria-hidden="true"><path d={ABILITY_PATHS[kind]} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></svg>
}
const clock=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toFixed(2).padStart(5,'0')}`
const ordinal=(n:number)=>n===1?'ST':n===2?'ND':n===3?'RD':'TH'
export function Hud({race,kart,control,debug,coins=0,reward,impact=false,abilities}:Props) {
  const position=racePosition(race,kart.x,kart.z),speed=Math.round(Math.abs(kart.speed)*3.6)
  const tier=driftTier(kart.driftCharge??0),boosted=kart.boostTimer>0,shielded=(abilities?.shieldTimer??0)>0
  const item=abilities?.held,ready=(kart.boostCooldown??0)<=0
  const cooldown=kart.boostCooldown??0
  const [lapNotice,setLapNotice]=useState<number|null>(null)
  const district=getCourseSector(nearestTrack(kart.x,kart.z).t)
  const previousLap=useRef(race.lap)
  useEffect(()=>{
    if(race.phase!=='racing'){previousLap.current=race.lap;setLapNotice(null);return}
    if(race.lap===previousLap.current)return
    previousLap.current=race.lap

    setLapNotice(race.lap)
    const timeout=window.setTimeout(()=>setLapNotice(null),2200)
    return ()=>window.clearTimeout(timeout)
  },[race.lap,race.phase])
  const finish=race.phase==='finish',results=finish&&race.finishElapsed>=3.5,intro=race.phase==='countdown'&&race.countdown>3
  const rivals=RIVALS.map((r,i)=>({...r,progress:rivalAngle(i,race.elapsed,race.rivals),finishedAt:race.rivals[i].finishedAt})).sort((a,b)=>a.finishedAt!==null&&b.finishedAt!==null?a.finishedAt-b.finishedAt:a.finishedAt!==null?-1:b.finishedAt!==null?1:b.progress-a.progress)
  const finishOrder=[...rivals.slice(0,position-1).map(r=>r.name),'YOU',...rivals.slice(position-1).map(r=>r.name)]
  const action=impact?'CONTACT · STAY ON LINE':kart.offroad?'OFF ROAD · REJOIN THE CIRCUIT':shielded?'PHASE SHIELD ACTIVE':boosted?'TURBO ACTIVE':reward==='boost'?'BOOST STRIP':kart.drifting?`DRIFT ${tier?['','I','II','III'][tier]:'CHARGING'}`:null
  return <div className={`pp-race ${boosted?'pp-race--boost':''} ${finish?'pp-race--finished':''} ${intro?'pp-race--intro':''}`}>
    <div className="pp-race__top">
      <div className={`pp-place ${position===1?'pp-place--first':''}`} aria-label={`Position ${position} of 6`}><strong><ChromeText>{position}</ChromeText></strong><span>{ordinal(position)}<small>/ 6 RACERS</small></span></div>
      <div className="pp-lap"><small>LAP</small><strong>{race.lap}<span> / {race.totalLaps}</span></strong><div className="pp-sectors" aria-label={`${race.checkpointsHit%4} of 4 sectors completed`}>{[0,1,2,3].map(i=><i key={i} className={i<race.checkpointsHit%4||finish?'complete':''}/>)}</div></div>
      <div className="pp-clock"><small>RACE TIME</small><strong>{clock(race.elapsed)}</strong></div>
      <div className="pp-tokens" aria-label={`${coins} tokens`}><span aria-hidden="true">◈</span><strong>{coins.toString().padStart(2,'0')}</strong></div>
    </div>
    {!finish&&<aside className={`pp-item ${item?'pp-item--held':''} ${shielded?'pp-item--shield':''}`} style={{'--item-color':ABILITY_INFO[item??(shielded?'shield':'turbo')].color} as React.CSSProperties} aria-label={item?`${ABILITY_INFO[item].name} ready`:ready?'Boost ready':`Boost recharging ${cooldown.toFixed(1)} seconds`}>
      <div className="pp-item__frame"><ItemIcon kind={item??(shielded?'shield':'turbo')}/>{!item&&!ready&&<span className="pp-item__cooldown">{cooldown.toFixed(1)}<small>s</small></span>}</div>
      <div className="pp-item__copy"><small>{item?'ITEM READY':shielded?'PROTECTED':ready?'RECHARGE BOOST':'RECHARGING'}</small><strong>{item?ABILITY_INFO[item].name:shielded?`${abilities!.shieldTimer.toFixed(1)}s`:ready?'NITRO READY':`${cooldown.toFixed(1)}s`}</strong><span>{item?ABILITY_INFO[item].hint:'SPACE / THUMB FLICK'}</span><em>{item?'SPACE / THUMB FLICK':ready?'READY TO FIRE':'PICK UP AN ITEM'}</em></div>
    </aside>}
    {!finish&&abilities&&abilities.eventTimer>0&&abilities.feedback&&<div className={`pp-combat-callout ${abilities.lastEvent==='hit'?'pp-combat-callout--hit':''}`} key={abilities.eventId} role="status"><small>{abilities.lastEvent==='damage'?'RIVAL ATTACK':abilities.lastEvent==='blocked'?'PROTECTED':abilities.lastEvent==='hit'?'DIRECT HIT':abilities.lastEvent==='pickup'?'ITEM ACQUIRED':'ABILITY SYSTEM'}</small><strong>{abilities.feedback}</strong>{abilities.lastTarget!==null&&abilities.lastTarget>=0&&<span>{abilities.lastEvent==='hit'?'DISRUPTED':'TARGET'} · {RIVALS[abilities.lastTarget].name}</span>}</div>}
    {!finish&&action&&<div className={`pp-action ${impact?'pp-action--impact':''}`} role="status">{action}</div>}
    {!finish&&<div className="pp-map"><span>{district.name.toUpperCase()}</span><svg viewBox="0 0 150 140" aria-label="Circuit map with six racers" role="img"><path d={mapPath} fill="none" stroke="#100d28" strokeWidth="12" strokeLinejoin="round"/><path d={mapPath} fill="none" stroke="#a0b7d4" strokeWidth="5" strokeLinejoin="round"/>{BOOST_PADS.map(p=><circle key={p.id} cx={mapX(p.x)} cy={mapZ(p.z)} r="2" fill="#63f3ff"/>)}{RIVALS.map((r,i)=>{const p=getTrackPoint(rivalAngle(i,race.elapsed,race.rivals)/(Math.PI*2));return <circle key={r.name} cx={mapX(p.x)} cy={mapZ(p.z)} r="3.3" fill={r.color} stroke="#161226" strokeWidth="1"/>})}<circle cx={mapX(kart.x)} cy={mapZ(kart.z)} r="5" fill="#fff" stroke="#ed429c" strokeWidth="2.5"/></svg><small><i/> YOU <b>●</b> RIVALS</small></div>}
    {!finish&&<div className="pp-speed"><div className="pp-speed__value"><strong><ChromeText>{speed}</ChromeText></strong><span>KM/H<small>{kart.speed<-.2?'REVERSE':boosted?'OVERDRIVE':'SPEED'}</small></span></div><div className="pp-speed__rail" role="meter" aria-label="Speed" aria-valuemin={0} aria-valuemax={166} aria-valuenow={Math.min(166,speed)}><i style={{transform:`scaleX(${Math.min(1,speed/166)})`}}/></div><div className={`pp-drift ${kart.drifting?'pp-drift--active':''}`}><span>{kart.drifting?'RELEASE SHIFT FOR TURBO':'HOLD SHIFT + TURN TO DRIFT'}</span><div>{[.65,1.5,2.5].map((threshold,i)=><i key={threshold} className={(kart.driftCharge??0)>=threshold?'charged':''} style={{'--drift-color':['#6af0ff','#ffb45c','#ef65ff'][i]} as React.CSSProperties}/>)}</div></div><small className="pp-input">{control.reverse?'OPEN PALM · BRAKE / REVERSE':debug.mode==='two-fist'?'TWO FISTS · DRIVE':debug.handsVisible?'RESTORE BOTH GRIPS · COASTING':'WASD / ARROWS · S TO BRAKE'}</small></div>}
    {boosted&&!finish&&<div className="pp-turbo-edge" aria-hidden="true"/>}
    {intro&&<div className="pp-grid-intro"><small>AFTERGLOW GRAND PRIX</small><strong><ChromeText>AFTERGLOW CITY</ChromeText></strong><span>3 LAPS · 6 RACERS · NEON NIGHTS</span></div>}
    {race.phase==='countdown'&&!intro&&<div className="pp-countdown" key={Math.ceil(race.countdown)} role="status"><div className="pp-start-lights" aria-hidden="true">{[3,2,1].map(n=><i key={n} className={Math.ceil(race.countdown)<=n?'lit':''}/>)}</div><strong><ChromeText>{Math.max(1,Math.ceil(race.countdown))}</ChromeText></strong><span>GET READY</span></div>}
    {race.phase==='racing'&&race.elapsed<.9&&<div className="pp-countdown pp-countdown--go" role="status"><strong><ChromeText>GO!</ChromeText></strong><span>MAKE IT A GOOD ONE</span></div>}
    {race.phase==='racing'&&lapNotice!==null&&<div className="pp-lap-notice" key={lapNotice} role="status"><span>{lapNotice===race.totalLaps?'MAKE IT COUNT':'KEEP THE PACE'}</span><strong><ChromeText>{lapNotice===race.totalLaps?'FINAL LAP':`LAP ${lapNotice}`}</ChromeText></strong></div>}
    {finish&&!results&&<div className="pp-finish-sting" role="status"><span>RACE COMPLETE</span><strong><ChromeText>FINISH!</ChromeText></strong><b>{position}<sup>{ordinal(position)}</sup></b></div>}
    {results&&<section className="pp-finish" aria-label="Race results"><div className="pp-finish__flag" aria-hidden="true"/><small>AFTERGLOW GRAND PRIX · COMPLETE</small><h2><ChromeText>{position===1?'VICTORY!':'FINISH!'}</ChromeText></h2><div className="pp-finish__summary"><strong>{position}<sup>{ordinal(position)}</sup></strong><div><span>FINISH TIME</span><b>{clock(race.elapsed)}</b><small>{coins} TOKENS · {race.totalLaps} LAPS</small></div></div><ol>{finishOrder.map((name,i)=><li key={name} className={name==='YOU'?'you':''}><span>{i+1}</span><strong>{name}</strong>{name==='YOU'&&<small>YOUR RACE</small>}</li>)}</ol></section>}
  </div>
}

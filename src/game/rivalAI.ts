import {getTrackSample,TRACK_LENGTH} from './trackLayout'
import {getObstaclePose,OBSTACLES} from './obstacles'
import {RIVALS} from './rivalRoster'

export type RivalState={distance:number;speed:number;lane:number;laneVelocity:number;steering:number;boostTimer:number;boostCooldown:number;driftCharge:number;finishedAt:number|null}
export type RivalRace={rivals:RivalState[];rivalAccumulator:number;totalLaps:number}
export type RivalPlayer={distance:number;lane:number;speed:number}
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x))
const wrap=(t:number)=>((t%1)+1)%1
const STEP=1/60
export function createRivalStates():RivalState[]{return RIVALS.map((_,i)=>({distance:-.012*TRACK_LENGTH-(i+1)*3.2,speed:0,lane:[-2.3,2.3,-2.3,2.3,0][i],laneVelocity:0,steering:0,boostTimer:0,boostCooldown:4+i*.8,driftCharge:0,finishedAt:null}))}
// Cache the course's local curvature once; runtime planning only interpolates it.
const curvature=Array.from({length:1024},(_,i)=>{
 const a=getTrackSample(i/1024),b=getTrackSample(i/1024+10/TRACK_LENGTH)
 return Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))/10
})
function bend(t:number){const index=wrap(t)*curvature.length,i=Math.floor(index);return curvature[i]+(curvature[(i+1)%curvature.length]-curvature[i])*(index-i)}
function stepRivals(race:RivalRace,player:RivalPlayer,elapsed:number){
 for(let i=0;i<race.rivals.length;i++){
  const r=race.rivals[i]
  if(r.finishedAt!==null)continue
  const t=wrap(r.distance/TRACK_LENGTH),turn=bend(t+Math.max(6,r.speed*.65)/TRACK_LENGTH),tight=Math.abs(turn)
  const cruise=32+(RIVALS[i].speed-.9)*35
  // Competitive baseline even when the player stops. Gap adjustment is modest,
  // bounded, and only available against an actively driving player.
  const gap=player.distance-r.distance
  const pressure=player.speed>15?clamp(gap/90,-1,1)*2.2:0
  const cornerGrip=18+(RIVALS[i].speed-.9)*45
  let target=Math.min(cruise+pressure,Math.max(22,Math.sqrt(cornerGrip/Math.max(.001,tight))))
  const ideal=clamp(turn*150,-2.7,2.7)
  const nearby=race.rivals.filter((other,j)=>j!==i&&other.finishedAt===null&&Math.abs(other.distance-r.distance)<14)
  const hazards=OBSTACLES.flatMap((o,j)=>{
   const ahead=wrap(o.t-t)*TRACK_LENGTH
   return ahead<Math.max(30,r.speed*1.7)?[{ahead,lane:getObstaclePose(j,elapsed+.5).lane,radius:o.radius+1.1}]:[]
  })
  let chosen=ideal,best=Infinity
  for(const lane of [-4.8,-2.4,0,2.4,4.8]){
   let score=Math.abs(lane-ideal)*.6+Math.abs(lane-r.lane)*.45
   for(const h of hazards)if(Math.abs(lane-h.lane)<h.radius)score+=50*(1-h.ahead/90)
   for(const other of nearby)if(Math.abs(lane-other.lane)<1.8)score+=12*(1-Math.abs(other.distance-r.distance)/16)
   if(Math.abs(gap)<12&&Math.abs(lane-player.lane)<1.9)score+=16
   if(score<best){best=score;chosen=lane}
  }
  // Draft into a pass, rather than sitting directly behind another kart.
  const draft=nearby.some(other=>other.distance>r.distance&&other.distance-r.distance<14&&Math.abs(other.lane-r.lane)<1.7)
  if(draft&&tight<.015)target+=1.8
  r.boostCooldown=Math.max(0,r.boostCooldown-STEP);r.boostTimer=Math.max(0,r.boostTimer-STEP)
  if(tight>.012&&r.speed>20)r.driftCharge=Math.min(2,r.driftCharge+STEP)
  if(r.driftCharge>.7&&tight<.006){r.boostTimer=Math.max(r.boostTimer,.7);r.driftCharge=0}
  if(!r.boostCooldown&&tight<.008&&(gap>8||draft||gap> -12&&elapsed>12)){
   r.boostTimer=1.35;r.boostCooldown=8+i*.45
  }
  if(r.boostTimer>0&&tight<.015)target=Math.min(44,target+8)
  // A boost never overrides the need to leave space until the pass is clear.
  for(const other of nearby){
   const ahead=other.distance-r.distance
   if(ahead>0&&ahead<4.5&&Math.abs(other.lane-r.lane)<1.8)target=Math.min(target,Math.max(0,other.speed-(4.5-ahead)*2))
  }
  if(gap>0&&gap<4.5&&Math.abs(player.lane-r.lane)<1.9)target=Math.min(target,Math.max(0,player.speed-(4.5-gap)*2))
  for(const h of hazards)if(h.ahead<15&&Math.abs(r.lane-h.lane)<h.radius)target=Math.min(target,Math.max(8,h.ahead*.9))
  // Acceleration and braking are rate limited; catch-up never changes position.
  r.speed+=clamp(target-r.speed,-28*STEP,19.5*STEP)
  r.laneVelocity+=clamp((chosen-r.lane)*2.4-r.laneVelocity,-6*STEP,6*STEP)
  r.laneVelocity=clamp(r.laneVelocity,-2.8,2.8)
  r.lane=clamp(r.lane+r.laneVelocity*STEP,-5.2,5.2)
  r.steering=clamp(turn*18+r.laneVelocity*.1,-.7,.7)
  r.distance+=r.speed*STEP
  if(r.distance>=race.totalLaps*TRACK_LENGTH){r.distance=race.totalLaps*TRACK_LENGTH;r.speed=0;r.laneVelocity=0;r.finishedAt=elapsed}
 }
}
/** Fixed-step opponents: shared by the world, minimap and classification. */
export function advanceRivals(race:RivalRace,player:RivalPlayer,elapsed:number,dt:number){
 if(!Number.isFinite(dt)||dt<=0||dt>.25)return
 race.rivalAccumulator+=dt
 while(race.rivalAccumulator>=STEP-1e-9){
  race.rivalAccumulator-=STEP
  stepRivals(race,player,elapsed-race.rivalAccumulator)
 }
}

import { createAbilityState, tickAbilities, advanceCombat, activateAbility, collectAbility, shouldUseRivalItem,ABILITY_PICKUPS, type AbilityState } from './abilities'
import {createCourseRewards,updateCourseRewards,type CourseRewards} from './courseFeatures'
import type { ControlState } from './controlState'
import { ZERO_CONTROL } from './controlState'
import { DEFAULT_KART, FIXED_STEP, stepKart, type KartState } from './kartPhysics'
import { createRaceStatus, updateCheckpoints,playerProgressDistance,racePosition, type RaceStatus } from './raceLoop'
import {advanceRivals} from './rivalAI'
import {getTrackSurface,TRACK_LENGTH,nearestTrack} from './trackLayout'
import {createObstacleState,updateObstacles,type ObstacleState} from './obstacles'

/** Stable, mutable frame data: rendering never waits for a React state commit. */
export type RaceRuntime = {
  abilities: AbilityState
  rivalAbilities:AbilityState[]
  pickupCooldowns:number[]
  obstacles: ObstacleState
  rewards: CourseRewards
  kart: KartState
  visual: KartState
  race: RaceStatus
  control: ControlState
  readControls: (dtMs: number) => ControlState
  publish: () => void
  sincePublish: number
}
export function createRuntime(): RaceRuntime {
  return {abilities:createAbilityState(),rivalAbilities:Array.from({length:5},createAbilityState),pickupCooldowns:ABILITY_PICKUPS.map(()=>0),obstacles:createObstacleState(),rewards:createCourseRewards(),kart:{...DEFAULT_KART},visual:{...DEFAULT_KART},race:createRaceStatus(),control:{...ZERO_CONTROL},readControls:()=>ZERO_CONTROL,publish:()=>{},sincePublish:0}
}
export function resetRuntime(runtime:RaceRuntime, racing=false) {
  // Clear optional simulation fields from the previous run before reusing the stable object.
  for(const key of Object.keys(runtime.kart)) delete (runtime.kart as unknown as Record<string,unknown>)[key]
  Object.assign(runtime.kart,DEFAULT_KART)
  for(const key of Object.keys(runtime.visual)) delete (runtime.visual as unknown as Record<string,unknown>)[key]
  Object.assign(runtime.visual,DEFAULT_KART)
  Object.assign(runtime.race,createRaceStatus(),racing?{phase:'countdown',countdown:6}:{})
  runtime.rewards=createCourseRewards()
  runtime.obstacles=createObstacleState()
  runtime.abilities=createAbilityState()
  runtime.rivalAbilities=Array.from({length:5},createAbilityState);runtime.pickupCooldowns=ABILITY_PICKUPS.map(()=>0)
  runtime.control={...ZERO_CONTROL};runtime.sincePublish=0;runtime.publish()
}
export function advanceRuntime(runtime:RaceRuntime,delta:number) {
  if(!Number.isFinite(delta)||delta<=0)return
  // Pause after tab suspension; allow ordinary slow frames to catch up in bounded fixed steps.
  const dt=delta>.25?0:Math.min(delta,.1)
  if(!dt)return
  runtime.control=runtime.readControls(dt*1000)
  const priorPhase=runtime.race.phase
  if(priorPhase==='countdown') {
    runtime.race.countdown=Math.max(0,runtime.race.countdown-dt)
    if(runtime.race.countdown===0)runtime.race.phase='racing'
  }else if(priorPhase==='racing'){
    // The physics function protects its own accumulator; divide slow visual frames to retain time.
    const previousX=runtime.kart.x,previousZ=runtime.kart.z
    tickAbilities(runtime.abilities,dt)
    runtime.rivalAbilities.forEach(a=>tickAbilities(a,dt))
    runtime.pickupCooldowns=runtime.pickupCooldowns.map(t=>Math.max(0,t-dt))
    const priorRivalDistances=runtime.race.rivals.map(r=>r.distance)
    const combat={rivals:runtime.race.rivals,distance:playerProgressDistance(runtime.race,runtime.kart.x,runtime.kart.z),lane:nearestTrack(runtime.kart.x,runtime.kart.z).signedDistance,peerAbilities:runtime.rivalAbilities}
    const consumed=runtime.control.item && activateAbility(runtime.abilities,runtime.kart,combat)
    const heldControl=consumed?{...runtime.control,item:false}:runtime.control
    const physicsControl=runtime.abilities.stunTimer>0?{...heldControl,throttle:0,brake:.3,reverse:0,drift:false,steer:heldControl.steer*.25}:heldControl
    const chunks=Math.ceil(dt/.05)
    for(let i=0;i<chunks;i++)Object.assign(runtime.kart,stepKart(runtime.kart,i===0?physicsControl:{...physicsControl,item:false},dt/chunks))
    if(runtime.abilities.shieldTimer<=0)updateObstacles(runtime.obstacles,runtime.kart,previousX,previousZ,runtime.race.elapsed+dt,dt)
    else {
      runtime.obstacles.flashTimer=Math.max(0,runtime.obstacles.flashTimer-dt)
      runtime.obstacles.cooldowns=runtime.obstacles.cooldowns.map(c=>Math.max(0,c-dt))
    }
    collectAbility(runtime.abilities,Math.floor(runtime.race.checkpointsHit/4),previousX,previousZ,runtime.kart.x,runtime.kart.z,runtime.pickupCooldowns)
    const boosted=updateCourseRewards(runtime.rewards,Math.floor(runtime.race.checkpointsHit/4),previousX,previousZ,runtime.kart.x,runtime.kart.z,runtime.kart.speed,dt)
    if(boosted)runtime.kart.boostTimer=Math.max(runtime.kart.boostTimer,.9)
    runtime.race.elapsed+=dt
    advanceRivals(runtime.race,{distance:playerProgressDistance(runtime.race,runtime.kart.x,runtime.kart.z),lane:nearestTrack(runtime.kart.x,runtime.kart.z).signedDistance,speed:runtime.kart.speed},runtime.race.elapsed,dt)
    // One shared crystal field: each racer competes for the same individual cells.
    const player={kart:runtime.kart,distance:playerProgressDistance(runtime.race,runtime.kart.x,runtime.kart.z),lane:nearestTrack(runtime.kart.x,runtime.kart.z).signedDistance,abilities:runtime.abilities}
    for(let i=0;i<runtime.race.rivals.length;i++){
      const r=runtime.race.rivals[i],a=runtime.rivalAbilities[i]
      if(r.finishedAt!==null){a.shots=[];a.mines=[];a.pulse=null;a.shieldTimer=0;continue}
      const before=getTrackSurface(priorRivalDistances[i]/TRACK_LENGTH,r.lane),after=getTrackSurface(r.distance/TRACK_LENGTH,r.lane)
      const context={rivals:runtime.race.rivals,distance:r.distance,lane:r.lane,owner:i,peerAbilities:runtime.rivalAbilities,player}
      const count=a.pickupCount
      collectAbility(a,Math.floor(r.distance/TRACK_LENGTH),before.point.x,before.point.z,after.point.x,after.point.z,runtime.pickupCooldowns)
      const announce=(kind:'pickup'|NonNullable<AbilityState['held']>)=>{if(Math.abs(r.distance-player.distance)<75)runtime.abilities.nearbyCue={id:(runtime.abilities.nearbyCue?.id??0)+1,kind,distance:Math.abs(r.distance-player.distance)}}
      if(a.pickupCount>count)announce('pickup')
      if(r.stunTimer<=0&&shouldUseRivalItem(a,context)){
        const kind=a.held!,driver={...DEFAULT_KART,speed:r.speed,boostTimer:r.boostTimer}
        activateAbility(a,driver,context);r.boostTimer=driver.boostTimer;announce(kind)
      }
      advanceCombat(a,context,dt)
    }
    advanceCombat(runtime.abilities,combat,dt)
    const position=racePosition(runtime.race,runtime.kart.x,runtime.kart.z)
    Object.assign(runtime.race,updateCheckpoints(runtime.race,runtime.kart.x,runtime.kart.z))
    if(runtime.race.phase==='finish'){
      const track=nearestTrack(runtime.kart.x,runtime.kart.z)
      runtime.race.finishPosition=position;runtime.race.finishElapsed=0
      runtime.race.paradeDistance=track.t*TRACK_LENGTH;runtime.race.paradeLane=track.signedDistance
      for(const a of runtime.rivalAbilities){a.shieldTimer=0;a.shots=[];a.mines=[];a.impacts=[];a.pulse=null;a.pickupBursts=[]}
      runtime.abilities.shieldTimer=0;runtime.abilities.shots=[];runtime.abilities.mines=[];runtime.abilities.impacts=[];runtime.abilities.pulse=null
      runtime.kart.boostTimer=0;runtime.kart.drifting=false;runtime.kart.driftCharge=0
    }
  }else if(priorPhase==='finish'){
    // Continue along the real elevated road; race time and finishing order are already sealed.
    const r=runtime.race,k=runtime.kart;r.finishElapsed+=dt
    k.speed+=(12-k.speed)*(1-Math.exp(-.7*dt))
    r.paradeDistance+=k.speed*dt
    const surface=getTrackSurface(r.paradeDistance/TRACK_LENGTH,r.paradeLane*Math.exp(-r.finishElapsed*.7))
    const blend=1-Math.exp(-18*dt)
    k.x+=(surface.point.x-k.x)*blend;k.z+=(surface.point.z-k.z)*blend
    k.yaw+=Math.atan2(Math.sin(surface.yaw-k.yaw),Math.cos(surface.yaw-k.yaw))*(1-Math.exp(-6*dt))
    k.vx=Math.sin(k.yaw)*k.speed;k.vz=Math.cos(k.yaw)*k.speed;k.steering=0;k.offroad=false
    k.previousX=k.x;k.previousZ=k.z;k.previousYaw=k.yaw;k.physicsRemainder=0
    for(const rival of r.rivals){rival.stunTimer=0;rival.slowTimer=0;rival.speed+=(12-rival.speed)*(1-Math.exp(-.7*dt));rival.distance+=rival.speed*dt;rival.laneVelocity=0}

  }
  const k=runtime.kart,alpha=Math.min(1,(k.physicsRemainder??0)/FIXED_STEP)
  Object.assign(runtime.visual,k)
  runtime.visual.x=(k.previousX??k.x)+(k.x-(k.previousX??k.x))*alpha
  runtime.visual.z=(k.previousZ??k.z)+(k.z-(k.previousZ??k.z))*alpha
  const lastYaw=k.previousYaw??k.yaw
  runtime.visual.yaw=lastYaw+Math.atan2(Math.sin(k.yaw-lastYaw),Math.cos(k.yaw-lastYaw))*alpha
  runtime.sincePublish+=dt
  if(runtime.sincePublish>=.1||priorPhase!==runtime.race.phase){runtime.sincePublish=0;runtime.publish()}
}

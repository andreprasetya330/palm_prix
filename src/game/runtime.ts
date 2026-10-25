import {createCourseRewards,updateCourseRewards,type CourseRewards} from './courseFeatures'
import type { ControlState } from './controlState'
import { ZERO_CONTROL } from './controlState'
import { DEFAULT_KART, FIXED_STEP, stepKart, type KartState } from './kartPhysics'
import { createRaceStatus, updateCheckpoints, type RaceStatus } from './raceLoop'

/** Stable, mutable frame data: rendering never waits for a React state commit. */
export type RaceRuntime = {
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
  return {rewards:createCourseRewards(),kart:{...DEFAULT_KART},visual:{...DEFAULT_KART},race:createRaceStatus(),control:{...ZERO_CONTROL},readControls:()=>ZERO_CONTROL,publish:()=>{},sincePublish:0}
}
export function resetRuntime(runtime:RaceRuntime, racing=false) {
  // Clear optional simulation fields from the previous run before reusing the stable object.
  for(const key of Object.keys(runtime.kart)) delete (runtime.kart as unknown as Record<string,unknown>)[key]
  Object.assign(runtime.kart,DEFAULT_KART)
  for(const key of Object.keys(runtime.visual)) delete (runtime.visual as unknown as Record<string,unknown>)[key]
  Object.assign(runtime.visual,DEFAULT_KART)
  Object.assign(runtime.race,createRaceStatus(),racing?{phase:'countdown',countdown:3}:{})
  runtime.rewards=createCourseRewards()
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
    const chunks=Math.ceil(dt/.05)
    for(let i=0;i<chunks;i++)Object.assign(runtime.kart,stepKart(runtime.kart,runtime.control,dt/chunks))
    const boosted=updateCourseRewards(runtime.rewards,Math.floor(runtime.race.checkpointsHit/4),previousX,previousZ,runtime.kart.x,runtime.kart.z,runtime.kart.speed,dt)
    if(boosted)runtime.kart.boostTimer=Math.max(runtime.kart.boostTimer,.9)
    runtime.race.elapsed+=dt
    Object.assign(runtime.race,updateCheckpoints(runtime.race,runtime.kart.x,runtime.kart.z))
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

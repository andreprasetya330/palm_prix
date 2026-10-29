import { nearestTrack, ROAD_HALF_WIDTH, TRACK_LENGTH } from './trackLayout'
import {createRivalStates,type RivalState} from './rivalAI'
import {RIVALS} from './rivalRoster'
export {RIVALS} from './rivalRoster'
export type RacePhase = 'menu' | 'avatar' | 'calibrate' | 'countdown' | 'racing' | 'finish'
export type RaceStatus = { phase: RacePhase; countdown: number; lap: number; totalLaps: number; elapsed: number; checkpointsHit: number;rivals:RivalState[];rivalAccumulator:number;finishElapsed:number;finishPosition:number;paradeDistance:number;paradeLane:number }
export const TOTAL_LAPS = 3
// Start is t=0; a lap counts only after all four ordered sectors.
export const CHECKPOINT_ANGLES = [Math.PI / 2, Math.PI, Math.PI * 1.5, 0]
export function createRaceStatus(): RaceStatus { return { phase: 'menu', countdown: 3, lap: 1, totalLaps: TOTAL_LAPS, elapsed: 0, checkpointsHit: 0,rivals:createRivalStates(),rivalAccumulator:0,finishElapsed:0,finishPosition:0,paradeDistance:0,paradeLane:0 } }
export function kartAngle(x: number, z: number): number { return nearestTrack(x, z).t * Math.PI * 2 }
export function updateCheckpoints(status: RaceStatus, x: number, z: number): RaceStatus {
  if (status.phase !== 'racing') return status
  const target = CHECKPOINT_ANGLES[status.checkpointsHit % 4]
  const angle = kartAngle(x, z)
  const difference = Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)))
  const distance = nearestTrack(x, z).distance
  if (distance > ROAD_HALF_WIDTH + 1 || difference > 0.10) return status
  const checkpointsHit = status.checkpointsHit + 1
  const lap = Math.floor(checkpointsHit / 4) + 1
  return { ...status, checkpointsHit, lap: Math.min(lap, status.totalLaps), phase: lap > status.totalLaps ? 'finish' : status.phase }
}
export function rivalAngle(index: number, elapsed: number,rivals?:readonly RivalState[]) {
  if(rivals)return rivals[index].distance/TRACK_LENGTH*Math.PI*2
  const r = RIVALS[index]
  // Acceleration from the grid, shared by rendering and leaderboard.
  return r.offset * 0.4 + (r.speed * 20 / TRACK_LENGTH * Math.PI * 2) * (elapsed - 1.5 * (1 - Math.exp(-elapsed / 1.5)))
}
export function playerProgressDistance(status:RaceStatus,x:number,z:number){
  const angle = kartAngle(x, z)
  const completed = Math.floor(status.checkpointsHit / 4)
  let progress = completed * Math.PI * 2 + angle
  if (status.checkpointsHit === 0 && angle > Math.PI * 1.5) progress -= Math.PI * 2
  // Sector four can be registered just before crossing the line.
  if (status.checkpointsHit > 0 && status.checkpointsHit % 4 === 0 && angle > Math.PI * 1.5) progress -= Math.PI * 2
  return progress/(Math.PI*2)*TRACK_LENGTH
}
export function racePosition(status: RaceStatus, x: number, z: number) {
  if(status.phase==='finish'&&status.finishPosition)return status.finishPosition
  const progress=playerProgressDistance(status,x,z)
  return 1+status.rivals.filter(r=>r.finishedAt!==null||r.distance>progress).length
}


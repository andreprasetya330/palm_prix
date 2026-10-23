export type RacePhase = 'menu' | 'avatar' | 'calibrate' | 'countdown' | 'racing' | 'finish'
export type RaceStatus = { phase: RacePhase; countdown: number; lap: number; totalLaps: number; elapsed: number; checkpointsHit: number }
export const TOTAL_LAPS = 3
// Start is t=0; a lap counts only after all four ordered sectors.
export const CHECKPOINT_ANGLES = [Math.PI / 2, Math.PI, Math.PI * 1.5, 0]
export function createRaceStatus(): RaceStatus { return { phase: 'menu', countdown: 3, lap: 1, totalLaps: TOTAL_LAPS, elapsed: 0, checkpointsHit: 0 } }
export function kartAngle(x: number, z: number): number { return (Math.atan2(x / 1.15, z) + Math.PI * 2) % (Math.PI * 2) }
export function updateCheckpoints(status: RaceStatus, x: number, z: number): RaceStatus {
  if (status.phase !== 'racing') return status
  const target = CHECKPOINT_ANGLES[status.checkpointsHit % 4]
  const angle = kartAngle(x, z)
  const difference = Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)))
  const radius = Math.hypot(x / 1.15, z)
  if (radius < 13 || radius > 23 || difference > 0.18) return status
  const checkpointsHit = status.checkpointsHit + 1
  const lap = Math.floor(checkpointsHit / 4) + 1
  return { ...status, checkpointsHit, lap: Math.min(lap, status.totalLaps), phase: lap > status.totalLaps ? 'finish' : status.phase }
}
export const RIVALS = [
  { name: 'CORAL', color: '#ff597b', speed: 0.94, offset: -0.28, lane: 16.4 },
  { name: 'VOLT', color: '#ffd34e', speed: 0.98, offset: -0.43, lane: 19.8 },
  { name: 'AZURE', color: '#538dff', speed: 0.90, offset: -0.59, lane: 17.9 },
  { name: 'ORCHID', color: '#c088ff', speed: 0.87, offset: -0.74, lane: 20.5 },
  { name: 'MINT', color: '#52e4b2', speed: 0.92, offset: -0.88, lane: 16.5 },
]
export function rivalAngle(index: number, elapsed: number) {
  const r = RIVALS[index]
  // Acceleration from the grid, shared by rendering and leaderboard.
  return r.offset + r.speed * (elapsed - 1.5 * (1 - Math.exp(-elapsed / 1.5)))
}
export function racePosition(status: RaceStatus, x: number, z: number) {
  const angle = kartAngle(x, z)
  const completed = Math.floor(status.checkpointsHit / 4)
  let progress = completed * Math.PI * 2 + angle
  if (status.checkpointsHit === 0 && angle > Math.PI * 1.5) progress -= Math.PI * 2
  // Sector four can be registered just before crossing the line.
  if (status.checkpointsHit > 0 && status.checkpointsHit % 4 === 0 && angle > Math.PI * 1.5) progress -= Math.PI * 2
  return 1 + RIVALS.filter((_, i) => rivalAngle(i, status.elapsed) > progress).length
}

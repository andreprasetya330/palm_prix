export type RacePhase = 'menu' | 'avatar' | 'calibrate' | 'countdown' | 'racing' | 'finish'

export type RaceStatus = {
  phase: RacePhase
  countdown: number
  lap: number
  totalLaps: number
  elapsed: number
  checkpointsHit: number
}

export const TOTAL_LAPS = 2
/** Ordered checkpoint angles around oval (radians in XZ plane from center). */
export const CHECKPOINT_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

export function createRaceStatus(): RaceStatus {
  return {
    phase: 'menu',
    countdown: 3,
    lap: 1,
    totalLaps: TOTAL_LAPS,
    elapsed: 0,
    checkpointsHit: 0,
  }
}

export function kartAngle(x: number, z: number): number {
  return Math.atan2(x, z)
}

function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

export function updateCheckpoints(
  status: RaceStatus,
  x: number,
  z: number,
): RaceStatus {
  if (status.phase !== 'racing') return status
  const nextIdx = status.checkpointsHit % CHECKPOINT_ANGLES.length
  const target = CHECKPOINT_ANGLES[nextIdx]
  const ang = kartAngle(x, z)
  const r = Math.hypot(x, z)
  // oval corridor roughly r ~ 14–22
  if (r > 12 && r < 26 && angleDiff(ang, target) < 0.35) {
    const checkpointsHit = status.checkpointsHit + 1
    let lap = status.lap
    let phase: RacePhase = status.phase
    if (checkpointsHit > 0 && checkpointsHit % CHECKPOINT_ANGLES.length === 0) {
      lap += 1
      if (lap > status.totalLaps) {
        return { ...status, checkpointsHit, lap: status.totalLaps, phase: 'finish' }
      }
    }
    return { ...status, checkpointsHit, lap, phase }
  }
  return status
}

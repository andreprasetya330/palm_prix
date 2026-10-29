const STORAGE_KEY = 'palm-kart-calibration-v1'

export type Calibration = {
  /** two-fist neutral wheel angle (radians) */
  neutralAngle: number
  /** one-hand neutral yaw (radians) */
  oneHandNeutral: number
  /** radians of twist for full lock */
  sensitivityRad: number
  /** deadzone in radians */
  deadzoneRad: number
  /** drive-zone height band (normalized y, top=0) */
  driveZoneTop: number
  driveZoneBottom: number
  /** depth delta above which we treat as brake pull */
  brakeDepthDelta: number
}

export const DEFAULT_CALIBRATION: Calibration = {
  neutralAngle: 0,
  oneHandNeutral: -Math.PI / 2,
  sensitivityRad: (50 * Math.PI) / 180,
  deadzoneRad: (8 * Math.PI) / 180,
  driveZoneTop: 0.25,
  driveZoneBottom: 0.7,
  brakeDepthDelta: 0.04,
}

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CALIBRATION }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result = { ...DEFAULT_CALIBRATION }
    for (const key of Object.keys(result) as (keyof Calibration)[]) {
      if (typeof parsed[key] === 'number' && Number.isFinite(parsed[key])) result[key] = parsed[key] as number
    }
    if (result.sensitivityRad <= result.deadzoneRad || result.deadzoneRad < 0 || result.sensitivityRad > Math.PI || result.driveZoneTop < 0 || result.driveZoneBottom > 1 || result.driveZoneTop >= result.driveZoneBottom || result.brakeDepthDelta <= 0) return { ...DEFAULT_CALIBRATION }
    return result
  } catch {
    return { ...DEFAULT_CALIBRATION }
  }
}

export function saveCalibration(c: Calibration): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch { /* Session calibration still works when storage is unavailable. */ }
}


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
    return { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CALIBRATION }
  }
}

export function saveCalibration(c: Calibration): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

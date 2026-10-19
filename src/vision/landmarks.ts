/** MediaPipe Hand landmark indices we care about */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20,
} as const

export type Vec2 = { x: number; y: number }
export type Vec3 = { x: number; y: number; z: number }

export type HandSample = {
  landmarks: Vec3[]
  /** mirrored for selfie view (x flipped) */
  grip: Vec2
  yaw: number
  isFist: boolean
  /** normalized height 0 top → 1 bottom (mirrored screen space) */
  height: number
  /** average landmark z (more positive ≈ farther from camera in MediaPipe) */
  depth: number
}

export function mid(a: Vec3, b: Vec3): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function dist2(a: Vec2 | Vec3, b: Vec2 | Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/** Classify closed grip: fingertips near palm (wrist→middle MCP midpoint). */
export function classifyFist(landmarks: Vec3[]): boolean {
  const palm = mid(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP])
  const tips = [
    landmarks[LM.INDEX_TIP],
    landmarks[LM.MIDDLE_TIP],
    landmarks[LM.RING_TIP],
    landmarks[LM.PINKY_TIP],
  ]
  const avg = tips.reduce((s, t) => s + dist2(t, palm), 0) / tips.length
  const handScale = dist2(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]) || 0.1
  return avg < handScale * 0.85
}

/** In-plane yaw of wrist → middle MCP axis (radians). */
export function handYaw(landmarks: Vec3[]): number {
  const w = landmarks[LM.WRIST]
  const m = landmarks[LM.MIDDLE_MCP]
  return Math.atan2(m.y - w.y, m.x - w.x)
}

export function sampleHand(landmarks: Vec3[], mirrorX = true): HandSample {
  const mapped = landmarks.map((p) => ({
    x: mirrorX ? 1 - p.x : p.x,
    y: p.y,
    z: p.z,
  }))
  const grip = mid(mapped[LM.WRIST], mapped[LM.MIDDLE_MCP])
  const depth =
    mapped.reduce((s, p) => s + p.z, 0) / Math.max(1, mapped.length)
  return {
    landmarks: mapped,
    grip,
    yaw: handYaw(mapped),
    isFist: classifyFist(mapped),
    height: grip.y,
    depth,
  }
}

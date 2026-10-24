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
  pose?: 'fist' | 'open' | 'uncertain'
  aspectRatio?: number
  trackingId?: number
  trackingLatencyMs?: number
  detectionMs?: number
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

/** Joint flexion and palm-relative reach are invariant to 3D hand rotation. */
export function classifyPose(points: Vec3[]): 'fist' | 'open' | 'uncertain' {
  if (points.length !== 21 || points.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))) return 'uncertain'
  const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z)
  const scale = distance(points[0], points[9])
  if (scale < 1e-5) return 'uncertain'
  const bend = (a: Vec3, b: Vec3, c: Vec3) => {
    const ab = distance(a,b), bc = distance(b,c)
    if (ab * bc < 1e-10) return 0
    const dot = (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)+(b.z-a.z)*(c.z-b.z)
    return Math.acos(Math.max(-1, Math.min(1, dot/(ab*bc))))
  }
  let curled = 0, extended = 0
  for (const base of [5,9,13,17]) {
    const [mcp,pip,dip,tip] = points.slice(base,base+4)
    const flexion = bend(mcp,pip,dip) + bend(pip,dip,tip)
    const reach = distance(tip, points[0]) / scale
    if (flexion > 1.05 && reach < 2.0) curled++
    if (flexion < 0.75 && reach > 1.5) extended++
  }
  return curled >= 3 ? 'fist' : extended >= 3 ? 'open' : 'uncertain'
}
export function classifyFist(points: Vec3[]): boolean { return classifyPose(points) === 'fist' }

export function wheelAngle(left: HandSample, right: HandSample): number {
  return Math.atan2(right.grip.y-left.grip.y, (right.grip.x-left.grip.x)*(left.aspectRatio ?? right.aspectRatio ?? 1))
}
/** In-plane yaw of wrist → middle MCP axis (radians). */
export function handYaw(landmarks: Vec3[]): number {
  const w = landmarks[LM.WRIST]
  const m = landmarks[LM.MIDDLE_MCP]
  return Math.atan2(m.y - w.y, m.x - w.x)
}

export function sampleHand(landmarks: Vec3[], mirrorX = true, aspectRatio = 1, worldLandmarks?: Vec3[]): HandSample {
  const mapped = landmarks.map((p) => ({
    x: mirrorX ? 1 - p.x : p.x,
    y: p.y,
    z: p.z,
  }))
  const grip = mid(mapped[LM.WRIST], mapped[LM.MIDDLE_MCP])
  const pose = classifyPose(worldLandmarks ?? mapped.map((p) => ({ x: p.x * aspectRatio, y: p.y, z: p.z * aspectRatio })))
  const depth =
    mapped.reduce((s, p) => s + p.z, 0) / Math.max(1, mapped.length)
  return {
    landmarks: mapped,
    grip,
    yaw: handYaw(mapped),
    isFist: pose === 'fist',
    pose,
    aspectRatio,
    height: grip.y,
    depth,
  }
}




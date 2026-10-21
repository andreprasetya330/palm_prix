import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import {
  kartAxes,
  kartToWorld,
  makePaintedGeometry,
  paint,
  writeQuad,
  type Rgba,
} from './quads'

const STREAKS = 36
const RIBBON = 18

type Streak = {
  side: number
  lift: number
  depth: number
  len: number
  width: number
  life: number
  hot: number
}

/**
 * Boost streaks stay hairlines at the frame edge.
 * The chase camera is not pulled back, so the kart stays chase-sized.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const streakGeom = useMemo(() => makePaintedGeometry(STREAKS * 6), [])
  const ribbonGeom = useMemo(() => makePaintedGeometry(RIBBON * 2 * 6 + 8 * 6), [])
  const streaks = useRef<Streak[]>(
    Array.from({ length: STREAKS }, () => spawnStreak(true)),
  )
  const histL = useRef<{ x: number; y: number; z: number }[]>([])
  const histR = useRef<{ x: number; y: number; z: number }[]>([])
  const fade = useRef(0)

  const positions = streakGeom.getAttribute('position').array as Float32Array
  const colors = streakGeom.getAttribute('color').array as Float32Array
  const rPos = ribbonGeom.getAttribute('position').array as Float32Array
  const rCol = ribbonGeom.getAttribute('color').array as Float32Array

  useFrame((_, dt) => {
    const k = kartRef.current
    const boosting = k.boostTimer > 0
    kick.current = THREE.MathUtils.damp(kick.current, boosting ? 1 : 0, 7, dt)
    const punch = kick.current

    writeStreaks(streakGeom, positions, colors, streaks.current, camera, punch, dt)
    writeRibbons(ribbonGeom, rPos, rCol, histL.current, histR.current, fade, k, dt, punch)
  })

  return (
    <>
      <mesh geometry={streakGeom} frustumCulled={false} renderOrder={6}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={ribbonGeom} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function spawnStreak(fresh: boolean): Streak {
  const edge = 1.65 + Math.random() * 1.35
  return {
    side: (Math.random() < 0.5 ? -1 : 1) * edge,
    lift: (Math.random() - 0.45) * 1.8,
    depth: fresh ? 2.2 + Math.random() * 7 : 3 + Math.random() * 6,
    len: 1.8 + Math.random() * 2.4,
    width: 0.004 + Math.random() * 0.007,
    life: Math.random(),
    hot: Math.random(),
  }
}

const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _center = new THREE.Vector3()
const _axisA = new THREE.Vector3()
const _axisB = new THREE.Vector3()
const _p = new THREE.Vector3()

function writeStreaks(
  geom: THREE.BufferGeometry,
  positions: Float32Array,
  colors: Float32Array,
  pool: Streak[],
  camera: THREE.Camera,
  punch: number,
  dt: number,
) {
  const e = camera.matrixWorld.elements
  _right.set(e[0], e[1], e[2])
  _up.set(e[4], e[5], e[6])
  _fwd.set(-e[8], -e[9], -e[10])
  const origin = camera.position
  let v = 0
  const step = 26 * dt
  for (const s of pool) {
    s.depth -= step * (0.45 + s.life)
    s.life -= dt * 0.55
    if (s.life <= 0 || s.depth < 0.8) {
      if (punch < 0.35) continue
      Object.assign(s, spawnStreak(false))
    }
    if (punch < 0.35) continue
    _center
      .copy(origin)
      .addScaledVector(_fwd, s.depth)
      .addScaledVector(_right, s.side)
      .addScaledVector(_up, s.lift)
    _axisA.copy(_fwd).multiplyScalar(s.len)
    _axisB.copy(_up).multiplyScalar(s.width)
    const alpha = Math.min(1, s.life) * punch * 0.55
    const hot = s.hot
    const color: Rgba = {
      r: 1.02 + hot * 0.08,
      g: 0.48 + hot * 0.1,
      b: 0.14,
      a: alpha,
    }
    v = writeQuad(positions, colors, v, _center, _axisA, _axisB, color)
  }
  paint(geom, v)
}

function writeRibbons(
  geom: THREE.BufferGeometry,
  positions: Float32Array,
  colors: Float32Array,
  histL: { x: number; y: number; z: number }[],
  histR: { x: number; y: number; z: number }[],
  fade: MutableRefObject<number>,
  kart: KartState,
  dt: number,
  punch: number,
) {
  const boosting = kart.boostTimer > 0
  fade.current = boosting ? 1 : Math.max(0, fade.current - dt * 1.6)
  kartAxes(kart.yaw, _fwd, _right)
  if (boosting) {
    pushHist(histL, kart, -0.34)
    pushHist(histR, kart, 0.34)
  } else if (histL.length) {
    if (Math.random() < dt * 10) {
      histL.shift()
      histR.shift()
    }
  }

  let v = 0
  const alpha = fade.current
  if (alpha > 0.02 && histL.length > 1) {
    v = ribbonStrip(positions, colors, v, histL, 0.55, alpha, false)
    v = ribbonStrip(positions, colors, v, histR, 0.55, alpha, false)
    v = ribbonStrip(positions, colors, v, histL, 0.18, alpha, true)
  }
  if (punch > 0.15) {
    kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.48, -1.15, _p)
    const up = _up.lengthSq() > 0.25 ? _up : _axisB.set(0, 1, 0)
    for (let i = 0; i < 6; i++) {
      const along = 0.15 + i * 0.34
      _center.copy(_p).addScaledVector(_fwd, -along)
      _axisA.copy(_fwd).multiplyScalar(0.28)
      _axisB.copy(up).multiplyScalar(0.22 + punch * 0.12)
      const a = (1 - i / 6) * punch
      v = writeQuad(positions, colors, v, _center, _axisA, _axisB, {
        r: 1.05,
        g: 0.38 + i * 0.04,
        b: 0.1,
        a: a * 0.85,
      })
    }
  }
  paint(geom, v)
}

function pushHist(
  hist: { x: number; y: number; z: number }[],
  kart: KartState,
  side: number,
) {
  kartToWorld(kart.x, kart.z, kart.yaw, side, 0.28, -1.05, _center)
  const last = hist[hist.length - 1]
  if (last) {
    const dx = last.x - _center.x
    const dz = last.z - _center.z
    if (dx * dx + dz * dz < 0.06) return
  }
  hist.push({ x: _center.x, y: _center.y, z: _center.z })
  if (hist.length > RIBBON) hist.shift()
}

function ribbonStrip(
  positions: Float32Array,
  colors: Float32Array,
  vertex: number,
  hist: { x: number; y: number; z: number }[],
  width: number,
  alpha: number,
  core: boolean,
): number {
  for (let i = 0; i < hist.length - 1; i++) {
    const a = hist[i]
    const b = hist[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const sx = (-dz / len) * width
    const sz = (dx / len) * width
    const t = i / (hist.length - 1)
    const fade = (1 - t) * alpha
    _center.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + 0.02, (a.z + b.z) * 0.5)
    _axisA.set(dx * 0.5, (b.y - a.y) * 0.5, dz * 0.5)
    _axisB.set(sx, 0.04, sz)
    const color: Rgba = core
      ? { r: 1.08, g: 0.72, b: 0.28, a: fade }
      : { r: 0.95 * (1 - t) + 0.28, g: 0.2 + t * 0.1, b: 0.07, a: fade * 0.9 }
    vertex = writeQuad(positions, colors, vertex, _center, _axisA, _axisB, color)
  }
  return vertex
}

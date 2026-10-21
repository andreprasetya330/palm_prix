import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { makePaintedGeometry, paint, writeQuad, type Rgba } from './quads'

const STREAKS = 36
const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

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
 * Hairline streaks at the frame edge.
 * While boosting, the camera stays at the idle chase distance so the kart does not shrink.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const streakGeom = useMemo(() => makePaintedGeometry(STREAKS * 6), [])
  const streaks = useRef<Streak[]>(
    Array.from({ length: STREAKS }, () => spawnStreak(true)),
  )

  const positions = streakGeom.getAttribute('position').array as Float32Array
  const colors = streakGeom.getAttribute('color').array as Float32Array

  useFrame((_, dt) => {
    const k = kartRef.current
    const boosting = k.boostTimer > 0
    kick.current = THREE.MathUtils.damp(kick.current, boosting ? 1 : 0, 7, dt)
    const punch = kick.current
    if (punch > 0.12) {
      camera.position.set(
        k.x - Math.sin(k.yaw) * CHASE_BACK,
        CHASE_HEIGHT,
        k.z - Math.cos(k.yaw) * CHASE_BACK,
      )
      camera.lookAt(k.x, 1.05, k.z)
      if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - 52) > 0.01) {
        camera.fov = 52
        camera.updateProjectionMatrix()
      }
    }
    writeStreaks(streakGeom, positions, colors, streaks.current, camera, punch, dt)
  })

  return (
    <mesh geometry={streakGeom} frustumCulled={false} renderOrder={6}>
      <meshBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
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

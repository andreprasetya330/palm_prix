import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld, makePaintedGeometry, paint, writeQuad, type Rgba } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

/**
 * A short plume leaves the exhaust, with thin streaks trailing from that pipe.
 * The camera stays at the idle chase distance so the kart does not shrink.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const streakGeom = useMemo(() => makePaintedGeometry(20 * 6), [])

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
    if (boosting) hideKartBoostFlame(scene)
    writePlume(streakGeom, positions, colors, k, punch)
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

/** The kart mesh draws a green boost cone. The still cannot keep that ball. */
function hideKartBoostFlame(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.PointLight)) return
    if (obj.color.getHex() !== 0x7dffb3) return
    if (obj.parent) obj.parent.visible = false
  })
}

const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _mouth = new THREE.Vector3()
const _center = new THREE.Vector3()
const _axisA = new THREE.Vector3()
const _axisB = new THREE.Vector3()

function writePlume(
  geom: THREE.BufferGeometry,
  positions: Float32Array,
  colors: Float32Array,
  kart: KartState,
  punch: number,
) {
  let v = 0
  if (punch > 0.2) {
    kartAxes(kart.yaw, _fwd, _right)
    kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.46, -0.98, _mouth)
    for (let i = 0; i < 8; i++) {
      const t = i / 7
      const along = 0.06 + t * 1.15
      const width = 0.055 * (1 - t * 0.55)
      _center.copy(_mouth).addScaledVector(_fwd, -along)
      _center.y += t * 0.16
      _axisA.copy(_fwd).multiplyScalar(0.12)
      _axisB.copy(_right).multiplyScalar(width).addScaledVector(_up, width * 0.65)
      const color: Rgba = {
        r: 1.1 - t * 0.28,
        g: 0.48 - t * 0.22,
        b: 0.1,
        a: (1 - t * 0.75) * punch,
      }
      v = writeQuad(positions, colors, v, _center, _axisA, _axisB, color)
    }
    for (let i = 0; i < 8; i++) {
      const side = (i - 3.5) * 0.07
      const along = 0.85 + (i % 4) * 0.28
      _center.copy(_mouth).addScaledVector(_fwd, -along).addScaledVector(_right, side)
      _center.y += 0.12 + (i % 3) * 0.08
      _axisA.copy(_fwd).multiplyScalar(0.34)
      _axisB.copy(_up).multiplyScalar(0.012)
      v = writeQuad(positions, colors, v, _center, _axisA, _axisB, {
        r: 1.02,
        g: 0.42,
        b: 0.12,
        a: 0.55 * punch,
      })
    }
  }
  paint(geom, v)
}

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
    if (punch > 0.12) camera.updateMatrixWorld()
    writePlume(streakGeom, positions, colors, k, camera, punch)
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
const _view = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _camUp = new THREE.Vector3()
const _dir = new THREE.Vector3()

function writePlume(
  geom: THREE.BufferGeometry,
  positions: Float32Array,
  colors: Float32Array,
  kart: KartState,
  camera: THREE.Camera,
  punch: number,
) {
  let v = 0
  if (punch > 0.2) {
    kartAxes(kart.yaw, _fwd, _right)
    kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.4, -1.12, _mouth)
    _view.copy(camera.position).sub(_mouth)
    if (_view.lengthSq() < 1e-4) _view.set(0, 0.2, 1)
    _view.normalize()
    _camRight.crossVectors(_up, _view)
    if (_camRight.lengthSq() < 1e-4) _camRight.copy(_right)
    _camRight.normalize()
    _camUp.crossVectors(_view, _camRight).normalize()

    for (let i = 0; i < 7; i++) {
      const t = i / 6
      _center.copy(_mouth).addScaledVector(_fwd, -(t * 0.72))
      _center.y += t * 0.08
      _axisA.copy(_camRight).multiplyScalar(0.1 + t * 0.16)
      _axisB.copy(_camUp).multiplyScalar(0.07 + t * 0.09)
      const hot = t < 0.34
      const color: Rgba = hot
        ? { r: 1.15, g: 0.9, b: 0.32, a: 0.92 * punch }
        : { r: 1.05, g: 0.4 - t * 0.12, b: 0.1, a: (0.88 - t * 0.4) * punch }
      v = writeQuad(positions, colors, v, _center, _axisA, _axisB, color)
    }

    for (let i = 0; i < 12; i++) {
      const side = (i - 5.5) / 5.5
      const outward = side >= 0 ? 1 : -1
      const fan = -0.08 - (i % 5) * 0.11
      _center.copy(_mouth).addScaledVector(_camRight, side * 0.2)
      _center.addScaledVector(_fwd, -0.12)
      _center.y += 0.03
      _dir.copy(_camRight).multiplyScalar(outward * (0.7 + Math.abs(side) * 0.45))
      _dir.addScaledVector(_camUp, fan)
      _dir.normalize()
      const len = 0.7 + Math.abs(side) * 1.05
      _center.addScaledVector(_dir, len * 0.5)
      _axisA.copy(_dir).multiplyScalar(len * 0.5)
      _axisB.crossVectors(_dir, _view)
      if (_axisB.lengthSq() < 1e-4) _axisB.copy(_camUp)
      _axisB.normalize().multiplyScalar(0.028)
      v = writeQuad(positions, colors, v, _center, _axisA, _axisB, {
        r: 1.05,
        g: 0.52,
        b: 0.16,
        a: 0.88 * punch,
      })
    }
  }
  paint(geom, v)
}

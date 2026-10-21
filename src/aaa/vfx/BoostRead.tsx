import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6
const STREAKS = 8

const flameTex = loadSprite(new URL('./assets/flame_05.png', import.meta.url).href)
const coreTex = loadSprite(new URL('./assets/muzzle_02.png', import.meta.url).href)
const traceTex = loadSprite(new URL('./assets/trace_02.png', import.meta.url).href)

/**
 * A soft plume leaves the exhaust, and the speed streaks start on that plume.
 * The camera stays at the idle chase distance so the kart does not shrink.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const coreRef = useRef<THREE.Sprite>(null)
  const flameRefs = useRef<Array<THREE.Sprite | null>>([])
  const streakRefs = useRef<Array<THREE.Sprite | null>>([])

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
      camera.updateMatrixWorld()
    }
    if (boosting) hideKartBoostFlame(scene)
    placePlume(k, camera, punch, coreRef.current, flameRefs.current, streakRefs.current)
  })

  return (
    <group>
      <sprite ref={coreRef} visible={false} renderOrder={6} frustumCulled={false}>
        <spriteMaterial
          map={coreTex}
          color="#ffd56a"
          transparent
          depthWrite={false}
          toneMapped={false}
          premultipliedAlpha={false}
        />
      </sprite>
      {[0, 1].map((i) => (
        <sprite
          key={`flame-${i}`}
          ref={(el) => {
            flameRefs.current[i] = el
          }}
          visible={false}
          renderOrder={6}
          frustumCulled={false}
        >
          <spriteMaterial
            map={flameTex}
            color={i === 0 ? '#ff7a32' : '#ffb15a'}
            transparent
            depthWrite={false}
            toneMapped={false}
            premultipliedAlpha={false}
          />
        </sprite>
      ))}
      {Array.from({ length: STREAKS }, (_, i) => (
        <sprite
          key={`streak-${i}`}
          ref={(el) => {
            streakRefs.current[i] = el
          }}
          visible={false}
          renderOrder={5}
          frustumCulled={false}
        >
          <spriteMaterial
            map={traceTex}
            color="#ff9a3c"
            transparent
            depthWrite={false}
            toneMapped={false}
            premultipliedAlpha={false}
          />
        </sprite>
      ))}
    </group>
  )
}

function loadSprite(url: string) {
  const tex = new THREE.TextureLoader().load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
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
const _view = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _camUp = new THREE.Vector3()
const _tip = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _ndcA = new THREE.Vector3()
const _ndcB = new THREE.Vector3()

function placePlume(
  kart: KartState,
  camera: THREE.Camera,
  punch: number,
  core: THREE.Sprite | null,
  flames: Array<THREE.Sprite | null>,
  streaks: Array<THREE.Sprite | null>,
) {
  const show = punch > 0.2
  if (!show) {
    if (core) core.visible = false
    flames.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    streaks.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    return
  }

  kartAxes(kart.yaw, _fwd, _right)
  kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.42, -1.16, _mouth)
  _view.copy(camera.position).sub(_mouth)
  if (_view.lengthSq() < 1e-4) _view.set(0, 0.2, 1)
  _view.normalize()
  _camRight.crossVectors(_up, _view)
  if (_camRight.lengthSq() < 1e-4) _camRight.copy(_right)
  _camRight.normalize()
  _camUp.crossVectors(_view, _camRight).normalize()

  if (core) {
    const mat = core.material as THREE.SpriteMaterial
    core.visible = true
    core.position.copy(_mouth)
    core.scale.set(0.48, 0.52, 1)
    mat.rotation = Math.PI
    mat.opacity = 0.9 * punch
  }

  flames.forEach((sprite, i) => {
    if (!sprite) return
    const mat = sprite.material as THREE.SpriteMaterial
    const len = i === 0 ? 1.28 : 1.02
    const side = i === 0 ? -0.1 : 0.12
    sprite.visible = true
    sprite.position.copy(_mouth).addScaledVector(_camRight, side).addScaledVector(_fwd, -len * 0.28)
    sprite.position.y += 0.02
    sprite.scale.set(i === 0 ? 0.46 : 0.34, len * 0.72, 1)
    mat.rotation = Math.PI + (i === 0 ? -0.12 : 0.14)
    mat.opacity = 0.88 * punch
  })

  streaks.forEach((sprite, i) => {
    if (!sprite) return
    const mat = sprite.material as THREE.SpriteMaterial
    const side = i - (STREAKS - 1) / 2
    const along = 0.9 + Math.abs(side) * 0.14
    const lateral = side * 0.3
    _tip.copy(_mouth).addScaledVector(_fwd, -along).addScaledVector(_right, lateral)
    _tip.y += 0.04
    _dir.copy(_tip).sub(_mouth)
    const worldLen = _dir.length()
    if (worldLen < 1e-4) return
    _dir.multiplyScalar(1 / worldLen)
    const facing = Math.abs(_dir.dot(_view))
    const visLen = worldLen * Math.sqrt(Math.max(0.08, 1 - facing * facing))
    _ndcA.copy(_mouth).project(camera)
    _ndcB.copy(_tip).project(camera)
    sprite.visible = true
    sprite.position.copy(_mouth).lerp(_tip, 0.5)
    sprite.scale.set(0.1, visLen, 1)
    mat.rotation = Math.atan2(_ndcB.x - _ndcA.x, _ndcB.y - _ndcA.y)
    mat.opacity = 0.9 * punch
  })
}

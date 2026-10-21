import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

/** roll, length along the road, cross-section width, opacity, color */
const RIBBONS: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [0.2, 2.15, 0.62, 0.9, '#ff7a28'],
  [1.05, 1.95, 0.46, 0.75, '#ff5418'],
  [1.8, 1.75, 0.4, 0.65, '#ffb15a'],
]

const flameTex = loadTongue(new URL('./assets/flame_05.png', import.meta.url).href)
const coreTex = loadSprite(new URL('./assets/muzzle_02.png', import.meta.url).href)

/**
 * The white core stays on the pipe. The tongue runs back along the road
 * for the full length of the ribbon, not a spark on the bumper.
 * The camera stays at the idle chase distance so the kart does not shrink.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const coreRef = useRef<THREE.Sprite>(null)
  const ribbonRefs = useRef<Array<THREE.Mesh | null>>([])

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
    placePlume(k, punch, coreRef.current, ribbonRefs.current)
  })

  return (
    <group>
      {RIBBONS.map((_, i) => (
        <mesh
          key={`ribbon-${i}`}
          ref={(el) => {
            ribbonRefs.current[i] = el
          }}
          visible={false}
          renderOrder={6}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={flameTex}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
            premultipliedAlpha={false}
          />
        </mesh>
      ))}
      <sprite ref={coreRef} visible={false} renderOrder={8} frustumCulled={false}>
        <spriteMaterial
          map={coreTex}
          color="#fffef8"
          transparent
          depthWrite={false}
          toneMapped={false}
          premultipliedAlpha={false}
        />
      </sprite>
    </group>
  )
}

function loadSprite(url: string) {
  const tex = new THREE.TextureLoader().load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Crop to the flame graphic so the ribbon is fire for its whole length. */
function loadTongue(url: string) {
  const tex = loadSprite(url)
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.offset.set(213 / 512, 140 / 512)
  tex.repeat.set(92 / 512, 252 / 512)
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
const _aft = new THREE.Vector3()
const _side = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _basis = new THREE.Matrix4()

function placePlume(
  kart: KartState,
  punch: number,
  core: THREE.Sprite | null,
  ribbons: Array<THREE.Mesh | null>,
) {
  const show = punch > 0.2
  if (!show) {
    if (core) core.visible = false
    ribbons.forEach((mesh) => {
      if (mesh) mesh.visible = false
    })
    return
  }

  kartAxes(kart.yaw, _fwd, _right)
  kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.42, -1.16, _mouth)
  _aft.copy(_fwd).multiplyScalar(-1)

  ribbons.forEach((mesh, i) => {
    const spec = RIBBONS[i]
    if (!mesh || !spec) return
    const [roll, length, width, opacity, color] = spec
    _side.crossVectors(_up, _aft)
    if (_side.lengthSq() < 1e-4) _side.copy(_right)
    _side.normalize().applyAxisAngle(_aft, roll)
    _normal.crossVectors(_side, _aft).normalize()
    _basis.makeBasis(_side, _aft, _normal)
    mesh.quaternion.setFromRotationMatrix(_basis)
    mesh.scale.set(width, length, 1)
    mesh.position.copy(_mouth).addScaledVector(_aft, length * 0.5)
    mesh.visible = true
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = opacity * punch
    mat.color.set(color)
  })

  if (core) {
    const mat = core.material as THREE.SpriteMaterial
    core.visible = true
    core.position.copy(_mouth)
    core.scale.set(0.42, 0.46, 1)
    mat.rotation = Math.PI
    mat.opacity = punch
  }
}

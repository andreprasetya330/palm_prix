import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

/** roll, length along the road, width, height of the crown, opacity, color */
const RIBBONS: ReadonlyArray<readonly [number, number, number, number, number, string]> = [
  [0, 1.26, 0.92, 0.74, 0.98, '#ffffff'],
]

/**
 * The white core stays on the pipe. The lick stays short and aimed down the
 * road, with a yellow crown and a red lip so the edge has thickness.
 * The camera stays at the idle chase distance.
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
          geometry={flameGeo}
          visible={false}
          renderOrder={6}
          frustumCulled={false}
        >
          <meshBasicMaterial
            vertexColors
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

const FLAME_ROWS = 18
const FLAME_SEGS = 12

/** Hot crown, darker lip. t is 0 at the exhaust and 1 at the lick. */
function flameRgb(t: number, rim: boolean): [number, number, number] {
  if (rim) return [0.62 + (1 - t) * 0.22, 0.06 + (1 - t) * 0.08, 0.015]
  return [1, 0.94 * (1 - t) + 0.2 * t, 0.62 * (1 - t) * (1 - t) + 0.04]
}

/** Half-tube: wide on the road, crowned upward, pinched at the lick. */
function makeFlameGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const cols = FLAME_SEGS + 1
  for (let row = 0; row < FLAME_ROWS; row++) {
    const t = row / (FLAME_ROWS - 1)
    const ly = -0.5 + t
    const profile = Math.pow(1 - t, 0.62) * (0.78 + 0.22 * Math.sin(t * Math.PI))
    const wobble = 1 + 0.06 * Math.sin(t * 11.0) 
    const radX = 0.5 * profile * wobble
    const radZ = profile
    const hot = flameRgb(t, false)
    const rim = flameRgb(t, true)
    for (let s = 0; s < cols; s++) {
      const ang = (s / FLAME_SEGS) * Math.PI
      const lift = Math.sin(ang)
      positions.push(Math.cos(ang) * radX, ly, lift * radZ)
      const k = Math.pow(lift, 0.5)
      colors.push(
        rim[0] + (hot[0] - rim[0]) * k,
        rim[1] + (hot[1] - rim[1]) * k,
        rim[2] + (hot[2] - rim[2]) * k,
      )
    }
    if (row === 0) continue
    const prev = (row - 1) * cols
    const curr = row * cols
    for (let s = 0; s < FLAME_SEGS; s++) {
      const a = prev + s
      const c = curr + s
      indices.push(a, a + 1, c + 1, a, c + 1, c)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  return geo
}

const flameGeo = makeFlameGeometry()
const coreTex = loadSprite(new URL('./assets/muzzle_02.png', import.meta.url).href)

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
    const [roll, length, width, height, opacity, color] = spec
    _side.crossVectors(_up, _aft)
    if (_side.lengthSq() < 1e-4) _side.copy(_right)
    _side.normalize().applyAxisAngle(_aft, roll)
    _normal.crossVectors(_side, _aft).normalize()
    _basis.makeBasis(_side, _aft, _normal)
    mesh.quaternion.setFromRotationMatrix(_basis)
    mesh.scale.set(width, length, height)
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

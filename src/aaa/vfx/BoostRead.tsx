import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

/** roll, length along the road, width, height of the rim, opacity, color */
const RIBBONS: ReadonlyArray<readonly [number, number, number, number, number, string]> = [
  [0, 1.22, 0.92, 0.42, 1, '#ffffff'],
]

/**
 * The white core stays on the pipe. The wide crown stays seated, the point
 * stays short of the pace bar, and a raised rim gives the edge thickness.
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
            depthWrite
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
          depthTest={false}
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

const FLAME_STEPS = 24

/** t is 0 at the pipe and 1 at the point. */
function flameProfile(t: number): number {
  return Math.pow(1 - t, 0.55) * (0.84 + 0.16 * Math.sin(t * Math.PI))
}

function pushVert(
  positions: number[],
  colors: number[],
  x: number,
  y: number,
  z: number,
  rgb: readonly [number, number, number],
): number {
  const index = positions.length / 3
  positions.push(x, y, z)
  colors.push(rgb[0], rgb[1], rgb[2])
  return index
}

/**
 * A teardrop face plus a rim that stands up off it. The rim is the thickness
 * the chase camera can see around the edge.
 */
function makeFlameGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const back: number[] = []
  const seam: number[] = []
  const front: number[] = []
  const ring: Array<readonly [number, number]> = []
  for (let i = FLAME_STEPS; i >= 0; i--) ring.push([i / FLAME_STEPS, 1])
  for (let i = 1; i < FLAME_STEPS; i++) ring.push([i / FLAME_STEPS, -1])
  const lip: [number, number, number] = [1, 0.28, 0.02]
  const face: [number, number, number] = [1, 0.94, 0.42]

  for (const [t, sign] of ring) {
    const y = -0.5 + t
    const width = flameProfile(t)
    const rise = Math.pow(1 - t, 0.6)
    const lick = 1 + 0.08 * Math.sin(t * Math.PI * 4)
    const outerX = sign * 0.5 * width * lick
    const innerX = sign * 0.5 * width * 0.48
    const innerZ = 0.7 * rise
    back.push(pushVert(positions, colors, outerX, y - 0.08 * rise, 0, lip))
    seam.push(pushVert(positions, colors, innerX, y, innerZ, lip))
    front.push(pushVert(positions, colors, innerX, y, innerZ, face))
  }

  const n = back.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(back[i], back[j], seam[j], back[i], seam[j], seam[i])
  }

  const faceHot: [number, number, number] = [1, 0.98, 0.7]
  const hub = pushVert(positions, colors, 0, -0.16, 0.4, faceHot)
  for (let i = 0; i < n; i++) indices.push(hub, front[i], front[(i + 1) % n])

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
    _side.crossVectors(_aft, _up)
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

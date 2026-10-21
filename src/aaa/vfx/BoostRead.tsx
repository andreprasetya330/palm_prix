import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../../game/kartPhysics'
import { kartAxes, kartToWorld } from './quads'

const CHASE_BACK = 6.5
const CHASE_HEIGHT = 3.6

/** Soft puffs stacked along the road, widening as they leave the core. */
const BANDS: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [0.22, 0.18, 0.78, 0.94, '#fff1b8'],
  [0.68, 0.34, 1.02, 0.86, '#ff9a3c'],
  [1.18, 0.48, 1.16, 0.78, '#ff6a24'],
  [1.72, 0.58, 1.22, 0.66, '#ff4e18'],
]
const PUFF_PER_BAND = 4
const PUFFS = BANDS.length * PUFF_PER_BAND

const puffTex = loadSprite(new URL('./assets/muzzle_02.png', import.meta.url).href)
const coreTex = loadSprite(new URL('./assets/muzzle_02.png', import.meta.url).href)

/**
 * A thick plume leaves the exhaust. The white core and the fire point back along the road.
 * The camera stays at the idle chase distance so the kart does not shrink.
 */
export function BoostRead({ kart }: { kart: KartState }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const kartRef = useRef(kart)
  kartRef.current = kart
  const kick = useRef(0)
  const coreRef = useRef<THREE.Sprite>(null)
  const puffRefs = useRef<Array<THREE.Sprite | null>>([])

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
    placePlume(k, punch, coreRef.current, puffRefs.current)
  })

  return (
    <group>
      {Array.from({ length: PUFFS }, (_, i) => (
        <sprite
          key={`puff-${i}`}
          ref={(el) => {
            puffRefs.current[i] = el
          }}
          visible={false}
          renderOrder={6}
          frustumCulled={false}
        >
          <spriteMaterial
            map={puffTex}
            transparent
            depthWrite={false}
            toneMapped={false}
            premultipliedAlpha={false}
          />
        </sprite>
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
const _mouth = new THREE.Vector3()

function placePlume(
  kart: KartState,
  punch: number,
  core: THREE.Sprite | null,
  puffs: Array<THREE.Sprite | null>,
) {
  const show = punch > 0.2
  if (!show) {
    if (core) core.visible = false
    puffs.forEach((sprite) => {
      if (sprite) sprite.visible = false
    })
    return
  }

  kartAxes(kart.yaw, _fwd, _right)
  kartToWorld(kart.x, kart.z, kart.yaw, 0, 0.42, -1.16, _mouth)

  let index = 0
  for (const [along, radius, scale, opacity, color] of BANDS) {
    for (let n = 0; n < PUFF_PER_BAND; n += 1) {
      const sprite = puffs[index]
      index += 1
      if (!sprite) continue
      const turn = (n / PUFF_PER_BAND) * Math.PI * 2 + along
      const side = Math.cos(turn) * radius
      const lift = Math.sin(turn) * radius * 0.55
      const mat = sprite.material as THREE.SpriteMaterial
      sprite.visible = true
      sprite.position.copy(_mouth).addScaledVector(_fwd, -along).addScaledVector(_right, side)
      sprite.position.y += 0.08 + lift
      if (sprite.position.y < 0.22) sprite.position.y = 0.22
      sprite.scale.set(scale, scale * 1.2, 1)
      mat.rotation = turn * 0.2
      mat.opacity = opacity * punch
      mat.color.set(color)
    }
  }

  if (core) {
    const mat = core.material as THREE.SpriteMaterial
    core.visible = true
    core.position.copy(_mouth)
    core.scale.set(0.58, 0.62, 1)
    mat.rotation = Math.PI
    mat.opacity = punch
  }
}

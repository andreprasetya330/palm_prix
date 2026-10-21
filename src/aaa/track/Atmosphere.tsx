import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'
import type { TrackTextures } from './textures'

/** Right of the gate and behind the chase, so shadows fall across the road ahead. */
const SUN = new THREE.Vector3(24, 14, 26)

function SkyDome() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(150, 28, 18)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const horizon = new THREE.Color(palette.skyHorizon)
    const mid = new THREE.Color('#8ec8ee')
    const zenith = new THREE.Color(palette.skyZenith)
    const sunCol = new THREE.Color(palette.sun)
    const c = new THREE.Color()
    const dir = new THREE.Vector3()
    const sunDir = SUN.clone().normalize()
    for (let i = 0; i < pos.count; i++) {
      dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
      const h = THREE.MathUtils.clamp(dir.y, 0, 1)
      const lift = h * h * (3 - 2 * h)
      c.copy(horizon).lerp(mid, THREE.MathUtils.smoothstep(h, 0.02, 0.28))
      c.lerp(zenith, lift)
      const glow = Math.pow(Math.max(0, dir.dot(sunDir)), 14)
      c.lerp(sunCol, glow * 0.85)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  return (
    <mesh geometry={geo} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

function CloudPuff({
  position,
  scale,
  phase,
}: {
  position: [number, number, number]
  scale: number
  phase: number
}) {
  const ref = useMemo(() => ({ current: null as THREE.Group | null }), [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.position.x = position[0] + Math.sin(clock.elapsedTime * 0.08 + phase) * 1.6
  })
  return (
    <group
      ref={(node) => {
        ref.current = node
      }}
      position={position}
      scale={scale}
    >
      {[
        [0, 0, 0, 1.15],
        [1.15, 0.18, 0.15, 0.86],
        [-1.05, 0.1, -0.1, 0.9],
        [0.25, 0.48, 0.05, 0.7],
        [-0.2, -0.15, 0.4, 0.62],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 12, 10]} />
          <meshStandardMaterial color={palette.cloud} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

export function Atmosphere({ textures }: { textures: TrackTextures }) {
  const { scene } = useThree()

  useLayoutEffect(() => {
    if (scene.userData.palmPrixLight) return
    scene.userData.palmPrixLight = true
    scene.traverse((obj) => {
      if ((obj as THREE.HemisphereLight).isHemisphereLight) {
        const hemi = obj as THREE.HemisphereLight
        hemi.intensity = 0.14
        hemi.color.set('#d7ecff')
        hemi.groundColor.set('#6aaf62')
      } else if ((obj as THREE.AmbientLight).isAmbientLight) {
        ;(obj as THREE.AmbientLight).intensity = 0.06
      } else if ((obj as THREE.DirectionalLight).isDirectionalLight) {
        const sun = obj as THREE.DirectionalLight
        if (sun.castShadow) {
          sun.intensity = 3.5
          sun.color.set('#fff0c4')
          sun.position.set(SUN.x, SUN.y, SUN.z)
          sun.target.position.set(-14, 0, 4)
          scene.add(sun.target)
          const cam = sun.shadow.camera
          cam.left = -48
          cam.right = 48
          cam.top = 48
          cam.bottom = -48
          cam.near = 1
          cam.far = 160
          cam.updateProjectionMatrix()
          sun.shadow.bias = -0.00025
          sun.shadow.normalBias = 0.04
          sun.shadow.mapSize.set(2048, 2048)
        } else {
          sun.intensity = 0
        }
      }
      const mesh = obj as THREE.Mesh
      const mat = mesh.material
      if (mat && !Array.isArray(mat)) {
        const shader = mat as THREE.ShaderMaterial
        if (shader.uniforms?.sunPosition && shader.uniforms?.turbidity) mesh.visible = false
      }
    })
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(palette.skyHorizon)
      scene.fog.near = 90
      scene.fog.far = 210
    }
    scene.background = new THREE.Color(palette.skyHorizon)
  }, [scene])

  return (
    <group>
      <SkyDome />
      <sprite position={[11, 6.4, 16]} scale={[6.2, 6.2, 1]}>
        <spriteMaterial map={textures.sun} transparent depthWrite={false} fog={false} />
      </sprite>
      <CloudPuff position={[-24, 8.2, 2]} scale={0.85} phase={0.2} />
      <CloudPuff position={[2, 10.4, -36]} scale={1.05} phase={1.1} />
      <CloudPuff position={[-22, 9.2, -34]} scale={0.9} phase={2.2} />
      <CloudPuff position={[26, 8.6, -4]} scale={0.7} phase={0.6} />
    </group>
  )
}

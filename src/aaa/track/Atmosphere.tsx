import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'
import type { TrackTextures } from './textures'

const SUN = new THREE.Vector3(10, 14, -16)

function SkyDome() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(150, 28, 18)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const horizon = new THREE.Color('#d9f1ff')
    const mid = new THREE.Color(palette.skyHorizon)
    const zenith = new THREE.Color(palette.skyZenith)
    const sunCol = new THREE.Color(palette.sun)
    const c = new THREE.Color()
    const dir = new THREE.Vector3()
    const sunDir = SUN.clone().normalize()
    for (let i = 0; i < pos.count; i++) {
      dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
      const h = THREE.MathUtils.clamp(dir.y, 0, 1)
      c.copy(horizon).lerp(mid, Math.min(1, h * 3.2))
      if (h > 0.28) c.lerp(zenith, (h - 0.28) / 0.72)
      const glow = Math.pow(Math.max(0, dir.dot(sunDir)), 10)
      c.lerp(sunCol, glow)
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
        <mesh key={i} position={[x, y, z]} castShadow>
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
        hemi.intensity = 0.22
        hemi.color.set('#d7f3ff')
        hemi.groundColor.set('#8fbf62')
      } else if ((obj as THREE.AmbientLight).isAmbientLight) {
        ;(obj as THREE.AmbientLight).intensity = 0.07
      } else if ((obj as THREE.DirectionalLight).isDirectionalLight) {
        const sun = obj as THREE.DirectionalLight
        if (sun.castShadow) {
          sun.intensity = 3.15
          sun.color.set('#fff2cc')
          sun.position.set(SUN.x, SUN.y, SUN.z)
          const cam = sun.shadow.camera
          cam.left = -60
          cam.right = 40
          cam.top = 40
          cam.bottom = -60
          cam.far = 140
          cam.updateProjectionMatrix()
          sun.shadow.bias = -0.00035
          sun.shadow.normalBias = 0.035
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
      scene.fog.color.set('#c5e4ff')
      scene.fog.near = 70
      scene.fog.far = 170
    }
    scene.background = new THREE.Color('#8ec8ff')
  }, [scene])

  return (
    <group>
      <SkyDome />
      <sprite position={[7.5, 5.6, -10]} scale={[5.5, 5.5, 1]}>
        <spriteMaterial map={textures.sun} transparent depthWrite={false} fog={false} />
      </sprite>
      <CloudPuff position={[-6, 4.8, -6]} scale={0.85} phase={0.2} />
      <CloudPuff position={[4, 5.4, -14]} scale={1.05} phase={1.1} />
      <CloudPuff position={[-12, 5.1, -18]} scale={0.9} phase={2.2} />
      <CloudPuff position={[14, 4.6, -2]} scale={0.7} phase={0.6} />
    </group>
  )
}

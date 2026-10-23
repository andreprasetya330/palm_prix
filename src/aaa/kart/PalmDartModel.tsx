import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, type MutableRefObject } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import palmDartUrl from './models/palm-dart.glb?url'

export const PALM_DART_MODEL_URL = palmDartUrl

const WHEEL_NAMES = new Set(['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'])
const FRONT_WHEELS = new Set(['WheelFL', 'WheelFR'])

type PalmDartModelProps = ThreeElements['group'] & {
  speed?: number
  /** Shared with HeroKart so front wheels yaw without a React re-render. */
  steerRef?: MutableRefObject<number>
}

/**
 * Blender-authored Palm Dart. Original Palm Prix hero kart.
 * Wheels spin on local X; front wheels also yaw from `steerRef`.
 * HeroKart mounts this by default. Road, physics, and HUD stay in code.
 * Use `?mesh=code` on the race URL for the procedural body.
 */
export function PalmDartModel({ speed = 0, steerRef, ...props }: PalmDartModelProps) {
  const gltf = useGLTF(palmDartUrl)
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    // The original baked driver ignored personalized faces. Use our live driver instead.
    clone.traverse((obj) => {
      if (obj.name === 'Driver' || obj.name.startsWith('Glove') || /^Arm-?1$/.test(obj.name)) obj.visible = false
      // These oversized freestanding letters sit behind the wheels like extra fins.
      // Keep the smaller wheel-hub and wing emblems instead.
      if (obj.name.startsWith('SidewallMark')) obj.visible = false
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const adjust = (source: MeshStandardMaterial) => {
        const material = source.clone()
        if (['Sidewall', 'SidewallInk', 'TireRubber'].includes(material.name)) {
          material.color.set('#20242c'); material.roughness = 0.92; material.metalness = 0
        }
        if (material.name === 'CoralPaint') { material.color.set('#ec5670'); material.roughness = 0.28; material.metalness = 0.18 }
        if (material.name === 'TeamBlue') { material.color.set('#1d7182'); material.roughness = 0.35 }
        return material
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => adjust(m as MeshStandardMaterial)) : adjust(mesh.material as MeshStandardMaterial)
    })
    return clone
  }, [gltf.scene])
  useEffect(() => () => model.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  }), [model])
  const wheels = useMemo(() => {
    const found: Object3D[] = []
    model.traverse((obj) => {
      if (WHEEL_NAMES.has(obj.name)) found.push(obj)
    })
    return found
  }, [model])
  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [model])
  useFrame((_, dt) => {
    const spin = speed * 2.3 * Math.min(0.05, dt)
    const steer = steerRef?.current ?? 0
    for (const wheel of wheels) {
      wheel.rotation.x += spin
      if (FRONT_WHEELS.has(wheel.name)) wheel.rotation.y = steer
    }
  })
  return <primitive object={model} {...props} />
}

useGLTF.preload(palmDartUrl)

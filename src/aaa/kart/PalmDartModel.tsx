import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { Mesh, Object3D } from 'three'
import palmDartUrl from './models/palm-dart.glb?url'

export const PALM_DART_MODEL_URL = palmDartUrl

const WHEEL_NAMES = new Set(['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'])

type PalmDartModelProps = ThreeElements['group'] & {
  speed?: number
}

/**
 * Blender-authored Palm Dart. Original Palm Prix hero kart.
 * `WheelFL`, `WheelFR`, `WheelRL`, and `WheelRR` spin on local X.
 * HeroKart mounts this for the chase and the close-up. Road, physics, and HUD stay in code.
 */
export function PalmDartModel({ speed = 0, ...props }: PalmDartModelProps) {
  const gltf = useGLTF(palmDartUrl)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
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
    for (const wheel of wheels) wheel.rotation.x += spin
  })
  return <primitive object={model} {...props} />
}

useGLTF.preload(palmDartUrl)

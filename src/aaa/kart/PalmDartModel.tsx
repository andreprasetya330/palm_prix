import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, type MutableRefObject } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { Mesh, Object3D } from 'three'
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
    const steer = steerRef?.current ?? 0
    for (const wheel of wheels) {
      wheel.rotation.x += spin
      if (FRONT_WHEELS.has(wheel.name)) wheel.rotation.y = steer
    }
  })
  return <primitive object={model} {...props} />
}

useGLTF.preload(palmDartUrl)

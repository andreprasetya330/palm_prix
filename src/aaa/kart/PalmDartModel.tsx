import { useGLTF } from '@react-three/drei'
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { Group, Mesh, Object3D } from 'three'
import palmDartUrl from './models/palm-dart.glb?url'

export const PALM_DART_MODEL_URL = palmDartUrl

export const PALM_DART_WHEEL_NAMES = ['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'] as const

export type PalmDartWheels = {
  WheelFL: Object3D | null
  WheelFR: Object3D | null
  WheelRL: Object3D | null
  WheelRR: Object3D | null
}

/**
 * Blender-authored Palm Dart. Original Palm Prix hero kart.
 * Wheel empties spin on local X; front wheels also yaw for steer.
 * Road, physics, and HUD stay in code. Use `?mesh=code` on HeroKart for the procedural meshes.
 */
export const PalmDartModel = forwardRef<Group, ThreeElements['group']>(function PalmDartModel(
  props,
  ref,
) {
  const gltf = useGLTF(palmDartUrl)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  useImperativeHandle(ref, () => model, [model])
  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [model])
  return <primitive object={model} {...props} />
})

export function findPalmDartWheels(root: Object3D | null): PalmDartWheels {
  return {
    WheelFL: root?.getObjectByName('WheelFL') ?? null,
    WheelFR: root?.getObjectByName('WheelFR') ?? null,
    WheelRL: root?.getObjectByName('WheelRL') ?? null,
    WheelRR: root?.getObjectByName('WheelRR') ?? null,
  }
}

useGLTF.preload(palmDartUrl)

import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { Mesh } from 'three'
import palmDartUrl from './models/palm-dart.glb?url'

export const PALM_DART_MODEL_URL = palmDartUrl

/**
 * Blender-authored Palm Dart. Original Palm Prix hero kart.
 * `WheelFL`, `WheelFR`, `WheelRL`, and `WheelRR` spin on local X.
 * This does not replace the procedural kart. Road, physics, and HUD stay in code.
 */
export function PalmDartModel(props: ThreeElements['group']) {
  const gltf = useGLTF(palmDartUrl)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
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
}

useGLTF.preload(palmDartUrl)

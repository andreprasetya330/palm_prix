import { useMemo } from 'react'
import * as THREE from 'three'

/** Data maps stay linear. Repeat is in tile counts across the mesh UV. */
export function useLinearMap(url: string, repeatX: number, repeatY: number) {
  return useMemo(() => {
    const tex = new THREE.TextureLoader().load(url)
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    return tex
  }, [url, repeatX, repeatY])
}

export const rubberNormalScale = new THREE.Vector2(0.55, 0.55)
export const clothNormalScale = new THREE.Vector2(0.7, 0.7)

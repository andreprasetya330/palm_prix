import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'

type Props = { kart: KartState }

export function FollowCamera({ kart }: Props) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())

  useFrame(() => {
    const back = 7
    const height = 4
    const targetX = kart.x - Math.sin(kart.yaw) * back
    const targetZ = kart.z - Math.cos(kart.yaw) * back
    camera.position.lerp(
      new THREE.Vector3(targetX, height, targetZ),
      0.08,
    )
    look.current.set(kart.x, 0.8, kart.z)
    camera.lookAt(look.current)
  })

  return null
}

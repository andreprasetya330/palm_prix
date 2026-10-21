import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'

type Props = { kart: KartState }

/** Arcade chase cam — a bit higher and snappier for Mario Kart energy. */
export function FollowCamera({ kart }: Props) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())

  useFrame(() => {
    const speedFactor = Math.min(1, Math.abs(kart.speed) / 28)
    const back = 6.5 + speedFactor * 1.4
    const height = 3.6 + speedFactor * 0.6
    desired.current.set(
      kart.x - Math.sin(kart.yaw) * back,
      height,
      kart.z - Math.cos(kart.yaw) * back,
    )
    camera.position.lerp(desired.current, 0.1)
    look.current.set(kart.x, 1.0 + speedFactor * 0.2, kart.z)
    camera.lookAt(look.current)
  })

  return null
}

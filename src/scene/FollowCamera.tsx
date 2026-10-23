import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { KartState } from '../game/kartPhysics'

export function FollowCamera({ kart, showcase = false }: { kart: KartState; showcase?: boolean }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(kart.x, 1, kart.z))
  const desired = useRef(new THREE.Vector3())
  const initialized = useRef(false)
  useFrame(({ clock }, dt) => {
    const f = Math.min(1, Math.abs(kart.speed) / 30)
    if (showcase) {
      const angle = -0.72 + Math.sin(clock.elapsedTime * 0.045) * 0.07
      desired.current.set(kart.x + Math.sin(angle) * 13, 6.0, kart.z + Math.cos(angle) * 13)
    } else {
      const back = 7 + f * 1.2
      desired.current.set(kart.x - Math.sin(kart.yaw) * back, 3.8 + f * 0.65, kart.z - Math.cos(kart.yaw) * back)
    }
    if (!initialized.current) { camera.position.copy(desired.current); initialized.current = true }
    camera.position.lerp(desired.current, 1 - Math.exp(-6 * dt))
    look.current.lerp(new THREE.Vector3(kart.x + (showcase ? -3.5 : Math.sin(kart.yaw) * 3), showcase ? 1.5 : 0.9, kart.z + (showcase ? -3 : Math.cos(kart.yaw) * 3)), 1 - Math.exp(-9 * dt))
    camera.lookAt(look.current)
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = showcase ? 45 : 52 + f * 7 + (kart.boostTimer > 0 ? 5 : 0)
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-4 * dt))
      camera.updateProjectionMatrix()
    }
  })
  return null
}


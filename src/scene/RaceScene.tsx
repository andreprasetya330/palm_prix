import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import type { KartState } from '../game/kartPhysics'
import { FollowCamera } from './FollowCamera'
import { Kart } from './Kart'
import { Track } from './Track'
import { palette } from './palette'

type Props = {
  kart: KartState
  driverTextureUrl: string | null
}

export function RaceScene({ kart, driverTextureUrl }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 6, 14], fov: 52 }}
      dpr={[1, 1.75]}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}
    >
      <color attach="background" args={[palette.skyNear]} />
      {/* bright, playful lighting — not photoreal */}
      <hemisphereLight
        args={[palette.skyNear, palette.grass, 0.85]}
      />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[24, 36, 12]}
        intensity={1.45}
        color="#fff4d6"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <directionalLight position={[-18, 12, -10]} intensity={0.35} color="#a8d8ff" />
      <Sky
        sunPosition={[50, 28, 20]}
        turbidity={3.5}
        rayleigh={0.65}
        mieCoefficient={0.004}
        mieDirectionalG={0.85}
      />
      <fog attach="fog" args={[palette.fog, 55, 110]} />
      <Track />
      <Kart kart={kart} driverTextureUrl={driverTextureUrl} />
      <FollowCamera kart={kart} />
    </Canvas>
  )
}

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'
import { LAGOON, lateralOf } from './spline'
import type { TrackTextures } from './textures'

/** West bank of the lagoon only. The east shore sat on the chase line. */
const palms: [number, number, number, number, number][] = [
  [-19.2, 0, 1.4, 0.62, 0.18],
  [-19.8, 0, 5.6, 0.7, -0.12],
  [-18.8, 0, 9.4, 0.58, 0.1],
  [-19.4, 0, 13.0, 0.66, 0.16],
]

function frondGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.16, 0.22, 0.12, 0.48, 0.01, 0.68)
  shape.bezierCurveTo(-0.06, 0.46, -0.16, 0.2, 0, 0)
  const geo = new THREE.ShapeGeometry(shape, 4)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setZ(i, y * y * 0.05)
  }
  geo.computeVertexNormals()
  return geo
}

function Palm({
  position,
  scale,
  lean,
  bark,
}: {
  position: [number, number, number]
  scale: number
  lean: number
  bark: THREE.Texture
}) {
  const trunk = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 0.3, 1.15, 0.05),
      new THREE.Vector3(lean * 0.75, 2.35, lean * 0.08),
      new THREE.Vector3(lean, 3.45, 0),
    ])
    const geo = new THREE.TubeGeometry(curve, 7, 0.17, 6, false)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const k = 1.25 - (y / 3.6) * 0.62
      pos.setX(i, pos.getX(i) * k)
      pos.setZ(i, pos.getZ(i) * k)
    }
    geo.computeVertexNormals()
    return geo
  }, [lean])
  const frond = useMemo(() => frondGeometry(), [])

  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunk} castShadow>
        <meshStandardMaterial map={bark} color={palette.trunk} roughness={0.86} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        const lite = i % 2 === 0
        return (
          <mesh
            key={i}
            geometry={frond}
            position={[Math.sin(a) * 0.06, 3.35, Math.cos(a) * 0.06]}
            rotation={[0.38, a, 0.08]}
            castShadow
          >
            <meshStandardMaterial
              color={lite ? palette.frondLite : palette.frond}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function Grass({
  fiber,
  fiberNormal,
  straw,
}: {
  fiber: THREE.Texture
  fiberNormal: THREE.Texture
  straw: THREE.Texture
}) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(210, 210, 160, 160)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const lawn = new THREE.Color('#f4fff2')
    const strawTone = new THREE.Color('#f0c48a')
    const far = new THREE.Color(palette.grassFar)
    const c = new THREE.Color()
    // Berm on the inside of the first corner only. The lagoon shore stays flat asphalt.
    const crestLat = -5.6
    const half = 1.35
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - 16
      const z = pos.getZ(i) + 2
      const lat = lateralOf(x, z)
      const horizon = THREE.MathUtils.clamp((Math.hypot(x + 16, z - 7) - 26) / 52, 0, 1)
      const along = lat - crestLat
      const besideRoad = z < -2 && Math.abs(along) < half
      c.copy(lawn)
      if (besideRoad) {
        c.copy(along >= 0 ? strawTone : lawn)
        const rise = 1.25 * Math.max(0, 1 - Math.abs(along) / half)
        pos.setY(i, pos.getY(i) + rise)
      }
      c.lerp(far, horizon * horizon)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    const normals = g.attributes.normal
    for (let i = 0; i < normals.count; i++) {
      if (normals.getY(i) < 0) {
        normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i))
      }
    }
    return g
  }, [])

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: fiber,
      normalMap: fiberNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true,
      roughness: 0.78,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uStraw = { value: straw }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vStraw;')
        .replace(
          '#include <color_vertex>',
          '#include <color_vertex>\nvStraw = vColor.r > vColor.g * 1.05 ? 1.0 : 0.0;',
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uStraw;\nvarying float vStraw;')
        .replace(
          '#include <map_fragment>',
          `vec3 lawnPhoto = texture2D(map, vMapUv).rgb;
           float blade = smoothstep(0.02, 0.28, lawnPhoto.g - lawnPhoto.r * 0.35);
           vec3 fiber = mix(vec3(0.07, 0.26, 0.08), vec3(0.78, 1.0, 0.46), blade);
           vec3 strawPhoto = texture2D(uStraw, vMapUv * 0.18).rgb;
           diffuseColor.rgb *= mix(fiber, strawPhoto, vStraw);`,
        )
    }
    return mat
  }, [fiber, fiberNormal, straw])

  return (
    <mesh
      geometry={geo}
      material={material}
      position={[-16, -0.05, 2]}
      receiveShadow
    />
  )
}

function Lagoon({ sand }: { sand: THREE.Texture }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(palette.waterDeep) },
          uShallow: { value: new THREE.Color(palette.waterShallow) },
          uFoam: { value: new THREE.Color(palette.foam) },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 p = position;
            float w = sin(position.x * 6.0 + uTime * 1.4) * cos(position.y * 5.0 - uTime) * 0.012;
            p.z += w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uFoam;
          uniform float uTime;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float caustic = pow(max(0.0, sin(vUv.x * 40.0 + uTime * 1.6) * sin(vUv.y * 36.0 - uTime * 1.3)), 4.0);
            vec3 col = mix(uDeep, uShallow, smoothstep(0.08, 0.95, r));
            col += vec3(0.65, 0.9, 1.0) * caustic * (1.0 - r) * 0.45;
            float foam = smoothstep(0.7, 0.98, r);
            col = mix(col, uFoam, foam * 0.9);
            gl_FragColor = vec4(col, mix(0.95, 0.38, foam));
          }
        `,
      }),
    [],
  )
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[LAGOON.x, 0.02, LAGOON.z]}
        scale={[LAGOON.rx * 1.38, LAGOON.rz * 1.42, 1]}
        receiveShadow
      >
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial map={sand} color={palette.sand} roughness={0.96} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[LAGOON.x, 0.045, LAGOON.z]}
        scale={[LAGOON.rx, LAGOON.rz, 1]}
        material={mat}
      >
        <circleGeometry args={[1, 56]} />
      </mesh>
    </group>
  )
}

function ItemCrate({
  position,
  phase,
  question,
}: {
  position: [number, number, number]
  phase: number
  question: THREE.Texture
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.position.y = position[1] + Math.sin(clock.elapsedTime * 1.5 + phase) * 0.14
  })
  return (
    <group ref={ref} position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.35, 1.15, 1.35]} />
        <meshStandardMaterial color={palette.crate} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.69]}>
        <planeGeometry args={[1.15, 0.95]} />
        <meshStandardMaterial color={palette.crateTrim} />
      </mesh>
      <sprite position={[0, 1.55, 0]} scale={[1.9, 1.9, 1]}>
        <spriteMaterial map={question} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

function Crowd() {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const body = bodies.current
    const head = heads.current
    if (!body || !head) return
    const dummy = new THREE.Object3D()
    const shirt = new THREE.Color()
    const skin = new THREE.Color()
    const shirts = ['#ff5d73', '#ffd166', '#2ec4b6', '#ffffff', '#7cc6ff', '#c77dff', '#80ed99']
    const skins = ['#ffd8be', '#e8b892', '#c68642', '#8d5524', '#ffcc99']
    let i = 0
    for (let row = 0; row < 3; row++) {
      for (let seat = 0; seat < 14; seat++) {
        const x = 0.4 + row * 1.15
        const y = 0.78 + row * 0.55
        const z = -6.4 + seat * 0.98
        dummy.position.set(x, y, z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        body.setMatrixAt(i, dummy.matrix)
        dummy.position.set(x, y + 0.38, z)
        dummy.updateMatrix()
        head.setMatrixAt(i, dummy.matrix)
        shirt.set(shirts[(seat + row * 2) % shirts.length])
        skin.set(skins[(seat + row) % skins.length])
        body.setColorAt(i, shirt)
        head.setColorAt(i, skin)
        i++
      }
    }
    body.instanceMatrix.needsUpdate = true
    head.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
    if (head.instanceColor) head.instanceColor.needsUpdate = true
  }, [])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, 42]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.16, 0.26, 2, 6]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, 42]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
    </group>
  )
}

function CoralBank({
  sign,
  grain,
  grainNormal,
}: {
  sign: THREE.Texture
  grain: THREE.Texture
  grainNormal: THREE.Texture
}) {
  return (
    <group position={[12.4, 0, -8.4]} rotation={[0, -0.48, 0]}>
      {[
        { x: 0.7, y: 0.28, w: 1.7, h: 0.56, color: palette.cream },
        { x: 1.85, y: 0.82, w: 1.55, h: 0.5, color: '#ff8aa0' },
        { x: 2.95, y: 1.32, w: 1.4, h: 0.48, color: palette.seat },
        { x: 3.95, y: 1.78, w: 1.25, h: 0.42, color: palette.gold },
      ].map((tier) => (
        <mesh key={tier.y} position={[tier.x, tier.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[tier.w, tier.h, 14.2]} />
          <meshStandardMaterial
            map={grain}
            normalMap={grainNormal}
            normalScale={new THREE.Vector2(1.3, 1.3)}
            color={tier.color}
            roughness={0.72}
          />
        </mesh>
      ))}
      <mesh position={[3.15, 2.95, 0]} castShadow>
        <boxGeometry args={[6.6, 0.18, 14.8]} />
        <meshStandardMaterial
          map={grain}
          normalMap={grainNormal}
          normalScale={new THREE.Vector2(1.3, 1.3)}
          color={palette.roof}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[2.3, 2.7, 0]}>
        <boxGeometry args={[5.5, 0.08, 14.7]} />
        <meshStandardMaterial color={palette.gold} roughness={0.4} />
      </mesh>
      {[-6.6, -2.2, 2.2, 6.6].map((z) => (
        <mesh key={z} position={[4.3, 1.4, z]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 2.8, 8]} />
          <meshStandardMaterial color={palette.archDeep} />
        </mesh>
      ))}
      <mesh position={[5.15, 1.7, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[6.4, 1.15]} />
        <meshStandardMaterial map={sign} roughness={0.5} />
      </mesh>
      {[-4.6, -1.5, 1.6, 4.6].map((z) => (
        <mesh key={`fin-${z}`} position={[4.7, 1.55, z]} castShadow>
          <boxGeometry args={[0.16, 2.2, 0.55]} />
          <meshStandardMaterial color={palette.archDeep} roughness={0.6} />
        </mesh>
      ))}
      <Crowd />
    </group>
  )
}

/** Same azimuth as the gate key, tight on the bank so the start posts stay side-lit. */
function BankKey() {
  const target = useMemo(() => new THREE.Object3D(), [])
  return (
    <group>
      <primitive object={target} position={[8.2, 1.3, -7.2]} />
      <spotLight
        target={target}
        position={[34, 12, 8]}
        color="#fff0c4"
        intensity={700}
        distance={48}
        angle={0.4}
        penumbra={0.15}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0003}
        shadow-camera-near={8}
        shadow-camera-far={46}
      />
    </group>
  )
}

/** Outer face of the first-corner sand. The gate sun lights one side and shades the other. */
function BankFace({
  grain,
  grainNormal,
}: {
  grain: THREE.Texture
  grainNormal: THREE.Texture
}) {
  return (
    <mesh position={[6.5, 0.9, -7.4]} rotation={[0, 0.18, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.8, 1.8, 7.2]} />
      <meshStandardMaterial
        map={grain}
        normalMap={grainNormal}
        normalScale={new THREE.Vector2(1.3, 1.3)}
        color="#f4d7a4"
        roughness={0.76}
      />
    </mesh>
  )
}

function TideCrown({ sign }: { sign: THREE.Texture }) {
  return (
    <group position={[-16, 0, -30]}>
      <mesh receiveShadow position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.4, 0.5, 16]} />
        <meshStandardMaterial color={palette.stone} roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.7, 1.05, 4.2, 12]} />
        <meshStandardMaterial color={palette.arch} roughness={0.42} />
      </mesh>
      <mesh position={[0, 4.9, 0]} castShadow>
        <torusGeometry args={[1.35, 0.22, 10, 24]} />
        <meshStandardMaterial color={palette.gold} metalness={0.2} roughness={0.32} emissive={palette.gold} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 5.7, 0]} castShadow>
        <coneGeometry args={[0.45, 1.1, 8]} />
        <meshStandardMaterial color={palette.coral} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.15, 1.55]}>
        <planeGeometry args={[3.2, 0.95]} />
        <meshStandardMaterial map={sign} />
      </mesh>
    </group>
  )
}

/** Outside the first corner. One board, facing the chase, clear of the lens. */
function ApexLantern({ sign }: { sign: THREE.Texture }) {
  return (
    <group position={[6.4, 0, -13.6]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.6, 0.8, 12]} />
        <meshStandardMaterial color={palette.stone} roughness={0.72} />
      </mesh>
      <mesh position={[0, 3.3, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.5, 5.2, 10]} />
        <meshStandardMaterial color={palette.arch} roughness={0.4} />
      </mesh>
      <mesh position={[0, 6.3, 0]} castShadow>
        <sphereGeometry args={[0.62, 14, 12]} />
        <meshStandardMaterial
          color={palette.gold}
          emissive={palette.gold}
          emissiveIntensity={1.2}
          roughness={0.22}
        />
      </mesh>
      <pointLight position={[0, 6.1, 0.4]} color={palette.gold} intensity={12} distance={8} decay={2} />
      <mesh position={[0, 5.5, 0.55]}>
        <planeGeometry args={[8.2, 2.15]} />
        <meshStandardMaterial map={sign} roughness={0.4} />
      </mesh>
    </group>
  )
}

/**
 * Infield buoy. The board is small enough that a close chase still reads the
 * name instead of filling the lens, and the back is not a mirrored plane.
 */
function ReefBell({ sign }: { sign: THREE.Texture }) {
  return (
    <group position={[-15.2, 0, -7.5]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.35, 0.56, 12]} />
        <meshStandardMaterial color={palette.coral} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.5, 2.7, 10]} />
        <meshStandardMaterial color={palette.cream} roughness={0.48} />
      </mesh>
      <mesh position={[0, 3.45, 0]} castShadow>
        <sphereGeometry args={[0.48, 14, 12]} />
        <meshStandardMaterial color={palette.gold} emissive={palette.gold} emissiveIntensity={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[0, 3.15, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.62, 0.7, 10, 1, true]} />
        <meshStandardMaterial color={palette.coral} side={THREE.DoubleSide} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.25, 0.48]}>
        <planeGeometry args={[3.15, 0.9]} />
        <meshStandardMaterial map={sign} roughness={0.42} />
      </mesh>
    </group>
  )
}

function ShellBeach({
  textures,
}: {
  textures: TrackTextures
}) {
  return (
    <group>
      <Lagoon sand={textures.sand} />
      {palms.map(([x, y, z, s, lean]) => (
        <Palm key={`${x}-${z}`} position={[x, y, z]} scale={s} lean={lean} bark={textures.bark} />
      ))}
      {[-7.6, -8.7, -9.8].map((x) => (
        <mesh key={x} position={[x, 0.22, 4.6]} receiveShadow castShadow>
          <boxGeometry args={[1.15, 0.12, 1.35]} />
          <meshStandardMaterial map={textures.wood} roughness={0.8} />
        </mesh>
      ))}
      {[-7.1, -10.4].map((x) => (
        <mesh key={x} position={[x, 0.15, 4.6]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
          <meshStandardMaterial color={palette.woodDark} />
        </mesh>
      ))}
      <mesh position={[-8.2, 1.25, 8.2]}>
        <planeGeometry args={[2.8, 0.85]} />
        <meshStandardMaterial map={textures.signBeach} />
      </mesh>
      <group position={[-13.4, 0.18, 5.2]} rotation={[0, 0.4, 0]}>
        <mesh castShadow scale={[1.55, 0.36, 0.62]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={palette.cream} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.85, 0.08, 0.55]} />
          <meshStandardMaterial color={palette.coral} />
        </mesh>
      </group>
      {[
        [-7.4, 0.2, 1.6, 0.55],
        [-16.8, 0.16, 1.8, 0.6],
        [-15.2, 0.18, 9.4, 0.7],
      ].map(([x, y, z, s]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} scale={[s, s * 0.6, s]} castShadow receiveShadow>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={palette.stone} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function World({ textures }: { textures: TrackTextures }) {
  return (
    <group>
      <Grass fiber={textures.grass} fiberNormal={textures.grassNormal} straw={textures.fairway} />
      <ShellBeach textures={textures} />
      <CoralBank sign={textures.signBank} grain={textures.bank} grainNormal={textures.bankNormal} />
      <BankFace grain={textures.bank} grainNormal={textures.bankNormal} />
      <BankKey />
      <TideCrown sign={textures.signCrown} />
      <ApexLantern sign={textures.signApex} />
      <ReefBell sign={textures.signReef} />
      <ItemCrate position={[6.5, 0.7, 1.6]} phase={0.2} question={textures.question} />
      <ItemCrate position={[8.6, 0.7, -14]} phase={1.3} question={textures.question} />
      <ItemCrate position={[-22, 0.7, 22]} phase={2.1} question={textures.question} />
      <mesh position={[-16, -1.5, -52]} scale={[20, 4.2, 12]} receiveShadow>
        <sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color={palette.grassFar} roughness={1} />
      </mesh>
      <mesh position={[28, -1.2, 24]} scale={[14, 3.4, 11]} receiveShadow>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color={palette.grassMid} roughness={1} />
      </mesh>
    </group>
  )
}

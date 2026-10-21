import { useFrame, useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ControlState } from '../../game/controlState'
import type { KartState } from '../../game/kartPhysics'
import type { RaceStatus } from '../../game/raceLoop'
import { RaceHud, type Rival } from '../hud/RaceHud'
import { BoostRead } from './BoostRead'
import { RaceComposer } from './RaceComposer'
import { SurfaceFx } from './SurfaceFx'

export type AaaPresentationProps = {
  kart: KartState
  race: RaceStatus
  control: ControlState
}

const RACE_HUD = new Set<RaceStatus['phase']>(['countdown', 'racing', 'finish'])

/**
 * One mount, inside the race Canvas:
 *   <AaaPresentation kart={kart} race={race} control={control} />
 * Composer, streaks, surface VFX, and the HUD (portaled onto the canvas).
 */
export function AaaPresentation({ kart, race, control }: AaaPresentationProps) {
  const showHud = RACE_HUD.has(race.phase)
  return (
    <>
      <RaceComposer kart={kart} />
      <BoostRead kart={kart} />
      <SurfaceFx kart={kart} control={control} />
      {showHud && <HudMount race={race} kart={kart} />}
    </>
  )
}

/** DOM HUD through its own React root so R3F never tries to construct a div. */
function HudMount({ race, kart }: { race: RaceStatus; kart: KartState }) {
  const parent = useThree((s) => s.gl.domElement.parentElement)
  const scene = useThree((s) => s.scene)
  const rootRef = useRef<Root | null>(null)
  const raceRef = useRef(race)
  const kartRef = useRef(kart)
  const rivalsRef = useRef<Rival[]>([])
  const rivalKey = useRef('')
  raceRef.current = race
  kartRef.current = kart

  useEffect(() => {
    if (!parent) return
    const host = document.createElement('div')
    host.dataset.ppHost = ''
    host.style.cssText =
      'position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;'
    parent.appendChild(host)
    const root = createRoot(host)
    rootRef.current = root
    root.render(<RaceHud race={race} kart={kart} rivals={rivalsRef.current} />)
    return () => {
      root.unmount()
      host.remove()
      rootRef.current = null
    }
  }, [parent])

  useEffect(() => {
    rootRef.current?.render(
      <RaceHud race={race} kart={kart} rivals={rivalsRef.current} />,
    )
  }, [race, kart])

  useFrame(() => {
    const rivals = readRivals(scene)
    const key = rivals.map((r) => `${r.x.toFixed(1)},${r.z.toFixed(1)}`).join(';')
    if (key === rivalKey.current) return
    rivalKey.current = key
    rivalsRef.current = rivals
    rootRef.current?.render(
      <RaceHud race={raceRef.current} kart={kartRef.current} rivals={rivals} />,
    )
  })

  return null
}

/** Other racers opt in with userData.palmRacer = 'rival'. A solo heat stays unmarked. */
function readRivals(scene: Object3D): Rival[] {
  const rivals: Rival[] = []
  scene.traverse((obj) => {
    if (obj.userData?.palmRacer !== 'rival') return
    rivals.push({ x: obj.position.x, z: obj.position.z })
  })
  return rivals
}

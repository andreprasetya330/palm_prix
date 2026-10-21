import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ControlState } from '../../game/controlState'
import type { KartState } from '../../game/kartPhysics'
import type { RaceStatus } from '../../game/raceLoop'
import { RaceHud } from '../hud/RaceHud'
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
  const rootRef = useRef<Root | null>(null)

  useEffect(() => {
    if (!parent) return
    const host = document.createElement('div')
    host.dataset.ppHost = ''
    host.style.cssText =
      'position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;'
    parent.appendChild(host)
    const root = createRoot(host)
    rootRef.current = root
    root.render(<RaceHud race={race} kart={kart} />)
    return () => {
      root.unmount()
      host.remove()
      rootRef.current = null
    }
  }, [parent])

  useEffect(() => {
    rootRef.current?.render(<RaceHud race={race} kart={kart} />)
  }, [race, kart])

  return null
}

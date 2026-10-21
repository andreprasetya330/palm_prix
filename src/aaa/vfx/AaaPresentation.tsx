import { useThree } from '@react-three/fiber'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
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
      {showHud && (
        <HudPortal>
          <RaceHud race={race} kart={kart} />
        </HudPortal>
      )}
    </>
  )
}

function HudPortal({ children }: { children: ReactNode }) {
  const parent = useThree((s) => s.gl.domElement.parentElement)
  if (!parent) return null
  return createPortal(children, parent)
}

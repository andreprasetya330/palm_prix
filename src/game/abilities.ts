import { getTrackSurface } from './trackLayout'
import { segmentDistanceSquared } from './courseFeatures'
import type { KartState } from './kartPhysics'

export type Ability = 'turbo' | 'shield'
export type AbilityState = {
  held: Ability | null
  shieldTimer: number
  pickupCount: number
  activations: number
  lastEvent: 'pickup' | Ability | null
  eventTimer: number
  eventId: number
  collected: Set<string>
}
export const ABILITY_PICKUPS = [.10, .32, .57, .80].flatMap((t, row) => [-3.5, 0, 3.5].map((lane, column) => {
  const surface = getTrackSurface(t, lane)
  return { id: row * 3 + column, row, t, lane, x: surface.point.x, y: surface.height, z: surface.point.z, kind: (row % 2 ? 'shield' : 'turbo') as Ability }
}))
export function createAbilityState(): AbilityState {
  return { held: null, shieldTimer: 0, pickupCount: 0, activations: 0, lastEvent: null, eventTimer: 0, eventId: 0, collected: new Set() }
}
function event(state: AbilityState, kind: NonNullable<AbilityState['lastEvent']>) {
  state.lastEvent = kind; state.eventTimer = 1.5; state.eventId++
}
export function tickAbilities(state: AbilityState, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return
  state.shieldTimer = Math.max(0, state.shieldTimer - dt)
  state.eventTimer = Math.max(0, state.eventTimer - dt)
  if (!state.eventTimer) state.lastEvent = null
}
/** Returns true only when the input was consumed by a held item. Empty slots retain the rechargeable boost. */
export function activateAbility(state: AbilityState, kart: KartState): boolean {
  if (!state.held) return false
  const kind = state.held
  if (kind === 'turbo') kart.boostTimer = Math.max(kart.boostTimer, 2)
  else state.shieldTimer = 4.5
  state.held = null; state.activations++; event(state, kind)
  return true
}
export function collectAbility(state: AbilityState, lap: number, ax: number, az: number, bx: number, bz: number): boolean {
  if (state.held) return false
  for (const pickup of ABILITY_PICKUPS) {
    const key = `${lap}:${pickup.row}`
    if (!state.collected.has(key) && segmentDistanceSquared(ax, az, bx, bz, pickup.x, pickup.z) < 1.65 ** 2) {
      state.collected.add(key); state.held = pickup.kind; state.pickupCount++; event(state, 'pickup'); return true
    }
  }
  return false
}

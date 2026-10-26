/** This local-only racer has a procedural fallback and must never block public checkouts. */
export const OPTIONAL_CIRCUIT_MODEL='/assets/personal/circuit-special.glb'
export function isRequiredAssetError(error:unknown){
 return !String(error).includes(OPTIONAL_CIRCUIT_MODEL)
}

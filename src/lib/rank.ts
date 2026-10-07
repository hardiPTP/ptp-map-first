// OWNED BY AGENT B. Phase 0 stub: signatures are the contract, bodies are filled in Phase 1.
import type { LatLng, Pin, Support } from '../types'

/** Supports for a pin within the last 7 days. */
export function supports7d(_pinId: string, _supports: Support[], _now: number): number {
  return 0
}

/** PRD "Support and ranking": feed score. */
export function feedScore(_pin: Pin, _supports: Support[], _origin: LatLng, _now: number): number {
  return 0
}

/** Sorted copy, highest score first. */
export function rankPins(pins: Pin[], _supports: Support[], _origin: LatLng, _now: number): Pin[] {
  return [...pins]
}

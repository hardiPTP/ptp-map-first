// OWNED BY AGENT B. Phase 0 stub: signatures are the contract, bodies are filled in Phase 1.
import type { Pin, Support } from '../types'

export const PULSE_WINDOW_MS = 3 * 60 * 60 * 1000

/** PRD "Pin types": pulse only for pins posted or supported in the last 3 h, and events starting in the next 2 h. */
export function isPulsing(_pin: Pin, _supports: Support[], _now: number): boolean {
  return false
}

export interface PulseWindow {
  /** Pins in the window, unsorted. */
  items: Pin[]
  /** "last3h" normally; "sinceLastNight" when fewer than 5 items fall in 3 h. */
  mode: 'last3h' | 'sinceLastNight'
  since: number
}

/** PRD "Calls made" 4. */
export function pulseWindow(pins: Pin[], _supports: Support[], now: number): PulseWindow {
  return { items: pins, mode: 'last3h', since: now - PULSE_WINDOW_MS }
}

/**
 * PRD "Support and ranking" hide rules. False when: status hidden; civic with no support (or creation)
 * in the last 30 days; event ended more than 2 h ago (end = endsAt ?? startsAt + 2 h);
 * area update past endsAt. Used by both the map (agent A) and the feed (agent B).
 */
export function isLive(pin: Pin, _supports: Support[], _now: number): boolean {
  return pin.status === 'active'
}

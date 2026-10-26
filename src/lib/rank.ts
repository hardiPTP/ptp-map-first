// OWNED BY AGENT B. PRD "Support and ranking": feed score.
import type { LatLng, Pin, Support } from '../types'
import { OFFER_FACTOR } from './claims'
import { walkMin } from './geo'

const HOUR = 60 * 60 * 1000
export const FRESH_MS = 7 * 24 * HOUR
/** Civic pins with at least this many fresh supports get the boost. */
export const BOOST_MIN_SUPPORTS = 3
/** "Small boost" (PRD): x1.25. */
export const CIVIC_BOOST = 1.25

/** Supports for a pin within the last 7 days. */
export function supports7d(pinId: string, supports: Support[], now: number): number {
  let n = 0
  for (const s of supports) if (s.pinId === pinId && now - s.createdAt <= FRESH_MS) n++
  return n
}

/**
 * Feed score = (1 + supports7d) / ((1 + walkMin/10) x (1 + hours/6)).
 * hours = hours since posted; for events, hours until start (hours since start once started).
 * Civic pins with 3+ fresh supports are multiplied by CIVIC_BOOST; offers by OFFER_FACTOR (0.8).
 */
export function feedScore(pin: Pin, supports: Support[], origin: LatLng, now: number): number {
  return interest(pin, supports, now) / (1 + walkMin(origin, pin) / 10)
}

/**
 * The feed score without distance: how important and recent a pin is. The map's popups use it (distance there is
 * to the middle of the view), so the map and Pulse agree on what matters.
 */
export function interest(pin: Pin, supports: Support[], now: number): number {
  const fresh = supports7d(pin.id, supports, now)
  const ref = pin.type === 'event' && pin.startsAt != null ? pin.startsAt : pin.createdAt
  const hours = Math.abs(now - ref) / HOUR
  let score = (1 + fresh) / (1 + hours / 6)
  if (pin.type === 'civic' && fresh >= BOOST_MIN_SUPPORTS) score *= CIVIC_BOOST
  if (pin.type === 'offer') score *= OFFER_FACTOR // a claimed place's deal sits a little below neighbours
  return score
}

/** Sorted copy, highest score first. */
export function rankPins(pins: Pin[], supports: Support[], origin: LatLng, now: number): Pin[] {
  return pins
    .map((p) => ({ p, s: feedScore(p, supports, origin, now) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
}

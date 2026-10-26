// OWNED BY AGENT B. Pulse window, pulsing and live rules (PRD "Calls made" 4, "Pin types", "Support and ranking").
import type { Pin, Support } from '../types'

export const PULSE_WINDOW_MS = 3 * 60 * 60 * 1000
export const EVENT_SOON_MS = 2 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
export const MIN_PULSE_ITEMS = 5
/** Upcoming events show in Pulse for this far ahead. */
export const EVENT_HORIZON_MS = 7 * DAY
/** Hour (local time) that counts as "the previous evening" for the sinceLastNight fallback. */
export const LAST_NIGHT_HOUR = 18

/** Latest support time for a pin: from the supports list, or pin.lastSupportAt. */
function lastSupportTime(pin: Pin, supports: Support[]): number {
  let t = pin.lastSupportAt ?? 0
  for (const s of supports) if (s.pinId === pin.id && s.createdAt > t) t = s.createdAt
  return t
}

/** PRD "Pin types": pulse only for pins posted or supported in the last 3 h, and events starting in the next 2 h. */
export function isPulsing(pin: Pin, supports: Support[], now: number): boolean {
  if (pin.type === 'area') return false
  if (now - pin.createdAt <= PULSE_WINDOW_MS) return true
  if (now - lastSupportTime(pin, supports) <= PULSE_WINDOW_MS) return true
  if (pin.type === 'event' && pin.startsAt != null) {
    const until = pin.startsAt - now
    if (until >= 0 && until <= EVENT_SOON_MS) return true
  }
  return false
}

/** End of an event: endsAt, else startsAt + 2 h. Null when it has no times. */
export function eventEnd(pin: Pin): number | null {
  if (pin.endsAt != null) return pin.endsAt
  if (pin.startsAt != null) return pin.startsAt + EVENT_SOON_MS
  return null
}

export interface PulseWindow {
  /** Pins in the window, unsorted. */
  items: Pin[]
  /** "last3h" normally; "sinceLastNight" when fewer than 5 items fall in 3 h. */
  mode: 'last3h' | 'sinceLastNight'
  since: number
}

/** 18:00 local time on the calendar day before `now`. This is "the previous evening". */
export function previousEvening(now: number): number {
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  d.setHours(LAST_NIGHT_HOUR, 0, 0, 0)
  return d.getTime()
}

/** Does the pin qualify for Pulse for activity since `since`? (docs/DECISIONS.md "Pulse feed composition") */
function qualifies(pin: Pin, supports: Support[], since: number, now: number): boolean {
  if (pin.createdAt >= since) return true
  if (lastSupportTime(pin, supports) >= since) return true
  if (pin.type === 'event' && pin.startsAt != null) {
    const end = eventEnd(pin) as number
    // not ended, and starting within the next 7 days (real listings are posted days ahead)
    return end >= now && pin.startsAt <= now + EVENT_HORIZON_MS
  }
  return false
}

/**
 * PRD "Calls made" 4. Composition per docs/DECISIONS.md: live civic/ask pins posted or supported inside the window,
 * plus live events posted or supported inside the window OR not yet ended and starting before the end of today.
 * If fewer than 5 items fall in the 3 h window, the window stretches back to 18:00 local the previous day
 * and mode becomes "sinceLastNight". Area updates never qualify (they live in the strip).
 * Callers pass pins already filtered by bounds and chip.
 */
export function pulseWindow(pins: Pin[], supports: Support[], now: number): PulseWindow {
  const candidates = pins.filter((p) => p.type !== 'area' && isLive(p, supports, now))
  const since3 = now - PULSE_WINDOW_MS
  const recent = candidates.filter((p) => qualifies(p, supports, since3, now))
  if (recent.length >= MIN_PULSE_ITEMS) return { items: recent, mode: 'last3h', since: since3 }
  const sinceNight = previousEvening(now)
  return {
    items: candidates.filter((p) => qualifies(p, supports, sinceNight, now)),
    mode: 'sinceLastNight',
    since: sinceNight,
  }
}

/**
 * PRD "Support and ranking" hide rules. False when: status hidden; civic with no support (or creation)
 * in the last 30 days; event ended more than 2 h ago (end = endsAt ?? startsAt + 2 h);
 * area update past endsAt. Used by both the map (agent A) and the feed (agent B).
 */
export function isLive(pin: Pin, supports: Support[], now: number): boolean {
  if (pin.status !== 'active') return false
  if (pin.type === 'civic') {
    const last = Math.max(pin.createdAt, lastSupportTime(pin, supports))
    return now - last <= 30 * DAY
  }
  if (pin.type === 'event') {
    const end = eventEnd(pin)
    return end == null || now <= end + EVENT_SOON_MS
  }
  if (pin.type === 'area' || pin.type === 'offer') return pin.endsAt == null || now <= pin.endsAt
  return true
}

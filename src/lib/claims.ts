// Place claims and offers (DECISIONS.md 2026-10-22, claims). Pure: no Google, no DOM, no clock.
import type { Claim, NewPin } from '../types'

/** Offers rank a little below neighbour posts, in the feed and on the map, so Pulse stays about the neighbourhood. */
export const OFFER_FACTOR = 0.8

/** The claim on a place, whoever holds it. */
export function claimFor(placeId: string | null | undefined, claims: Claim[]): Claim | null {
  if (!placeId) return null
  return claims.find((c) => c.placeId === placeId) ?? null
}

/** Can this device post as this place? Only with an ACTIVE claim of its own. */
export function canPostAsPlace(placeId: string | null | undefined, deviceId: string | null, claims: Claim[]): boolean {
  const c = claimFor(placeId, claims)
  return !!c && !!deviceId && c.deviceId === deviceId && c.status === 'active'
}

export type OfferEnd = 'today' | 'week' | 'date'

/** End of the chosen day, local time: today, 7 days from today, or a yyyy-mm-dd date. Null when incomplete. */
export function offerEndsAt(end: OfferEnd, dateStr: string, now: number): number | null {
  const d = new Date(now)
  if (end === 'today') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime()
  if (end === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 23, 59).getTime()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59).getTime()
}

/** Checks shared by both repos before a pin is written. Throws with a reason. */
export function checkNewPin(input: NewPin, deviceId: string, claims: Claim[]): void {
  if (input.asPlace) {
    if (input.type !== 'offer' && input.type !== 'event') throw new Error('a place posts offers or events')
    if (!canPostAsPlace(input.placeId, deviceId, claims)) throw new Error('this place is not claimed by you yet')
    if (input.type === 'offer' && input.endsAt == null) throw new Error('an offer needs an end date')
  } else if (input.type === 'offer') {
    throw new Error('only a claimed place can post an offer')
  }
}

import { describe, expect, it } from 'vitest'
import { OFFER_FACTOR } from '../../src/lib/claims'
import { isLive } from '../../src/lib/pulse'
import { CIVIC_BOOST, feedScore, rankPins, supports7d } from '../../src/lib/rank'
import type { Pin, Support } from '../../src/types'

const H = 3600_000
const now = 1_000_000 * H
const origin = { lat: 0, lng: 0 }
const M80 = 0.00072 // about 80 m of latitude = 1 walking minute
let n = 0
const pin = (o: Partial<Pin> = {}): Pin => ({
  id: `p${++n}`, type: 'civic', title: 't', lat: 0, lng: 0, createdAt: now - H, createdBy: 'd',
  postedAs: 'neighbour', status: 'active', ...o,
})
const sup = (pinId: string, ageH: number, i = 0): Support => ({
  id: `${pinId}_d${i}`, pinId, deviceId: `d${i}`, createdAt: now - ageH * H,
})

describe('supports7d', () => {
  it('counts only the last 7 days', () => {
    const s = [sup('a', 1), sup('a', 24 * 6, 1), sup('a', 24 * 8, 2), sup('b', 1, 3)]
    expect(supports7d('a', s, now)).toBe(2)
  })
})

describe('feedScore and rankPins', () => {
  it('fresh support beats larger stale support', () => {
    const fresh = pin(); const stale = pin()
    const s = [sup(fresh.id, 2, 1), sup(fresh.id, 3, 2), ...[1, 2, 3, 4, 5, 6].map((i) => sup(stale.id, 24 * 20, i))]
    expect(rankPins([stale, fresh], s, origin, now)[0]).toBe(fresh)
  })
  it('event starting soon beats the same event later', () => {
    const soon = pin({ type: 'event', startsAt: now + 1 * H })
    const later = pin({ type: 'event', startsAt: now + 30 * H })
    expect(rankPins([later, soon], [], origin, now)[0]).toBe(soon)
  })
  it('past start uses hours since start', () => {
    const a = pin({ type: 'event', startsAt: now + 2 * H })
    const b = pin({ type: 'event', startsAt: now - 2 * H })
    expect(feedScore(a, [], origin, now)).toBeCloseTo(feedScore(b, [], origin, now))
  })
  it('closer beats farther', () => {
    const near = pin({ lat: 2 * M80 }); const far = pin({ lat: 40 * M80 })
    expect(rankPins([far, near], [], origin, now)[0]).toBe(near)
  })
  it('matches the PRD formula', () => {
    const p = pin({ type: 'ask', lat: 10 * M80, createdAt: now - 6 * H })
    expect(feedScore(p, [sup(p.id, 1)], origin, now)).toBeCloseTo(2 / (2 * 2), 2)
  })
  it('civic with 3+ fresh supports gets the boost, ask does not', () => {
    const c = pin(); const a = pin({ type: 'ask' })
    const s = [1, 2, 3].flatMap((i) => [sup(c.id, 1, i), sup(a.id, 1, i)])
    const c2 = pin(); const s2 = [1, 2].map((i) => sup(c2.id, 1, i))
    expect(feedScore(c, s, origin, now) / feedScore(a, s, origin, now)).toBeCloseTo(CIVIC_BOOST)
    // 2 supports: no boost
    expect(feedScore(c2, s2, origin, now)).toBeCloseTo(3 / (1 * (1 + 1 / 6)))
  })
  it('does not mutate its input', () => {
    const a = [pin(), pin()]; const copy = [...a]
    rankPins(a, [], origin, now)
    expect(a).toEqual(copy)
  })
})

describe('offers (DECISIONS.md 2026-10-22)', () => {
  it('a claimed place\'s offer ranks a little below the same neighbour post (x0.8)', () => {
    const now = Date.parse('2026-10-07T09:00:00Z')
    const base = { id: 'x', title: 'Twenty percent off', lat: 19.06, lng: 72.83, createdAt: now - 3600_000, createdBy: 'd', status: 'active' as const }
    const ask = { ...base, type: 'ask' as const, postedAs: 'neighbour' as const }
    const offer = { ...base, id: 'y', type: 'offer' as const, postedAs: 'place' as const, endsAt: now + 86400_000 }
    const origin = { lat: 19.06, lng: 72.83 }
    expect(feedScore(offer, [], origin, now)).toBeCloseTo(feedScore(ask, [], origin, now) * OFFER_FACTOR)
    expect(rankPins([offer, ask], [], origin, now).map((p) => p.id)).toEqual(['x', 'y'])
  })
  it('an offer is live until its last day ends', () => {
    const now = Date.parse('2026-10-07T09:00:00Z')
    const offer = { id: 'y', type: 'offer' as const, title: 'Offer', lat: 0, lng: 0, createdAt: now, createdBy: 'd', postedAs: 'place' as const, status: 'active' as const, endsAt: now + 1000 }
    expect(isLive(offer, [], now)).toBe(true)
    expect(isLive(offer, [], now + 1001)).toBe(false)
  })
})

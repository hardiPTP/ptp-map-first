import { describe, expect, it } from 'vitest'
import {
  clusterContent,
  eventValue,
  formatAgo,
  freshness,
  nearness,
  overlaps,
  ringState,
  selectTags,
  tagContent,
  tagScore,
  zoomCap,
  type Box,
  type TagCandidate,
} from '../../src/lib/tags'
import type { Pin, Support } from '../../src/types'
import type { Cluster } from '../../src/map/cluster'

const HOUR = 3600_000
const DAY = 24 * HOUR
const ORIGIN = { lat: 19.05, lng: 72.83 }
const vp = { center: ORIGIN }

/** ~80 m per 0.00072 deg lat => 1 walk minute. */
const degForMin = (min: number) => (min * 80) / 111_195

function cand(id: string, o: { min?: number; urgency?: number; x?: number; y?: number; w?: number } = {}): TagCandidate {
  const { min = 0, urgency = 1, x = 0, y = 0, w = 50 } = o
  return {
    id,
    lat: ORIGIN.lat + degForMin(min),
    lng: ORIGIN.lng,
    urgency,
    content: { kind: 'civic-timer', symbol: 'ring', value: '1d' },
    box: { x, y, w, h: 24 },
  }
}

function pin(p: Partial<Pin> & Pick<Pin, 'type'>): Pin {
  return {
    id: 'p',
    title: 't',
    lat: ORIGIN.lat,
    lng: ORIGIN.lng,
    createdAt: 0,
    createdBy: 'd',
    postedAs: 'neighbour',
    status: 'active',
    ...p,
  }
}
const sup = (pinId: string, createdAt: number, n = 0): Support => ({ id: `${pinId}_${n}`, pinId, deviceId: `d${n}`, createdAt })

describe('score maths', () => {
  it('nearness = 1 / (1 + walkMin / 10)', () => {
    expect(nearness(0)).toBe(1)
    expect(nearness(10)).toBeCloseTo(0.5)
    expect(nearness(30)).toBeCloseTo(0.25)
  })
  it('score = urgency x nearness x freshness (interest 1)', () => {
    const c = cand('a', { min: 10, urgency: 2 })
    expect(tagScore(c, ORIGIN, {})).toBeCloseTo(2 * 0.5, 2)
    expect(tagScore(c, ORIGIN, { a: 3 })).toBeCloseTo(2 * 0.5 * 0.5, 2)
  })
  it('freshness halves only from the 3rd unseen show', () => {
    expect(freshness(0)).toBe(1)
    expect(freshness(2)).toBe(1)
    expect(freshness(3)).toBe(0.5)
    expect(freshness(9)).toBe(0.5)
  })
})

describe('urgency from content', () => {
  const now = 100 * DAY
  it('civic past 7 days = 2, fresh civic = 1, civic with fresh supports = 1.5', () => {
    expect(tagContent(pin({ type: 'civic', createdAt: now - 8 * DAY }), [], now)!.urgency).toBe(2)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [], now)!.urgency).toBe(1)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [sup('p', now - HOUR)], now)!.urgency).toBe(1.5)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [sup('p', now - 4 * HOUR)], now)!.urgency).toBe(1)
  })
  it('event within 2 h = 2, later today = 1.5, after today = 1', () => {
    const noon = new Date(2026, 9, 7, 12, 0).getTime()
    expect(eventValue(noon + HOUR, noon).urgency).toBe(2)
    expect(eventValue(new Date(2026, 9, 7, 17, 0).getTime(), noon).urgency).toBe(1.5)
    expect(eventValue(new Date(2026, 9, 10, 17, 0).getTime(), noon).urgency).toBe(1)
  })
  it('area updates get no tag', () => {
    expect(tagContent(pin({ type: 'area', postedAs: 'ptp' }), [], 0)).toBeNull()
  })
})

describe('zoom caps', () => {
  const many = Array.from({ length: 10 }, (_, i) => cand(`c${i}`, { min: i, x: i * 100 }))
  const pick = (z: number) => selectTags(many, vp, z, new Set(), {})
  it('cap values', () => {
    expect(zoomCap(13)).toBe(Infinity)
    expect(zoomCap(14)).toBe(3)
    expect(zoomCap(16)).toBe(3)
    expect(zoomCap(17)).toBe(6)
  })
  it('14 to 16 shows the top 3, 17+ the top 6, best score first', () => {
    expect(pick(14)).toEqual(['c0', 'c1', 'c2'])
    expect(pick(16)).toHaveLength(3)
    expect(pick(17)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5'])
    expect(pick(19)).toHaveLength(6)
  })
})

describe('overlap rejection', () => {
  it('skips a lower tag that overlaps a higher one and tries the next', () => {
    const a = cand('a', { min: 0, x: 0 })
    const b = cand('b', { min: 1, x: 20 }) // overlaps a
    const c = cand('c', { min: 2, x: 200 })
    expect(selectTags([b, a, c], vp, 17, new Set(), {})).toEqual(['a', 'c'])
  })
  it('touching boxes do not overlap', () => {
    const a: Box = { x: 0, y: 0, w: 10, h: 10 }
    expect(overlaps(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 9, y: 9, w: 10, h: 10 })).toBe(true)
  })
  it('skips a tag that covers another pin marker body, but not its own', () => {
    const own: Box = { x: -30, y: -30, w: 36, h: 50 }
    const a = { ...cand('a', { x: 0, y: 0 }), markerBox: own }
    const other: Box = { x: 10, y: 0, w: 36, h: 50 }
    expect(selectTags([a], vp, 17, new Set(), {}, { obstacles: [own] })).toEqual(['a'])
    expect(selectTags([a], vp, 17, new Set(), {}, { obstacles: [own, other] })).toEqual([])
  })
})

describe('stickiness (30%)', () => {
  // zoom 14: cap 3. Four tags, none overlapping. Showing: s1..s3 with equal score 1. Challenger beats one of them.
  const showing = ['s1', 's2', 's3']
  const base = [cand('s1', { min: 10, x: 0 }), cand('s2', { min: 10, x: 100 }), cand('s3', { min: 10, x: 200 })]
  it('a challenger 29% better does not displace', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.29 })
    const out = selectTags([...base, ch], vp, 14, new Set(showing), {})
    expect(out).not.toContain('ch')
    expect(out).toHaveLength(3)
  })
  it('a challenger 30% better does', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.3 })
    const out = selectTags([...base, ch], vp, 14, new Set(showing), {})
    expect(out).toContain('ch')
    expect(out).toHaveLength(3)
  })
  it('without history the better tag wins at once', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.1 })
    expect(selectTags([...base, ch], vp, 14, new Set(), {})[0]).toBe('ch')
  })
})

describe('selected pin', () => {
  it('is always tagged, even far away, over the cap, and over an overlap', () => {
    const far = cand('far', { min: 500, x: 0 })
    const near = Array.from({ length: 6 }, (_, i) => cand(`n${i}`, { min: i, x: 100 + i * 100 }))
    const clash = cand('clash', { min: 0, x: 10 })
    const out = selectTags([...near, far, clash], vp, 14, new Set(), {}, { selectedId: 'far' })
    expect(out[0]).toBe('far')
    expect(out).not.toContain('clash')
    expect(out).toHaveLength(4) // selected + top 3
  })
})

describe('freshness halving after 3 unseen shows', () => {
  it('a tag shown 3 times without a tap loses to an otherwise equal one', () => {
    const a = cand('a', { x: 0 })
    const b = cand('b', { x: 0 }) // same box: only one fits
    expect(selectTags([a, b], vp, 17, new Set(), { a: 3 })).toEqual(['b'])
    expect(selectTags([a, b], vp, 17, new Set(), { a: 2 })).toEqual(['a'])
    // tap resets to 0
    expect(selectTags([a, b], vp, 17, new Set(), { a: 0 })).toEqual(['a'])
  })
})

describe('content formats', () => {
  const now = new Date(2026, 9, 7, 12, 0).getTime()
  it('civic "12d" with ring fill and past state', () => {
    const c = tagContent(pin({ type: 'civic', createdAt: now - 12 * DAY }), [], now)!.content
    expect(c.value).toBe('12d')
    expect(c.symbol).toBe('ring')
    expect(c.past).toBe(true)
    expect(c.ringFill).toBe(1)
  })
  it('ring fills over 7 days, red only past it', () => {
    expect(ringState(pin({ type: 'civic', createdAt: now - 3.5 * DAY }), now)).toEqual({ fill: 0.5, past: false })
    expect(ringState(pin({ type: 'civic', createdAt: now - 7 * DAY }), now)).toEqual({ fill: 1, past: false })
    expect(ringState(pin({ type: 'civic', createdAt: now - 7 * DAY - 1 }), now)).toEqual({ fill: 1, past: true })
    expect(ringState(pin({ type: 'civic', createdAt: now }), now)).toEqual({ fill: 0, past: false })
  })
  it('civic busy "+5" replaces the timer', () => {
    const s = [0, 1, 2, 3, 4].map((i) => sup('p', now - HOUR, i))
    const c = tagContent(pin({ type: 'civic', createdAt: now - 12 * DAY }), s, now)!.content
    expect(c).toMatchObject({ kind: 'civic-busy', symbol: 'arrow-up', value: '+5' })
  })
  it('event "in 40m", "5 PM", "Sat"', () => {
    expect(eventValue(now + 40 * 60_000, now).value).toBe('in 40m')
    expect(eventValue(now + 90 * 60_000, now).value).toBe('in 1h 30m')
    expect(eventValue(new Date(2026, 9, 7, 17, 0).getTime(), now).value).toBe('5 PM')
    expect(eventValue(new Date(2026, 9, 7, 17, 30).getTime(), now).value).toBe('5:30 PM')
    expect(eventValue(new Date(2026, 9, 10, 17, 0).getTime(), now).value).toBe('Sat') // 10 Oct 2026 is a Saturday
  })
  it('place-posted event shows the avatar symbol', () => {
    const c = tagContent(pin({ type: 'event', postedAs: 'place', startsAt: now + 5 * HOUR }), [], now)!.content
    expect(c.symbol).toBe('avatar')
    expect(tagContent(pin({ type: 'event', startsAt: now + 5 * HOUR }), [], now)!.content.symbol).toBe('clock')
  })
  it('ask: offers count, else time since asking', () => {
    const asked = pin({ type: 'ask', createdAt: now - 3 * HOUR - 5 * 60_000 })
    expect(tagContent(asked, [], now)!.content).toMatchObject({ symbol: 'hand', value: '3h' })
    expect(tagContent(asked, [sup('p', now - 2 * DAY, 1), sup('p', now - 2 * DAY, 2)], now)!.content.value).toBe('2')
    expect(formatAgo(12 * 60_000)).toBe('12m')
    expect(formatAgo(2 * DAY)).toBe('2d')
  })
  it('cluster "8 events"', () => {
    const pins = [...Array.from({ length: 8 }, (_, i) => pin({ type: 'event', id: `e${i}` })), pin({ type: 'civic', id: 'c' })]
    const cl: Cluster = { id: 'x', lat: 0, lng: 0, count: 9, pins }
    expect(clusterContent(cl).value).toBe('8 events')
  })
})

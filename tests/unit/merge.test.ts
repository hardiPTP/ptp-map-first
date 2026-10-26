import { describe, expect, it } from 'vitest'
import { canMerge, MERGE_RADIUS_M, mergeSimilar } from '../../src/lib/merge'
import { mapPins } from '../../src/map/visible'
import type { Pin } from '../../src/types'

const now = Date.parse('2026-10-23T09:00:00Z')
const at = { lat: 19.06, lng: 72.83 }
/** m metres north of `at` */
const north = (m: number) => ({ lat: at.lat + m / 111_195, lng: at.lng })
let n = 0
const pin = (o: Partial<Pin> = {}): Pin => ({
  id: `p${++n}`, type: 'civic', title: 'Streetlight out', ...at, createdAt: now - 3600_000, createdBy: 'd',
  postedAs: 'neighbour', status: 'active', ...o,
})

describe('which pins merge', () => {
  it('same type at the same spot merges; an issue and an ask never do', () => {
    expect(canMerge(pin(), pin({ ...north(10) }))).toBe(true)
    expect(canMerge(pin(), pin({ type: 'ask' }))).toBe(false)
  })
  it(`only within ${MERGE_RADIUS_M} m`, () => {
    expect(canMerge(pin(), pin({ ...north(MERGE_RADIUS_M - 2) }))).toBe(true)
    expect(canMerge(pin(), pin({ ...north(MERGE_RADIUS_M + 5) }))).toBe(false)
  })
  it('events only when they start at the same time; offers never', () => {
    const t = now + 3600_000
    expect(canMerge(pin({ type: 'event', startsAt: t }), pin({ type: 'event', startsAt: t }))).toBe(true)
    expect(canMerge(pin({ type: 'event', startsAt: t }), pin({ type: 'event', startsAt: t + 3600_000 }))).toBe(false)
    expect(canMerge(pin({ type: 'offer', endsAt: t }), pin({ type: 'offer', endsAt: t }))).toBe(false)
  })
})

describe('merging', () => {
  it('the most important pin leads; the rest count as "+N"', () => {
    const a = pin({ id: 'a' })
    const b = pin({ id: 'b', ...north(5) })
    const c = pin({ id: 'c', ...north(10) })
    const ask = pin({ id: 'ask', type: 'ask' })
    const rank: Record<string, number> = { a: 1, b: 3, c: 2, ask: 1 }
    const m = mergeSimilar([a, b, c, ask], (p) => rank[p.id])
    expect(m.pins.map((p) => p.id)).toEqual(['b', 'ask'])
    expect(m.others.get('b')).toEqual(['c', 'a'])
  })
  it('the selected pin always shows: it leads its group even when another is more important', () => {
    const a = pin({ id: 'a' })
    const b = pin({ id: 'b' })
    const m = mergeSimilar([a, b], (p) => (p.id === 'a' ? 9 : 1), new Set(['b']))
    expect(m.pins.map((p) => p.id)).toEqual(['b'])
    expect(m.others.get('b')).toEqual(['a'])
  })
  it('the map merges live pins only, with the same result for markers and tags', () => {
    const live = pin({ id: 'live' })
    const gone = pin({ id: 'gone', status: 'hidden' })
    const twin = pin({ id: 'twin', ...north(3) })
    const r1 = mapPins([live, gone, twin], [], 'all', now, null)
    const r2 = mapPins([live, gone, twin], [], 'all', now, null)
    expect(r1.pins.length).toBe(1)
    expect([...r1.others.values()].flat()).not.toContain('gone')
    expect(r2).toEqual(r1)
  })
})

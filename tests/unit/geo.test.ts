import { describe, expect, it } from 'vitest'
import { distanceM, formatWalk, walkMin, WALK_RING_M } from '../../src/lib/geo'

// Synthetic points for maths only; not shown in the UI.
const origin = { lat: 0, lng: 0 }

describe('geo', () => {
  it('is zero for the same point', () => {
    expect(distanceM(origin, origin)).toBe(0)
  })
  it('one degree of latitude is about 111.2 km', () => {
    expect(distanceM(origin, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1)
  })
  it('is symmetric', () => {
    const a = { lat: 10, lng: 20 }
    const b = { lat: 10.01, lng: 20.02 }
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6)
  })
  it('walk minutes = metres / 80', () => {
    const b = { lat: 480 / 111_195, lng: 0 } // ~480 m
    expect(walkMin(origin, b)).toBeCloseTo(6, 1)
  })
  it('formats with a tilde and never below 1', () => {
    expect(formatWalk(6.4)).toBe('~6 min walk')
    expect(formatWalk(0.2)).toBe('~1 min walk')
  })
  it('walk ring is 800 m', () => {
    expect(WALK_RING_M).toBe(800)
  })
})

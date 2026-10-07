import { describe, expect, it } from 'vitest'
import { clusterPins, CLUSTER_MAX_ZOOM } from '../../src/map/cluster'
import { visiblePins } from '../../src/map/visible'
import type { Pin } from '../../src/types'

// Synthetic numbers, never displayed.
const mk = (id: string, lat: number, lng: number, type: Pin['type'] = 'civic'): Pin => ({
  id, type, title: id, lat, lng, createdAt: 0, createdBy: 'd', postedAs: 'neighbour', status: 'active',
})

describe('clusterPins', () => {
  const near = [mk('a', 10, 10), mk('b', 10.0001, 10.0001), mk('c', 10.0002, 10)]
  const far = mk('z', 11, 11)
  it('no clusters above zoom 13', () => {
    const r = clusterPins([...near, far], CLUSTER_MAX_ZOOM + 1)
    expect(r.clusters).toHaveLength(0)
    expect(r.singles).toHaveLength(4)
  })
  it('groups close pins at zoom 13', () => {
    const r = clusterPins([...near, far], 13)
    expect(r.clusters).toHaveLength(1)
    expect(r.clusters[0].count).toBe(3)
    expect(r.clusters[0].lat).toBeCloseTo(10.0001, 4)
    expect(r.singles.map((p) => p.id)).toEqual(['z'])
  })
  it('keepSingle pins are not absorbed', () => {
    const r = clusterPins(near, 13, { keepSingle: new Set(['a']) })
    expect(r.singles.map((p) => p.id)).toContain('a')
    expect(r.clusters[0]?.count).toBe(2)
  })
  it('cluster id is stable', () => {
    expect(clusterPins(near, 12).clusters[0].id).toBe(clusterPins([...near].reverse(), 12).clusters[0].id)
  })
})

describe('visiblePins', () => {
  const pins = [mk('c', 1, 1, 'civic'), mk('e', 1, 1, 'event'), mk('k', 1, 1, 'ask'), mk('ar', 1, 1, 'area'),
    { ...mk('h', 1, 1), status: 'hidden' as const }]
  it('never shows area or hidden', () => {
    expect(visiblePins(pins, [], 'all', 0).map((p) => p.id)).toEqual(['c', 'e', 'k'])
  })
  it('filters by chip', () => {
    expect(visiblePins(pins, [], 'event', 0).map((p) => p.id)).toEqual(['e'])
  })
})

import { describe, expect, it } from 'vitest'
import { materialise, resolveTime } from '../../src/data/materialise'
import { createMockRepo } from '../../src/data/mockRepo'
import type { SeedFile } from '../../src/data/seedTypes'
import seedJson from '../../src/data/seed.generated.json'
import type { Pin, Support } from '../../src/types'

const seed = seedJson as SeedFile
const NOW = Date.parse('2026-10-07T09:00:00Z') // a Wednesday, 14:30 IST

describe('resolveTime', () => {
  it('offsets in minutes', () => expect(resolveTime({ min: 90 }, NOW)).toBe(NOW + 90 * 60_000))
  it('tomorrow 10:00 IST', () => {
    expect(new Date(resolveTime({ day: 'tomorrow', h: 10 }, NOW)).toISOString()).toBe('2026-10-08T04:30:00.000Z')
  })
  it('next Saturday and Sunday in IST', () => {
    expect(new Date(resolveTime({ day: 'sat', h: 17 }, NOW)).toISOString()).toBe('2026-10-10T11:30:00.000Z')
    expect(new Date(resolveTime({ day: 'sun', h: 6, m: 30 }, NOW)).toISOString()).toBe('2026-10-11T01:00:00.000Z')
  })
  it('a Saturday slot already passed today moves to next week', () => {
    const sat = Date.parse('2026-10-10T12:00:00Z') // 17:30 IST Saturday
    expect(resolveTime({ day: 'sat', h: 9 }, sat)).toBeGreaterThan(sat + 6 * 86_400_000)
  })
})

describe('seed', () => {
  const { pins, supports } = materialise(seed, NOW)
  it('has the planned mix', () => {
    const n = (t: string) => pins.filter((p) => p.type === t).length
    expect([n('event'), n('civic'), n('ask'), n('area')]).toEqual([10, 5, 3, 1])
  })
  it('is deterministic', () => expect(materialise(seed, NOW)).toEqual({ pins, supports }))
  it('marks everything seed and never uses a person name', () => {
    expect(pins.every((p) => p.seed === true && p.createdBy === 'seed' && p.status === 'active')).toBe(true)
    expect(supports.every((s) => s.deviceId.startsWith('seed-dev-') && s.id === `${s.pinId}_${s.deviceId}`)).toBe(true)
  })
  it('area updates are ptp with radius, topic and an end', () => {
    const areas = pins.filter((p) => p.type === 'area')
    expect(areas.every((p) => p.postedAs === 'ptp' && p.radiusM && p.topic && p.endsAt)).toBe(true)
  })
  it('real items carry a source link, a fixed date and a Google place', () => {
    const real = pins.filter((p) => p.id.startsWith('real-'))
    expect(real.length).toBeGreaterThanOrEqual(10)
    expect(real.every((p) => p.postedAs === 'ptp' && p.sourceUrl?.startsWith('https://') && p.sourceLabel)).toBe(true)
    expect(real.filter((p) => p.type !== 'area').every((p) => p.placeId && p.placeName)).toBe(true)
    // fixed dates do not move with "now"
    const later = materialise(seed, NOW + 86_400_000).pins.find((p) => p.id === 'real-event-04')!
    expect(later.startsAt).toBe(pins.find((p) => p.id === 'real-event-04')!.startsAt)
  })
  it('events have a start', () => {
    expect(pins.filter((p) => p.type === 'event').every((p) => typeof p.startsAt === 'number')).toBe(true)
  })
  it('neighbour demo posts stay few and are marked seed', () => {
    const demo = pins.filter((p) => p.id.startsWith('seed-'))
    expect(demo.length).toBeLessThanOrEqual(6)
    expect(demo.every((p) => p.postedAs === 'neighbour')).toBe(true)
  })
  it('has no placeholder text', () => {
    expect(JSON.stringify(seed)).not.toMatch(/lorem|Event \d/i)
  })
})

describe('mock repo', () => {
  it('toggleSupport: double tap does not double count', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    let sup: Support[] = []
    repo.subscribeSupports((s) => (sup = s))
    const id = 'seed-civic-02'
    const before = sup.filter((s) => s.pinId === id).length
    expect((await repo.toggleSupport(id)).supported).toBe(true)
    expect(sup.filter((s) => s.pinId === id).length).toBe(before + 1)
    expect((await repo.toggleSupport(id)).supported).toBe(false)
    expect(sup.filter((s) => s.pinId === id).length).toBe(before)
    await repo.toggleSupport(id)
    expect(sup.filter((s) => s.pinId === id).length).toBe(before + 1)
  })
  it('a support updates lastSupportAt', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    let pins: Pin[] = []
    repo.subscribePins(null, (p) => (pins = p))
    await repo.toggleSupport('seed-ask-01')
    expect(pins.find((p) => p.id === 'seed-ask-01')!.lastSupportAt).toBe(NOW)
  })
  it('createPin forces neighbour/active and appears in the subscription', async () => {
    const repo = createMockRepo(seed, () => NOW)
    const { deviceId } = await repo.init()
    let pins: Pin[] = []
    repo.subscribePins(null, (p) => (pins = p))
    const made = await repo.createPin({ type: 'ask', title: 'Need a plumber for a leaking tap', lat: 19.06, lng: 72.83 })
    expect(made).toMatchObject({ postedAs: 'neighbour', status: 'active', createdAt: NOW, createdBy: deviceId })
    expect(pins[0].id).toBe(made.id)
  })
})

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
    expect([n('event'), n('civic'), n('ask'), n('area')]).toEqual([12, 10, 8, 2])
  })
  it('is deterministic', () => expect(materialise(seed, NOW)).toEqual({ pins, supports }))
  it('marks everything seed and never uses a person name', () => {
    expect(pins.every((p) => p.seed === true && p.createdBy === 'seed' && p.status === 'active')).toBe(true)
    expect(supports.every((s) => s.deviceId.startsWith('seed-dev-') && s.id === `${s.pinId}_${s.deviceId}`)).toBe(true)
  })
  it('area updates are ptp with radius, topic and one Extended', () => {
    const areas = pins.filter((p) => p.type === 'area')
    expect(areas.every((p) => p.postedAs === 'ptp' && p.radiusM && p.topic && p.endsAt)).toBe(true)
    expect(areas.filter((p) => p.endsAt! > p.endsAtOriginal!).length).toBe(1)
  })
  it('events have a start; place posts keep placeId and placeName', () => {
    expect(pins.filter((p) => p.type === 'event').every((p) => typeof p.startsAt === 'number')).toBe(true)
    const places = pins.filter((p) => p.postedAs === 'place')
    expect(places.length).toBeGreaterThanOrEqual(2)
    expect(places.every((p) => p.placeId && p.placeName)).toBe(true)
  })
  it('several civic pins are fresh enough for Pulse (supported within 3 h)', () => {
    const fresh = pins.filter((p) => p.type === 'civic' && p.lastSupportAt && NOW - p.lastSupportAt < 3 * 3_600_000)
    expect(fresh.length).toBeGreaterThanOrEqual(4)
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
    const id = 'seed-civic-08'
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
    await repo.toggleSupport('seed-ask-08')
    expect(pins.find((p) => p.id === 'seed-ask-08')!.lastSupportAt).toBe(NOW)
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

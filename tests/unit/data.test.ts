import { describe, expect, it } from 'vitest'
import { materialise, resolveTime } from '../../src/data/materialise'
import { createMockRepo } from '../../src/data/mockRepo'
import { checkNewPin } from '../../src/lib/claims'
import type { SeedFile } from '../../src/data/seedTypes'
import seedJson from '../../src/data/seed.generated.json'
import type { Claim, Comment, Pin, Support } from '../../src/types'

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
  const { pins, supports, comments } = materialise(seed, NOW)
  it('has the planned mix', () => {
    const n = (t: string) => pins.filter((p) => p.type === t).length
    // civic 6: seed-civic-03 is a second report of seed-civic-01's streetlight (merged on the map, DECISIONS 2026-10-23)
    expect([n('event'), n('civic'), n('ask'), n('area')]).toEqual([10, 6, 3, 1])
  })
  it('is deterministic', () => expect(materialise(seed, NOW)).toEqual({ pins, supports, comments }))
  it('seed comments are live, marked seed, on existing neighbour posts, within 280 characters', () => {
    expect(comments.length).toBeGreaterThanOrEqual(4)
    for (const c of comments) {
      expect(c).toMatchObject({ status: 'live', seed: true })
      expect(c.deviceId.startsWith('seed-dev-')).toBe(true)
      expect(c.text.length).toBeLessThanOrEqual(280)
      expect(pins.find((p) => p.id === c.pinId)?.postedAs).toBe('neighbour')
      expect(c.createdAt).toBeLessThan(NOW)
    }
  })
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

describe('mock repo comments', () => {
  it('only live comments reach subscribers', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    let got: Comment[] = []
    repo.subscribeComments((c) => (got = c))
    expect(got.length).toBe(seed.comments!.length)
    expect(got.every((c) => c.status === 'live')).toBe(true)
  })
  it('addComment posts as this device with status under_review and is not shown', async () => {
    const repo = createMockRepo(seed, () => NOW)
    const { deviceId } = await repo.init()
    let got: Comment[] = []
    repo.subscribeComments((c) => (got = c))
    const before = got.length
    const made = await repo.addComment({ pinId: 'seed-civic-02', text: '  Still open at 6 pm.  ' })
    expect(made).toMatchObject({ status: 'under_review', deviceId, createdAt: NOW, text: 'Still open at 6 pm.', pinId: 'seed-civic-02' })
    expect(got.length).toBe(before)
    expect(got.some((c) => c.id === made.id)).toBe(false)
  })
  it('rejects empty text, over 280 characters, and unknown pins', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    await expect(repo.addComment({ pinId: 'seed-civic-02', text: '   ' })).rejects.toThrow()
    await expect(repo.addComment({ pinId: 'seed-civic-02', text: 'x'.repeat(281) })).rejects.toThrow()
    await expect(repo.addComment({ pinId: 'seed-civic-02', text: 'x'.repeat(280) })).resolves.toMatchObject({ status: 'under_review' })
    await expect(repo.addComment({ pinId: 'nope', text: 'Hello there' })).rejects.toThrow()
  })
})

describe('mock repo claims and place posts (DECISIONS.md 2026-10-22)', () => {
  const place = { placeId: 'gp-tuition', placeName: 'Bright Minds Tuition' }
  const offer = {
    type: 'offer' as const,
    title: '20% off evening batches this week',
    lat: 19.06,
    lng: 72.83,
    placeId: place.placeId,
    placeName: place.placeName,
    endsAt: NOW + 7 * 24 * 3600_000,
    asPlace: true,
  }
  it('a claim starts pending, paid by the mock checkout, $100 a month, for this device', async () => {
    const repo = createMockRepo(seed, () => NOW)
    const { deviceId } = await repo.init()
    let got: Claim[] = []
    repo.subscribeClaims((c) => (got = c))
    expect(got).toEqual([])
    const claim = await repo.claimPlace(place)
    expect(claim).toMatchObject({ id: place.placeId, status: 'pending', deviceId, priceUsd: 100, plan: 'monthly', paid: true })
    expect(got).toHaveLength(1)
  })
  it('a place can only be claimed once', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    await repo.claimPlace(place)
    await expect(repo.claimPlace(place)).rejects.toThrow(/already claimed/)
  })
  it('posting as the place waits for the team; after approval it posts as "place"', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    await repo.claimPlace(place)
    await expect(repo.createPin(offer)).rejects.toThrow(/not claimed by you/)
    repo.approveClaim(place.placeId)
    const pin = await repo.createPin(offer)
    expect(pin).toMatchObject({ type: 'offer', postedAs: 'place', endsAt: offer.endsAt, placeId: place.placeId })
  })
  it('another device cannot post as a place it did not claim', () => {
    const claims: Claim[] = [{ ...place, id: place.placeId, deviceId: 'someone-else', status: 'active', plan: 'monthly', priceUsd: 100, paid: true, createdAt: NOW }]
    expect(() => checkNewPin(offer, 'me', claims)).toThrow(/not claimed by you/)
    expect(() => checkNewPin(offer, 'someone-else', claims)).not.toThrow()
  })
  it('only a place posts offers; an offer needs an end; a place posts offers or events only', () => {
    const claims: Claim[] = [{ ...place, id: place.placeId, deviceId: 'me', status: 'active', plan: 'monthly', priceUsd: 100, paid: true, createdAt: NOW }]
    expect(() => checkNewPin({ ...offer, asPlace: false }, 'me', claims)).toThrow(/only a claimed place/)
    expect(() => checkNewPin({ ...offer, endsAt: null }, 'me', claims)).toThrow(/end date/)
    expect(() => checkNewPin({ ...offer, type: 'civic' }, 'me', claims)).toThrow(/offers or events/)
  })
  it('neighbour posts are unchanged: still postedAs neighbour', async () => {
    const repo = createMockRepo(seed, () => NOW)
    await repo.init()
    const pin = await repo.createPin({ type: 'ask', title: 'Need a ladder for an hour', lat: 19.06, lng: 72.83 })
    expect(pin.postedAs).toBe('neighbour')
  })
})

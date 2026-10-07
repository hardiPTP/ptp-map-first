import { describe, expect, it } from 'vitest'
import { isLive, isPulsing, previousEvening, pulseWindow } from '../../src/lib/pulse'
import type { Pin, Support } from '../../src/types'

const H = 3600_000
const D = 24 * H
// 14:00 local on a fixed synthetic day
const now = new Date(2030, 5, 15, 14, 0, 0).getTime()
let n = 0
const pin = (o: Partial<Pin> = {}): Pin => ({
  id: `p${++n}`, type: 'civic', title: 't', lat: 0, lng: 0, createdAt: now - 5 * D, createdBy: 'd',
  postedAs: 'neighbour', status: 'active', ...o,
})
const sup = (pinId: string, ageMs: number): Support => ({ id: `${pinId}_d`, pinId, deviceId: 'd', createdAt: now - ageMs })

describe('isPulsing', () => {
  it('posted within 3h', () => expect(isPulsing(pin({ createdAt: now - 2 * H }), [], now)).toBe(true))
  it('posted 4h ago, no support', () => expect(isPulsing(pin({ createdAt: now - 4 * H }), [], now)).toBe(false))
  it('supported within 3h', () => {
    const p = pin()
    expect(isPulsing(p, [sup(p.id, H)], now)).toBe(true)
    expect(isPulsing(p, [sup(p.id, 4 * H)], now)).toBe(false)
  })
  it('event starting in the next 2h', () => {
    expect(isPulsing(pin({ type: 'event', startsAt: now + H }), [], now)).toBe(true)
    expect(isPulsing(pin({ type: 'event', startsAt: now + 3 * H }), [], now)).toBe(false)
    expect(isPulsing(pin({ type: 'event', startsAt: now - H }), [], now)).toBe(false)
  })
  it('area updates never pulse', () => expect(isPulsing(pin({ type: 'area', createdAt: now }), [], now)).toBe(false))
})

describe('isLive', () => {
  it('hidden status', () => expect(isLive(pin({ status: 'hidden', createdAt: now }), [], now)).toBe(false))
  it('civic with no activity for 30 days is hidden, a support revives it', () => {
    const p = pin({ createdAt: now - 31 * D })
    expect(isLive(p, [], now)).toBe(false)
    expect(isLive(p, [sup(p.id, D)], now)).toBe(true)
    expect(isLive(pin({ createdAt: now - 29 * D }), [], now)).toBe(true)
  })
  it('event disappears 2h after it ends (endsAt)', () => {
    expect(isLive(pin({ type: 'event', startsAt: now - 6 * H, endsAt: now - 1 * H }), [], now)).toBe(true)
    expect(isLive(pin({ type: 'event', startsAt: now - 6 * H, endsAt: now - 3 * H }), [], now)).toBe(false)
  })
  it('event without endsAt ends 2h after start', () => {
    expect(isLive(pin({ type: 'event', startsAt: now - 3 * H }), [], now)).toBe(true)
    expect(isLive(pin({ type: 'event', startsAt: now - 5 * H }), [], now)).toBe(false)
  })
  it('area update disappears at its end', () => {
    expect(isLive(pin({ type: 'area', endsAt: now + H }), [], now)).toBe(true)
    expect(isLive(pin({ type: 'area', endsAt: now - 1 }), [], now)).toBe(false)
  })
  it('ask stays live', () => expect(isLive(pin({ type: 'ask', createdAt: now - 60 * D }), [], now)).toBe(true))
})

describe('previousEvening', () => {
  it('is 18:00 local the day before', () => {
    const d = new Date(previousEvening(now))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2030, 5, 14, 18, 0])
  })
})

describe('pulseWindow', () => {
  it('3h window when 5 or more items', () => {
    const pins = Array.from({ length: 5 }, () => pin({ type: 'ask', createdAt: now - H }))
    const old = pin({ type: 'ask', createdAt: now - 8 * H })
    const w = pulseWindow([...pins, old], [], now)
    expect(w.mode).toBe('last3h')
    expect(w.items).toHaveLength(5)
    expect(w.since).toBe(now - 3 * H)
  })
  it('falls back to since last night when under 5', () => {
    const recent = pin({ type: 'ask', createdAt: now - H })
    const lastEvening = pin({ type: 'ask', createdAt: new Date(2030, 5, 14, 19, 0).getTime() })
    const tooOld = pin({ type: 'ask', createdAt: new Date(2030, 5, 14, 17, 0).getTime() })
    const w = pulseWindow([recent, lastEvening, tooOld], [], now)
    expect(w.mode).toBe('sinceLastNight')
    expect(w.items.map((p) => p.id).sort()).toEqual([recent.id, lastEvening.id].sort())
  })
  it('a support puts an old civic pin back in the window', () => {
    const c = pin()
    expect(pulseWindow([c], [sup(c.id, H)], now).items).toHaveLength(1)
    expect(pulseWindow([c], [], now).items).toHaveLength(0)
  })
  it('events in the coming week qualify; further out or ended do not', () => {
    const today = pin({ type: 'event', startsAt: new Date(2030, 5, 15, 19, 0).getTime() })
    const tomorrow = pin({ type: 'event', startsAt: new Date(2030, 5, 16, 10, 0).getTime() })
    const nextMonth = pin({ type: 'event', startsAt: now + 30 * 24 * H })
    const gone = pin({ type: 'event', startsAt: now - 6 * H })
    const ids = pulseWindow([today, tomorrow, nextMonth, gone], [], now).items.map((p) => p.id)
    expect(ids.sort()).toEqual([today.id, tomorrow.id].sort())
  })
  it('excludes area updates and hidden pins', () => {
    const items = pulseWindow([pin({ type: 'area', createdAt: now }), pin({ status: 'hidden', createdAt: now })], [], now).items
    expect(items).toHaveLength(0)
  })
})

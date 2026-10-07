// In-memory Repo fed by seed.generated.json. State lives for the page session; only the device id persists.
import type { Bounds, NewPin, Pin, Repo, Support } from '../types'
import { materialise } from './materialise'
import type { SeedFile } from './seedTypes'
import seedJson from './seed.generated.json'

const DEVICE_KEY = 'ptp-device-id'

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function loadDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const id = newId('dev')
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    return newId('dev')
  }
}

export function createMockRepo(seed: SeedFile = seedJson as SeedFile, now: () => number = Date.now): Repo {
  const t0 = now()
  const m = materialise(seed, t0)
  let pins: Pin[] = m.pins
  let supports: Support[] = m.supports
  let deviceId: string | null = null
  const pinSubs = new Set<(p: Pin[]) => void>()
  const supSubs = new Set<(s: Support[]) => void>()
  const emitPins = () => pinSubs.forEach((cb) => cb(pins.filter((p) => p.status === 'active')))
  const emitSupports = () => supSubs.forEach((cb) => cb(supports))
  const device = () => (deviceId ??= loadDeviceId())

  return {
    async init() {
      return { deviceId: device() }
    },
    subscribePins(_bounds: Bounds | null, cb) {
      pinSubs.add(cb)
      cb(pins.filter((p) => p.status === 'active'))
      return () => void pinSubs.delete(cb)
    },
    subscribeSupports(cb) {
      supSubs.add(cb)
      cb(supports)
      return () => void supSubs.delete(cb)
    },
    async createPin(input: NewPin) {
      const pin: Pin = {
        id: newId('pin'),
        type: input.type,
        title: input.title,
        body: null,
        lat: input.lat,
        lng: input.lng,
        placeId: input.placeId ?? null,
        placeName: input.placeName ?? null,
        startsAt: input.type === 'event' ? (input.startsAt ?? null) : null,
        createdAt: now(),
        createdBy: device(),
        lastSupportAt: null,
        postedAs: 'neighbour', // forced: users can only post as Neighbour
        status: 'active',
      }
      pins = [pin, ...pins]
      emitPins()
      return pin
    },
    async toggleSupport(pinId: string) {
      const dev = device()
      const id = `${pinId}_${dev}`
      if (!pins.some((p) => p.id === pinId)) throw new Error('pin not found')
      if (supports.some((s) => s.id === id)) {
        supports = supports.filter((s) => s.id !== id)
        emitSupports()
        return { supported: false }
      }
      const at = now()
      supports = [...supports, { id, pinId, deviceId: dev, createdAt: at }]
      pins = pins.map((p) => (p.id === pinId ? { ...p, lastSupportAt: at } : p))
      emitSupports()
      emitPins()
      return { supported: true }
    },
  }
}

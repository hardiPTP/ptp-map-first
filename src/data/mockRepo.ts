// In-memory Repo fed by seed.generated.json. State lives for the page session; only the device id persists.
import { checkNewPin } from '../lib/claims'
import { cleanCommentText } from '../lib/comments'
import { validPhoto } from '../lib/photo'
import { CLAIM_PRICE_USD, type Bounds, type Claim, type Comment, type NewClaim, type NewComment, type NewPin, type Pin, type Repo, type Support } from '../types'
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

/** The mock also stands in for the team's database tools: approving a claim (Firestore: the Admin SDK). */
export interface MockRepo extends Repo {
  /** Approve one place's claim, or every pending claim when no placeId is given. */
  approveClaim(placeId?: string): void
}

export function createMockRepo(seed: SeedFile = seedJson as SeedFile, now: () => number = Date.now): MockRepo {
  const t0 = now()
  const m = materialise(seed, t0)
  let pins: Pin[] = m.pins
  let supports: Support[] = m.supports
  let comments: Comment[] = m.comments
  let claims: Claim[] = []
  const photos = new Map<string, string>()
  const claimSubs = new Set<(c: Claim[]) => void>()
  const emitClaims = () => claimSubs.forEach((cb) => cb(claims))
  let deviceId: string | null = null
  const pinSubs = new Set<(p: Pin[]) => void>()
  const supSubs = new Set<(s: Support[]) => void>()
  const comSubs = new Set<(c: Comment[]) => void>()
  const emitPins = () => pinSubs.forEach((cb) => cb(pins.filter((p) => p.status === 'active')))
  const emitSupports = () => supSubs.forEach((cb) => cb(supports))
  // Same as the Firestore query: only live comments leave the repo.
  const liveComments = () => comments.filter((c) => c.status === 'live')
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
      checkNewPin(input, device(), claims)
      if (input.photo && !validPhoto(input.photo)) throw new Error('the photo is not a small JPEG')
      const asPlace = !!input.asPlace
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
        endsAt: input.type === 'offer' ? (input.endsAt ?? null) : null,
        createdAt: now(),
        createdBy: device(),
        lastSupportAt: null,
        postedAs: asPlace ? 'place' : 'neighbour', // place only with an active claim (checked above)
        status: 'active',
        ...(input.photo ? { hasPhoto: true } : {}),
      }
      if (input.photo) photos.set(pin.id, input.photo)
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
    subscribeComments(cb) {
      comSubs.add(cb)
      cb(liveComments())
      return () => void comSubs.delete(cb)
    },
    async addComment(input: NewComment) {
      if (!pins.some((p) => p.id === input.pinId)) throw new Error('pin not found')
      const comment: Comment = {
        id: newId('cmt'),
        pinId: input.pinId,
        text: cleanCommentText(input.text),
        createdAt: now(),
        deviceId: device(),
        status: 'under_review', // every new comment waits for review; it is not emitted until it goes live
      }
      comments = [...comments, comment]
      return comment
    },
    subscribeClaims(cb) {
      claimSubs.add(cb)
      cb(claims)
      return () => void claimSubs.delete(cb)
    },
    async claimPlace(input: NewClaim) {
      if (!input.placeId || !input.placeName.trim()) throw new Error('no place to claim')
      if (claims.some((c) => c.placeId === input.placeId)) throw new Error('this place is already claimed')
      const claim: Claim = {
        id: input.placeId,
        placeId: input.placeId,
        placeName: input.placeName.trim(),
        deviceId: device(),
        status: 'pending', // the team checks every claim before the place can post
        plan: 'monthly',
        priceUsd: CLAIM_PRICE_USD,
        paid: true, // mock checkout: nothing is charged
        createdAt: now(),
      }
      claims = [...claims, claim]
      emitClaims()
      return claim
    },
    async getPhoto(pinId: string) {
      return photos.get(pinId) ?? null
    },
    approveClaim(placeId?: string) {
      claims = claims.map((c) => (placeId == null || c.placeId === placeId ? { ...c, status: 'active' } : c))
      emitClaims()
    },
  }
}

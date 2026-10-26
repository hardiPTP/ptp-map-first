// Phase 0 baseline rules test (lead). API: https://firebase.google.com/docs/rules/unit-tests
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { createClaimDoc, createCommentDoc, createPinDoc, toggleSupportTx } from '../../src/data/firestoreRepo'

let env: RulesTestEnvironment

// Synthetic values for rule checks only; never displayed.
const base = (uid: string) => ({
  type: 'civic',
  title: 'Streetlight out near the corner',
  lat: 1,
  lng: 2,
  createdAt: 1,
  createdBy: uid,
  postedAs: 'neighbour',
  status: 'active',
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ptp',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
beforeEach(async () => env.clearFirestore())
afterAll(async () => env.cleanup())

describe('pins', () => {
  it('neighbour post succeeds', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertSucceeds(setDoc(doc(db, 'pins/p1'), base('u1')))
  })
  it('postedAs ptp is rejected', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/p1'), { ...base('u1'), postedAs: 'ptp' }))
  })
  it('postedAs place is rejected', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/p1'), { ...base('u1'), postedAs: 'place' }))
  })
  it('area type is rejected from clients', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/p1'), { ...base('u1'), type: 'area' }))
  })
  it('createdBy must be the caller', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/p1'), base('someone-else')))
  })
  it('unauthenticated write is rejected', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'pins/p1'), base('u1')))
  })
  it('only lastSupportAt may be updated', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await setDoc(doc(db, 'pins/p1'), base('u1'))
    await assertSucceeds(updateDoc(doc(db, 'pins/p1'), { lastSupportAt: 5 }))
    await assertFails(updateDoc(doc(db, 'pins/p1'), { title: 'Changed title here' }))
  })
})

describe('supports', () => {
  it('id must be pinId_uid', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await setDoc(doc(db, 'pins/p1'), base('u1'))
    const s = { pinId: 'p1', deviceId: 'u1', createdAt: 1 }
    await assertSucceeds(setDoc(doc(db, 'supports/p1_u1'), s))
    await assertFails(setDoc(doc(db, 'supports/p1_u2'), s))
    await assertFails(setDoc(doc(db, 'supports/p1_u1x'), s))
  })
  it('only the owner can remove a support', async () => {
    const u1 = env.authenticatedContext('u1').firestore()
    const u2 = env.authenticatedContext('u2').firestore()
    await setDoc(doc(u1, 'pins/p1'), base('u1'))
    await setDoc(doc(u1, 'supports/p1_u1'), { pinId: 'p1', deviceId: 'u1', createdAt: 1 })
    await assertFails(deleteDoc(doc(u2, 'supports/p1_u1')))
    await assertSucceeds(deleteDoc(doc(u1, 'supports/p1_u1')))
  })
})

// Real repo functions (createPinDoc, toggleSupportTx) against the emulator with rules loaded.
// Kept in this file: vitest runs files in parallel and each clears the shared emulator.
const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore
const count = async (d: Firestore, pinId: string) =>
  (await getDocs(collection(d, 'supports'))).docs.filter((s) => s.data().pinId === pinId).length

describe('toggleSupportTx', () => {
  it('double tap does not double count; second call removes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pins/p1'), { type: 'civic', title: 'Open drain cover', status: 'active', postedAs: 'neighbour' })
    })
    const u1 = db('u1')
    const [a, b] = await Promise.all([toggleSupportTx(u1, 'u1', 'p1'), toggleSupportTx(u1, 'u1', 'p1')])
    // Two concurrent taps serialise: one adds, one removes. Never two supports.
    expect([a.supported, b.supported].sort()).toEqual([false, true])
    expect(await count(u1, 'p1')).toBeLessThanOrEqual(1)
  })
  it('sequential taps: add then remove then add', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pins/p1'), { type: 'civic', title: 'Open drain cover', status: 'active', postedAs: 'neighbour' })
    })
    const u1 = db('u1')
    await assertSucceeds(toggleSupportTx(u1, 'u1', 'p1'))
    expect(await count(u1, 'p1')).toBe(1)
    expect((await getDoc(doc(u1, 'pins/p1'))).data()!.lastSupportAt).toBeTypeOf('number')
    expect((await toggleSupportTx(u1, 'u1', 'p1')).supported).toBe(false)
    expect(await count(u1, 'p1')).toBe(0)
    expect((await toggleSupportTx(u1, 'u1', 'p1')).supported).toBe(true)
    expect(await count(u1, 'p1')).toBe(1)
  })
  it('two devices each count once', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pins/p1'), { type: 'ask', title: 'Need a ladder', status: 'active', postedAs: 'neighbour' })
    })
    await toggleSupportTx(db('u1'), 'u1', 'p1')
    await toggleSupportTx(db('u2'), 'u2', 'p1')
    expect(await count(db('u1'), 'p1')).toBe(2)
  })
  it('cannot support a pin that does not exist', async () => {
    await assertFails(toggleSupportTx(db('u1'), 'u1', 'nope'))
  })
})

describe('createPinDoc', () => {
  it('writes a neighbour pin the rules accept, for each type', async () => {
    const u1 = db('u1')
    const civic = await createPinDoc(u1, 'u1', { type: 'civic', title: 'Garbage not cleared', lat: 1, lng: 2 })
    const event = await createPinDoc(u1, 'u1', { type: 'event', title: 'Walk at six', lat: 1, lng: 2, startsAt: 5, placeId: 'x', placeName: 'Y' })
    const ask = await createPinDoc(u1, 'u1', { type: 'ask', title: 'Need a plumber', lat: 1, lng: 2 })
    for (const p of [civic, event, ask]) expect(p).toMatchObject({ postedAs: 'neighbour', createdBy: 'u1', status: 'active' })
  })
})

describe('comments', () => {
  const seedPin = async () =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pins/p1'), base('owner'))
      await setDoc(doc(ctx.firestore(), 'comments/live1'), { pinId: 'p1', text: 'Seen it', createdAt: 1, deviceId: 'x', status: 'live' })
      await setDoc(doc(ctx.firestore(), 'comments/pending1'), { pinId: 'p1', text: 'Pending', createdAt: 1, deviceId: 'u2', status: 'under_review' })
    })
  const c = (uid: string, o: Record<string, unknown> = {}) => ({ pinId: 'p1', text: 'Still dark at 7 pm', createdAt: 1, deviceId: uid, status: 'under_review', ...o })

  it('the app write posts under_review as this device', async () => {
    await seedPin()
    const db = env.authenticatedContext('u1').firestore() as unknown as Firestore
    const made = await assertSucceeds(createCommentDoc(db, 'u1', { pinId: 'p1', text: ' Still dark at 7 pm ' }))
    expect(made).toMatchObject({ status: 'under_review', deviceId: 'u1', text: 'Still dark at 7 pm' })
  })
  it('a client cannot post a live comment, as another device, over 280, empty, extra fields, or on a missing pin', async () => {
    await seedPin()
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'comments/a'), c('u1', { status: 'live' })))
    await assertFails(setDoc(doc(db, 'comments/b'), c('u2')))
    await assertFails(setDoc(doc(db, 'comments/c'), c('u1', { text: 'x'.repeat(281) })))
    await assertFails(setDoc(doc(db, 'comments/d'), c('u1', { text: '' })))
    await assertFails(setDoc(doc(db, 'comments/e'), c('u1', { name: 'A Name' })))
    await assertFails(setDoc(doc(db, 'comments/f'), c('u1', { pinId: 'nope' })))
    await assertSucceeds(setDoc(doc(db, 'comments/g'), c('u1', { text: 'x'.repeat(280) })))
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'comments/h'), c('u1')))
  })
  it('nobody can make a comment live or delete it from a client', async () => {
    await seedPin()
    const db = env.authenticatedContext('u2').firestore()
    await assertFails(updateDoc(doc(db, 'comments/pending1'), { status: 'live' }))
    await assertFails(deleteDoc(doc(db, 'comments/pending1')))
  })
  it('everyone reads live comments; pending ones only by their own device', async () => {
    await seedPin()
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDocs(query(collection(anon, 'comments'), where('status', '==', 'live'))))
    await assertFails(getDocs(collection(anon, 'comments')))
    await assertFails(getDoc(doc(env.authenticatedContext('u1').firestore(), 'comments/pending1')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext('u2').firestore(), 'comments/pending1')))
  })
})

describe('claims and place posts (DECISIONS.md 2026-10-22)', () => {
  const claimData = (uid: string, o: Record<string, unknown> = {}) => ({
    placeId: 'gp1', placeName: 'Bright Minds Tuition', deviceId: uid, status: 'pending', plan: 'monthly', priceUsd: 100, paid: true, createdAt: 1, ...o,
  })
  const offer = (uid: string, o: Record<string, unknown> = {}) => ({
    type: 'offer', title: '20% off evening batches', lat: 1, lng: 2, placeId: 'gp1', placeName: 'Bright Minds Tuition',
    endsAt: 10, createdAt: 1, createdBy: uid, postedAs: 'place', status: 'active', ...o,
  })
  const seedClaim = (status: string, uid = 'u1') =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'claims/gp1'), claimData(uid, { status }))
    })

  it('createClaimDoc writes a pending claim the rules accept; a second claim on the place fails', async () => {
    const db = env.authenticatedContext('u1').firestore()
    const c = await createClaimDoc(db as unknown as Firestore, 'u1', { placeId: 'gp1', placeName: 'Bright Minds Tuition' })
    expect(c).toMatchObject({ status: 'pending', priceUsd: 100, deviceId: 'u1' })
    const other = env.authenticatedContext('u2').firestore()
    await expect(createClaimDoc(other as unknown as Firestore, 'u2', { placeId: 'gp1', placeName: 'Bright Minds Tuition' })).rejects.toThrow(/already claimed/)
    await assertFails(setDoc(doc(other, 'claims/gp1'), claimData('u2')))
  })
  it('a client cannot create an active claim, change the price, claim for someone else, or approve its own claim', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'claims/gp1'), claimData('u1', { status: 'active' })))
    await assertFails(setDoc(doc(db, 'claims/gp1'), claimData('u1', { priceUsd: 1 })))
    await assertFails(setDoc(doc(db, 'claims/gp1'), claimData('u2')))
    await assertFails(setDoc(doc(db, 'claims/other-id'), claimData('u1')))
    await seedClaim('pending')
    await assertFails(updateDoc(doc(db, 'claims/gp1'), { status: 'active' }))
  })
  it('posting as the place needs an ACTIVE claim held by the caller', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/o1'), offer('u1'))) // no claim
    await seedClaim('pending')
    await assertFails(setDoc(doc(db, 'pins/o1'), offer('u1'))) // still checking
    await seedClaim('active')
    await assertSucceeds(setDoc(doc(db, 'pins/o1'), offer('u1')))
    const u2 = env.authenticatedContext('u2').firestore()
    await assertFails(setDoc(doc(u2, 'pins/o2'), offer('u2'))) // someone else's place
  })
  it('a place post must use the claimed name, carry an end for offers, and be an offer or event', async () => {
    await seedClaim('active')
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/o1'), offer('u1', { placeName: 'Somewhere Else' })))
    await assertFails(setDoc(doc(db, 'pins/o1'), { ...offer('u1'), endsAt: null }))
    await assertFails(setDoc(doc(db, 'pins/o1'), offer('u1', { type: 'civic' })))
    await assertSucceeds(setDoc(doc(db, 'pins/o1'), offer('u1', { type: 'event', startsAt: 5, endsAt: 7 })))
  })
  it('a neighbour still cannot post an offer', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/o1'), offer('u1', { postedAs: 'neighbour' })))
  })
  it('createPinDoc posts an offer as the place once the claim is active', async () => {
    await seedClaim('active')
    const db = env.authenticatedContext('u1').firestore() as unknown as Firestore
    const pin = await createPinDoc(db, 'u1', {
      type: 'offer', title: '20% off evening batches', lat: 1, lng: 2, placeId: 'gp1', placeName: 'Bright Minds Tuition', endsAt: 10, asPlace: true,
    })
    expect(pin).toMatchObject({ postedAs: 'place', type: 'offer', endsAt: 10 })
  })
})

describe('pin photos (DECISIONS.md 2026-10-23)', () => {
  const jpeg = 'data:image/jpeg;base64,' + 'QUJD'.repeat(500)
  const photo = (uid: string, o: Record<string, unknown> = {}) => ({ pinId: 'p1', dataUrl: jpeg, deviceId: uid, createdAt: 1, ...o })
  const seedPin = (uid: string) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pins/p1'), { ...base(uid), hasPhoto: true })
    })

  it('createPinDoc posts the pin and its photo; anyone can read the photo', async () => {
    const db = env.authenticatedContext('u1').firestore() as unknown as Firestore
    const pin = await createPinDoc(db, 'u1', { type: 'civic', title: 'Broken bench in the garden', lat: 1, lng: 2, photo: jpeg })
    expect(pin.hasPhoto).toBe(true)
    const anon = env.unauthenticatedContext().firestore()
    const snap = await assertSucceeds(getDoc(doc(anon, `pinPhotos/${pin.id}`)))
    expect(snap.data()?.dataUrl).toBe(jpeg)
  })
  it("only the pin's poster adds its photo, once, and only a small JPEG", async () => {
    await seedPin('u1')
    const u2 = env.authenticatedContext('u2').firestore()
    await assertFails(setDoc(doc(u2, 'pinPhotos/p1'), photo('u2'))) // not their pin
    const u1 = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(u1, 'pinPhotos/p1'), photo('u1', { dataUrl: 'data:image/png;base64,QUJD' })))
    await assertFails(setDoc(doc(u1, 'pinPhotos/p1'), photo('u1', { dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(400_001) })))
    await assertFails(setDoc(doc(u1, 'pinPhotos/p1'), photo('u1', { extra: 1 })))
    await assertSucceeds(setDoc(doc(u1, 'pinPhotos/p1'), photo('u1')))
    await assertFails(setDoc(doc(u1, 'pinPhotos/p1'), photo('u1'))) // no replacing
  })
  it('hasPhoto must be a boolean on a new pin', async () => {
    const db = env.authenticatedContext('u1').firestore()
    await assertFails(setDoc(doc(db, 'pins/p9'), { ...base('u1'), hasPhoto: 'yes' }))
    await assertSucceeds(setDoc(doc(db, 'pins/p9'), { ...base('u1'), hasPhoto: true }))
  })
})

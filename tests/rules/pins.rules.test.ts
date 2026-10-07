// Phase 0 baseline rules test (lead). API: https://firebase.google.com/docs/rules/unit-tests
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { createPinDoc, toggleSupportTx } from '../../src/data/firestoreRepo'

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

// Phase 0 baseline rules test (lead). API: https://firebase.google.com/docs/rules/unit-tests
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'

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

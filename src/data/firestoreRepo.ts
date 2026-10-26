// Firestore + anonymous auth Repo. Written against firestore.rules (client may only create neighbour pins,
// supports have id `${pinId}_${uid}`, a pin update may only touch lastSupportAt).
// Docs: https://firebase.google.com/docs/firestore/query-data/listen (onSnapshot)
//       https://firebase.google.com/docs/firestore/manage-data/transactions (runTransaction)
//       https://firebase.google.com/docs/auth/web/anonymous-auth (signInAnonymously)
//       https://firebase.google.com/docs/emulator-suite/connect_firestore , connect_auth
//       https://firebase.google.com/docs/firestore/security/rules-query (comments: the query must match the read rule)
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import { checkNewPin } from '../lib/claims'
import { cleanCommentText } from '../lib/comments'
import { validPhoto } from '../lib/photo'
import { CLAIM_PRICE_USD, type Bounds, type Claim, type Comment, type NewClaim, type NewComment, type NewPin, type Pin, type Repo, type Support } from '../types'


export type FirestoreMode = 'emulator' | 'firebase'

export function createFirestoreRepo(mode: FirestoreMode): Repo {
  let app: FirebaseApp
  let db: Firestore
  let auth: Auth
  if (mode === 'emulator') {
    app = initializeApp({ projectId: 'demo-ptp', apiKey: 'demo-key' })
    db = getFirestore(app)
    auth = getAuth(app)
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  } else {
    const env = import.meta.env
    app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
    db = getFirestore(app)
    auth = getAuth(app)
  }

  let uidPromise: Promise<string> | null = null
  const uid = () =>
    (uidPromise ??= signInAnonymously(auth).then((c) => c.user.uid))

  return {
    async init() {
      return { deviceId: await uid() }
    },
    subscribePins(_bounds: Bounds | null, cb) {
      const q = query(collection(db, 'pins'), where('status', '==', 'active'))
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Pin, 'id'>), id: d.id }))))
    },
    subscribeSupports(cb) {
      return onSnapshot(collection(db, 'supports'), (snap) =>
        cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Support, 'id'>), id: d.id }))),
      )
    },
    async createPin(input: NewPin) {
      return createPinDoc(db, await uid(), input)
    },
    async toggleSupport(pinId: string) {
      return toggleSupportTx(db, await uid(), pinId)
    },
    subscribeComments(cb) {
      // Rules only let everyone read live comments, so the query must ask for exactly those.
      const q = query(collection(db, 'comments'), where('status', '==', 'live'))
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))))
    },
    async addComment(input: NewComment) {
      return createCommentDoc(db, await uid(), input)
    },
    subscribeClaims(cb) {
      return onSnapshot(collection(db, 'claims'), (snap) =>
        cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Claim, 'id'>), id: d.id }))),
      )
    },
    async claimPlace(input: NewClaim) {
      return createClaimDoc(db, await uid(), input)
    },
    async getPhoto(pinId: string) {
      const snap = await getDoc(doc(db, 'pinPhotos', pinId))
      return snap.exists() ? ((snap.data().dataUrl as string) ?? null) : null
    },
  }
}

/** Writes a comment with exactly the fields firestore.rules allows. Always "under_review". */
export async function createCommentDoc(db: Firestore, me: string, input: NewComment): Promise<Comment> {
  const ref = doc(collection(db, 'comments'))
  const data: Omit<Comment, 'id'> = {
    pinId: input.pinId,
    text: cleanCommentText(input.text),
    createdAt: Date.now(),
    deviceId: me,
    status: 'under_review',
  }
  await setDoc(ref, data)
  return { ...data, id: ref.id }
}


/**
 * Claim doc id = placeId, so a place can only be claimed once (a second write is an update, which the rules deny).
 * Always "pending": the team switches it to "active". Mock checkout: paid is set, no card is ever taken.
 */
export async function createClaimDoc(db: Firestore, me: string, input: NewClaim): Promise<Claim> {
  const ref = doc(db, 'claims', input.placeId)
  if ((await getDoc(ref)).exists()) throw new Error('this place is already claimed')
  const data: Omit<Claim, 'id'> = {
    placeId: input.placeId,
    placeName: input.placeName.trim(),
    deviceId: me,
    status: 'pending',
    plan: 'monthly',
    priceUsd: CLAIM_PRICE_USD,
    paid: true,
    createdAt: Date.now(),
  }
  await setDoc(ref, data)
  return { ...data, id: ref.id }
}

/** Writes a pin with exactly the fields firestore.rules allows (never undefined). Place posts need an active claim. */
export async function createPinDoc(db: Firestore, me: string, input: NewPin): Promise<Pin> {
  if (input.asPlace) {
    const claim = input.placeId ? await getDoc(doc(db, 'claims', input.placeId)) : null
    checkNewPin(input, me, claim?.exists() ? [{ ...(claim.data() as Omit<Claim, 'id'>), id: claim.id }] : [])
  } else checkNewPin(input, me, [])
  if (input.photo && !validPhoto(input.photo)) throw new Error('the photo is not a small JPEG')
  const ref = doc(collection(db, 'pins'))
  const data: Omit<Pin, 'id'> = {
    type: input.type,
    title: input.title,
    lat: input.lat,
    lng: input.lng,
    createdAt: Date.now(),
    createdBy: me,
    postedAs: input.asPlace ? 'place' : 'neighbour',
    status: 'active',
    ...(input.placeId ? { placeId: input.placeId } : {}),
    ...(input.placeName ? { placeName: input.placeName } : {}),
    ...(input.type === 'event' && input.startsAt != null ? { startsAt: input.startsAt } : {}),
    ...(input.type === 'offer' && input.endsAt != null ? { endsAt: input.endsAt } : {}),
    ...(input.photo ? { hasPhoto: true } : {}),
  }
  await setDoc(ref, data)
  // The photo lives on its own (pins are all read at once; photos only when a detail opens). Doc id = the pin's id.
  if (input.photo) await setDoc(doc(db, 'pinPhotos', ref.id), { pinId: ref.id, dataUrl: input.photo, deviceId: me, createdAt: data.createdAt })
  return { ...data, id: ref.id }
}

/** One support per device per pin: doc id `${pinId}_${uid}`; a second call removes it. */
export function toggleSupportTx(db: Firestore, me: string, pinId: string): Promise<{ supported: boolean }> {
  const sRef = doc(db, 'supports', `${pinId}_${me}`)
  const pRef = doc(db, 'pins', pinId)
  return runTransaction(db, async (tx) => {
    const existing = await tx.get(sRef)
    if (existing.exists()) {
      tx.delete(sRef)
      return { supported: false }
    }
    const now = Date.now()
    tx.set(sRef, { pinId, deviceId: me, createdAt: now })
    tx.update(pRef, { lastSupportAt: now })
    return { supported: true }
  })
}

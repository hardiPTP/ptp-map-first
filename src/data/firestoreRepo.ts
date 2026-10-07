// Firestore + anonymous auth Repo. Written against firestore.rules (client may only create neighbour pins,
// supports have id `${pinId}_${uid}`, a pin update may only touch lastSupportAt).
// Docs: https://firebase.google.com/docs/firestore/query-data/listen (onSnapshot)
//       https://firebase.google.com/docs/firestore/manage-data/transactions (runTransaction)
//       https://firebase.google.com/docs/auth/web/anonymous-auth (signInAnonymously)
//       https://firebase.google.com/docs/emulator-suite/connect_firestore , connect_auth
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { Bounds, NewPin, Pin, Repo, Support } from '../types'

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
  }
}


/** Writes a neighbour pin with exactly the fields firestore.rules allows (never undefined). */
export async function createPinDoc(db: Firestore, me: string, input: NewPin): Promise<Pin> {
  const ref = doc(collection(db, 'pins'))
  const data: Omit<Pin, 'id'> = {
    type: input.type,
    title: input.title,
    lat: input.lat,
    lng: input.lng,
    createdAt: Date.now(),
    createdBy: me,
    postedAs: 'neighbour',
    status: 'active',
    ...(input.placeId ? { placeId: input.placeId } : {}),
    ...(input.placeName ? { placeName: input.placeName } : {}),
    ...(input.type === 'event' && input.startsAt != null ? { startsAt: input.startsAt } : {}),
  }
  await setDoc(ref, data)
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

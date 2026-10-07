// Seed tool (agent C).
//   npm run seed                        -> build src/data/seed.generated.json, write to the Firestore emulator
//   npm run seed -- --target=prod       -> same, to the real project (human runs this; needs admin credentials)
//   npm run seed -- --target=none       -> only build the JSON
//   --now=<epoch ms>   fixed "now" (so two runs can be compared byte for byte)
//   --no-network       stub fetch so any Google call throws (proves a re-run is offline)
//   --dump=<file>      write the materialised docs to a JSON file
// Venues and streets come only from cached Places API (New) Text Search responses (scripts/.cache).
// Pin coordinates are a returned place's location or the street result's location, moved by a deterministic
// jitter of at most ~5 m (see jitter()) so pins on the same spot do not stack exactly.
import { writeFileSync } from 'node:fs'
import { materialise } from '../src/data/materialise.ts'
import type { SeedFile, SeedPin, SeedSupport, RelTime } from '../src/data/seedTypes.ts'
import { QUERIES, stats, textSearch } from './places-fetch.ts'

const args = new Map<string, string>(
  process.argv.slice(2).map((a) => {
    const [k, v = ''] = a.replace(/^--/, '').split('=')
    return [k, v]
  }),
)
if (args.has('no-network')) {
  globalThis.fetch = () => {
    throw new Error('network call attempted under --no-network')
  }
}

interface Place {
  id: string
  displayName: { text: string }
  location: { latitude: number; longitude: number }
}

const raw: Record<string, Place[]> = {}
for (const { slug, q, kind } of QUERIES) raw[slug] = (await textSearch(slug, q, kind)).places ?? []

function venue(slug: string, nameIncludes: string): Place {
  const p = raw[slug].find((x) => x.displayName.text.includes(nameIncludes))
  if (!p) throw new Error(`place not in cache: ${slug} / ${nameIncludes}`)
  return p
}
const street = (slug: string) => raw[`street-${slug}`][0]

// mulberry32: tiny seeded PRNG so output is identical on every run.
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/** Deterministic offset of at most 0.00005 deg (about 5 m) per axis, from the pin id. */
function jitter(id: string, p: Place) {
  const r = prng(hash(id))
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  return {
    lat: round(p.location.latitude + (r() - 0.5) * 0.0001),
    lng: round(p.location.longitude + (r() - 0.5) * 0.0001),
  }
}

type Spec = {
  id: string
  type: 'event' | 'civic' | 'ask' | 'area'
  title: string
  body: string
  at: Place
  /** Show the place name on the pin. Civic/ask/area on a street use the street result's id and name. */
  tag?: Place
  postedAs?: 'neighbour' | 'place' | 'ptp'
  createdAtMin: number
  startsAt?: RelTime
  endsAt?: RelTime
  endsAtOriginal?: RelTime
  radiusM?: number
  topic?: 'water' | 'power' | 'traffic' | 'road'
  /** [fresh supports (within 3 h), older supports (1 to 14 days)] */
  sup: [number, number]
}

const hill = street('hill-road'), linking = street('linking-road'), sv = street('sv-road')
const chapel = street('chapel-road'), carter = street('carter-road'), bandra = street('bandra-west')

const specs: Spec[] = [
  // ---- Events (12) ----
  { id: 'seed-event-01', type: 'event', postedAs: 'place', at: venue('yoga-studio', 'Diva Yoga'), title: 'Beginners yoga, bring your own mat',
    body: 'Gentle one hour class, no experience needed. Please come 10 minutes early to settle in.',
    createdAtMin: -2900, startsAt: { min: 90 }, endsAt: { min: 150 }, sup: [1, 5] },
  { id: 'seed-event-02', type: 'event', at: venue('community-hall', 'Pioneer Hall'), title: 'Carrom and chai evening for seniors',
    body: 'Boards are there, just walk in. Chai is on us, snacks if someone brings.',
    createdAtMin: -1500, startsAt: { min: 45 }, endsAt: { min: 165 }, sup: [2, 4] },
  { id: 'seed-event-03', type: 'event', postedAs: 'place', at: venue('library', 'Trilogy'), title: 'Story hour for children, ages 5 to 8',
    body: 'Read-aloud and a small craft. Parents can sit at the back or step out for a coffee.',
    createdAtMin: -4300, startsAt: { min: 110 }, endsAt: { min: 170 }, sup: [0, 6] },
  { id: 'seed-event-04', type: 'event', at: venue('garden', 'Central Garden'), title: 'Evening walk to Bandstand and back',
    body: 'Meeting at the garden gate, easy pace, about 45 minutes. All ages welcome.',
    createdAtMin: -600, startsAt: { min: 300 }, endsAt: { min: 350 }, sup: [1, 3] },
  { id: 'seed-event-05', type: 'event', at: venue('community-hall', 'KCA Hall'), title: 'Residents meet on water tanker timings',
    body: 'For the lanes behind Veronica Road. We will fix the tanker schedule and a simple rota.',
    createdAtMin: -1800, startsAt: { min: 420 }, endsAt: { min: 510 }, sup: [0, 7] },
  { id: 'seed-event-06', type: 'event', at: venue('garden', 'Guru Nanak Park'), title: 'Morning laughter club at the park',
    body: 'Free, open to everyone. Wear something comfortable, we finish by 7.30.',
    createdAtMin: -3000, startsAt: { day: 'tomorrow', h: 6, m: 30 }, endsAt: { day: 'tomorrow', h: 7, m: 30 }, sup: [0, 8] },
  { id: 'seed-event-07', type: 'event', at: venue('library', 'Sister Library'), title: 'Chess evening, all levels',
    body: 'Bring a board if you have one. We will pair people up on the day.',
    createdAtMin: -2100, startsAt: { day: 'tomorrow', h: 19 }, endsAt: { day: 'tomorrow', h: 21 }, sup: [0, 4] },
  { id: 'seed-event-08', type: 'event', at: venue('community-hall', 'KCA Hall'), title: 'Watercolour class for beginners',
    body: 'Paper and paints for the first class. Cost is shared among whoever comes.',
    createdAtMin: -5200, startsAt: { day: 'sat', h: 17 }, endsAt: { day: 'sat', h: 19 }, sup: [1, 9] },
  { id: 'seed-event-09', type: 'event', at: venue('garden', 'Rao Saheb Patwardhan'), title: 'Sapling planting and park clean-up',
    body: 'Gloves and saplings will be there. Bring a water bottle and a cap.',
    createdAtMin: -7000, startsAt: { day: 'sat', h: 9, m: 30 }, endsAt: { day: 'sat', h: 11, m: 30 }, sup: [0, 10] },
  { id: 'seed-event-10', type: 'event', at: carter, tag: carter, title: 'Sunday morning run along Carter Road',
    body: 'About 5 km at an easy pace, out and back. Nobody is left behind.',
    createdAtMin: -4000, startsAt: { day: 'sun', h: 6, m: 30 }, endsAt: { day: 'sun', h: 7, m: 45 }, sup: [0, 6] },
  { id: 'seed-event-11', type: 'event', postedAs: 'place', at: venue('library', 'Katrak Park'), title: 'Book swap, bring two and take two',
    body: 'Fiction, kids books and old magazines are all welcome. Please keep the books in readable condition.',
    createdAtMin: -3600, startsAt: { day: 'sun', h: 11 }, endsAt: { day: 'sun', h: 13 }, sup: [0, 5] },
  { id: 'seed-event-12', type: 'event', postedAs: 'place', at: venue('gymkhana', 'Bandra Gymkhana'), title: 'Open badminton trial class for children 8 to 12',
    body: 'Racquets are available. Please wear sports shoes and carry water.',
    createdAtMin: -6000, startsAt: { day: 'sun', h: 16 }, endsAt: { day: 'sun', h: 17, m: 30 }, sup: [0, 7] },

  // ---- Civic (10), ages 1 to 20 days ----
  { id: 'seed-civic-01', type: 'civic', at: venue('church-hall', "St. Andrew's Church"), tag: hill, title: 'Streetlight not working on Hill Road',
    body: 'The pole just before the church steps is dark after 7 pm. Very difficult for people walking home. Complained to the ward office once.',
    createdAtMin: -6 * 1440 - 130, sup: [0, 6] },
  { id: 'seed-civic-02', type: 'civic', at: venue('yoga-studio', 'Yoga Yuga'), tag: hill, title: 'Hawkers back on the footpath outside no. 100',
    body: 'Footpath is fully blocked again, people are walking on the road with the buses. It was clear for two weeks after the last drive.',
    createdAtMin: -1 * 1440 - 200, sup: [4, 5] },
  { id: 'seed-civic-03', type: 'civic', at: linking, tag: linking, title: 'Open drain cover near the bus stop',
    body: 'Cover is missing for three days now. Someone has put a stick in it. A child or a cyclist will fall in.',
    createdAtMin: -3 * 1440 - 60, sup: [3, 6] },
  { id: 'seed-civic-04', type: 'civic', at: venue('yoga-studio', 'Shivali'), tag: linking, title: 'Cars parked on the footpath every evening',
    body: 'From 6 pm to 10 pm the whole footpath near the corner is taken by cars. Old people have to walk on the road.',
    createdAtMin: -9 * 1440 - 300, sup: [0, 4] },
  { id: 'seed-civic-05', type: 'civic', at: sv, tag: sv, title: 'Garbage not cleared for two days',
    body: 'Bags are piled up next to the electric pole near the signal. Crows and stray dogs are spreading it on the road.',
    createdAtMin: -2 * 1440 - 20, sup: [3, 3] },
  { id: 'seed-civic-06', type: 'civic', at: venue('library', 'National Library'), tag: sv, title: 'Big pothole in the left lane of S.V. Road',
    body: 'Two wheelers swerve suddenly to avoid it. Gets worse after every rain.',
    createdAtMin: -14 * 1440 - 400, sup: [0, 8] },
  { id: 'seed-civic-07', type: 'civic', at: venue('church-hall', 'Mount Carmel'), tag: chapel, title: 'Tree branch hanging over the footpath',
    body: 'A big branch cracked in the last rain and is hanging low. Please get the garden department to cut it before it falls.',
    createdAtMin: -4 * 1440 - 250, sup: [1, 5] },
  { id: 'seed-civic-08', type: 'civic', at: chapel, tag: chapel, title: 'Water logging in the lane after evening rain',
    body: 'Takes hours to clear. The drain seems choked, cars are throwing water on the footpath.',
    createdAtMin: -20 * 1440 - 90, sup: [0, 3] },
  { id: 'seed-civic-09', type: 'civic', at: venue('library', 'Trilogy'), tag: carter, title: 'Streetlights off on the stretch before the promenade',
    body: 'Four poles in a row are dark. Joggers and dog walkers are using phone torches.',
    createdAtMin: -11 * 1440 - 40, sup: [3, 5] },
  { id: 'seed-civic-10', type: 'civic', at: carter, tag: carter, title: 'Broken tiles on the jogging path near the entrance',
    body: 'Two tiles are loose and sticking up. Almost tripped on it this morning.',
    createdAtMin: -17 * 1440 - 15, sup: [0, 4] },

  // ---- Asks (8) ----
  { id: 'seed-ask-01', type: 'ask', at: hill, tag: hill, title: 'Need someone to water plants for 3 days',
    body: 'Going out of town from Friday. About 12 pots on the balcony, key with the watchman.', createdAtMin: -200, sup: [1, 1] },
  { id: 'seed-ask-02', type: 'ask', at: chapel, tag: chapel, title: 'Looking for a good electrician for a fan and two switches',
    body: 'Anyone in the lane who has a reliable one? Please share the number on WhatsApp.', createdAtMin: -1100, sup: [0, 3] },
  { id: 'seed-ask-03', type: 'ask', at: venue('garden', 'Guru Nanak Park'), tag: venue('garden', 'Guru Nanak Park'), title: 'Lost grey cat with a white paw, answers to Moti',
    body: 'Last seen near the park gate yesterday evening. He is shy but will come if you call him.', createdAtMin: -60, sup: [2, 0] },
  { id: 'seed-ask-04', type: 'ask', at: linking, tag: linking, title: 'Can someone teach my mother to use UPI?',
    body: 'She is 72 and nervous about it. Happy to pay for your time, a 30 minute session is enough.', createdAtMin: -4000, sup: [0, 3] },
  { id: 'seed-ask-05', type: 'ask', at: sv, tag: sv, title: 'Need a cab share to the airport on Saturday 5 am',
    body: 'Going to Terminal 2 with two bags. Can split the fare.', createdAtMin: -700, sup: [0, 2] },
  { id: 'seed-ask-06', type: 'ask', at: bandra, tag: bandra, title: 'Does anyone have a ladder I can borrow on Sunday?',
    body: 'Need to change a tube light in the passage. Will return the same day.', createdAtMin: -2500, sup: [0, 2] },
  { id: 'seed-ask-07', type: 'ask', at: venue('library', 'Katrak Park'), tag: venue('library', 'Katrak Park'), title: 'Looking for a Marathi tutor for my 10 year old',
    body: 'Two evenings a week, at our home near the park. Retired teachers are most welcome.', createdAtMin: -2900, sup: [0, 4] },
  { id: 'seed-ask-08', type: 'ask', at: carter, tag: carter, title: 'Old newspapers and cartons to give away',
    body: 'About 30 kg, pick up from our gate any evening this week.', createdAtMin: -5600, sup: [0, 2] },

  // ---- Area updates by Push The Pin (2) ----
  { id: 'seed-area-01', type: 'area', postedAs: 'ptp', at: bandra, tag: bandra, topic: 'water', radiusM: 900, title: 'No water supply',
    body: 'Planned pipeline repair work. Please store water tonight.',
    createdAtMin: -300, startsAt: { day: 'tomorrow', h: 10 }, endsAt: { day: 'tomorrow', h: 18 }, endsAtOriginal: { day: 'tomorrow', h: 16 }, sup: [0, 0] },
  { id: 'seed-area-02', type: 'area', postedAs: 'ptp', at: hill, tag: hill, topic: 'power', radiusM: 600, title: 'Power cut',
    body: 'Maintenance work on the feeder line. Supply should be back this evening.',
    createdAtMin: -240, startsAt: { min: -90 }, endsAt: { min: 150 }, endsAtOriginal: { min: 150 }, sup: [0, 0] },
]

const DEVICES = Array.from({ length: 20 }, (_, i) => `seed-dev-${i + 1}`)
const pins: SeedPin[] = []
const supports: SeedSupport[] = []
for (const s of specs) {
  const { lat, lng } = jitter(s.id, s.at)
  const tag = s.tag ?? (s.postedAs === 'place' || s.type === 'event' ? s.at : undefined)
  pins.push({
    id: s.id,
    type: s.type,
    title: s.title,
    body: s.body,
    lat,
    lng,
    placeId: tag?.id ?? null,
    placeName: tag?.displayName.text ?? null,
    placePhotoUri: null, // Places returned no photos for these venues
    startsAt: s.startsAt ?? null,
    endsAt: s.endsAt ?? null,
    endsAtOriginal: s.endsAtOriginal ?? null,
    radiusM: s.radiusM ?? null,
    topic: s.topic ?? null,
    createdAtMin: s.createdAtMin,
    createdBy: 'seed',
    postedAs: s.postedAs ?? 'neighbour',
    status: 'active',
    seed: true,
  })
  const r = prng(hash(s.id + ':sup'))
  const order = [...DEVICES].sort(() => r() - 0.5)
  const [fresh, older] = s.sup
  for (let i = 0; i < fresh + older; i++) {
    const isFresh = i < fresh
    const min = isFresh ? -Math.round(10 + r() * 160) : -Math.round(200 + r() * (14 * 1440 - 200))
    supports.push({ pinId: s.id, deviceId: order[i], createdAtMin: min })
  }
}

const seedFile: SeedFile = {
  source: 'Places API (New) Text Search, cached in scripts/.cache. Times are offsets from now; see materialise.ts.',
  pins,
  supports,
}
writeFileSync('src/data/seed.generated.json', JSON.stringify(seedFile, null, 2) + '\n')

const now = args.has('now') ? Number(args.get('now')) : Date.now()
const { pins: mPins, supports: mSupports } = materialise(seedFile, now)
if (args.has('dump')) writeFileSync(args.get('dump') as string, JSON.stringify({ pins: mPins, supports: mSupports }, null, 2))

const target = args.get('target') ?? 'emulator'
if (target !== 'none') {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  if (target === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
    initializeApp({ projectId: 'demo-ptp' })
  } else if (target === 'prod') {
    if (!process.env.VITE_FIREBASE_PROJECT_ID) process.loadEnvFile('.env')
    initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID, credential: applicationDefault() })
  } else throw new Error(`unknown --target=${target}`)
  const db = getFirestore()
  // Remove earlier seed docs that are no longer in the seed, then upsert by deterministic id.
  const keepPins = new Set(mPins.map((p) => p.id))
  const keepSup = new Set(mSupports.map((s) => s.id))
  for (const d of (await db.collection('pins').where('seed', '==', true).get()).docs)
    if (!keepPins.has(d.id)) await d.ref.delete()
  for (const d of (await db.collection('supports').get()).docs)
    if (d.data().deviceId.startsWith('seed-dev-') && !keepSup.has(d.id)) await d.ref.delete()
  const batch = db.batch()
  for (const p of mPins) batch.set(db.collection('pins').doc(p.id), p)
  for (const s of mSupports) {
    const { id, ...rest } = s
    batch.set(db.collection('supports').doc(id), rest)
  }
  await batch.commit()
  console.log(`seeded ${mPins.length} pins and ${mSupports.length} supports to ${target}`)
}
console.log(`Google requests this run: ${stats.googleRequests}`)

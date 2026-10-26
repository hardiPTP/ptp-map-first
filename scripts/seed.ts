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
import type { SeedComment, SeedFile, SeedPin, SeedSupport, RelTime } from '../src/data/seedTypes.ts'
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
  createdAtMin?: number
  startsAt?: RelTime
  endsAt?: RelTime
  endsAtOriginal?: RelTime
  radiusM?: number
  topic?: 'water' | 'power' | 'traffic' | 'road' | 'festival'
  /** [fresh supports (within 3 h), older supports (1 to 14 days)] */
  sup: [number, number]
  createdAtIso?: string
  sourceUrl?: string
  sourceLabel?: string
  imageUrl?: string
}

const hill = street('hill-road'), linking = street('linking-road')
const chapel = street('chapel-road'), bandra = street('bandra-west')

const IST = (d: string) => ({ iso: `${d}:00+05:30` })
const AE = 'Listing on allevents.in'

const specs: Spec[] = [
  // ---- Real events, 8 to 18 Oct 2026, from public listings (docs/REAL_DATA.md). Curated by PTP. ----
  { id: 'real-event-01', imageUrl: 'https://cdn-az.allevents.in/events8/banners/7cd2a090-c157-11f1-aa7e-893ff00ac3f2-rimg-w1200-h600-dc080808-gmir.jpg?v=1791271692', type: 'event', postedAs: 'ptp', at: venue('v-chimbai', 'Chimbai'), title: 'Comedy open mic in Bandra',
    body: 'New comics trying out sets. 18 and over, carry a photo ID.', createdAtIso: '2026-10-03T11:00:00+05:30',
    startsAt: IST('2026-10-08T20:00'), endsAt: IST('2026-10-08T22:00'), sourceUrl: 'https://allevents.in/mumbai/comedy-open-mic-in-bandra/3900030647649338', sourceLabel: AE, sup: [0, 3] },
  { id: 'real-event-02', imageUrl: 'https://cdn-az.allevents.in/events1/banners/cc1793c0-bf42-11f1-8a18-b3e52d4bf2d6-rimg-w1200-h600-dc080808-gmir.jpg?v=1791042903', type: 'event', postedAs: 'ptp', at: venue('v-borabora', 'BORA'), title: 'Pink Moss live, the Bandra sessions',
    body: 'Live set on Waterfield Road. 21 and over, carry a photo ID.', createdAtIso: '2026-10-04T10:00:00+05:30',
    startsAt: IST('2026-10-09T21:00'), endsAt: IST('2026-10-09T23:30'), sourceUrl: 'https://allevents.in/mumbai/pink-moss-live-the-bandra-sessions/3900030747146456', sourceLabel: AE, sup: [0, 2] },
  { id: 'real-event-03', imageUrl: 'https://cdn-az.allevents.in/events6/banners/b9bf4330-be1b-11f1-b28b-87665100e36b-rimg-w1200-h600-dc080808-gmir.jpg?v=1790916171', type: 'event', postedAs: 'ptp', at: venue('v-kcc', 'Khar Comedy'), title: 'Stand-up Virgin with Kubbra Sait and Devanshi Shah',
    body: 'Stand-up at Khar Comedy Club, just past Bandra on Linking Road.', createdAtIso: '2026-10-02T10:00:00+05:30',
    startsAt: IST('2026-10-09T20:00'), endsAt: IST('2026-10-09T21:30'), sourceUrl: 'https://allevents.in/mumbai/stand-up-virgin-ft-kubbra-sait-and-devanshi-shah/3900030621039354', sourceLabel: AE, sup: [0, 1] },
  { id: 'real-event-04', imageUrl: 'https://media.assettype.com/homegrown%2F2026-09-17%2Fqn5slg6v%2FHomegrownFeaturedImages-4.png?w=1200&ar=40%3A21&auto=format%2Ccompress&ogImage=true&mode=crop&enlarge=true&overlay=false&overlay_position=bottom&overlay_width=100', type: 'event', postedAs: 'ptp', at: venue('v-corona', 'Corona'), title: 'SALT, a food and culture weekend',
    body: 'About 50 food and drink brands, tastings, masterclasses and music. Saturday and Sunday, noon to 10 pm. Rs 699, under 12s free with a paying adult.',
    createdAtIso: '2026-10-01T09:00:00+05:30', startsAt: IST('2026-10-10T12:00'), endsAt: IST('2026-10-11T22:00'),
    sourceUrl: 'https://homegrown.co.in/homegrown-explore/salt-goya-brings-the-best-of-indian-food-drinks-under-one-roof-this-october', sourceLabel: 'Reported by Homegrown and Time Out', sup: [1, 5] },
  { id: 'real-event-05', imageUrl: 'https://cdn-az.allevents.in/events2/banners/7113d8f3bbf0bab37bdfd218dc663541a7a388e9daf8f4118a5dd241e05bdeed-rimg-w1200-h800-dc98a8b8-gmir.jpg?v=1790877664', type: 'event', postedAs: 'ptp', at: venue('v-fort', 'Fort'), title: 'Hill sprints at Bandra Fort',
    body: 'Free early morning running session with Coach Poonam. Bring water.', createdAtIso: '2026-10-05T08:00:00+05:30',
    startsAt: IST('2026-10-11T06:00'), endsAt: IST('2026-10-11T08:00'), sourceUrl: 'https://allevents.in/mumbai/hill-sprints-with-coach-poonam/100002002712414744', sourceLabel: AE, sup: [0, 4] },
  { id: 'real-event-06', imageUrl: 'https://cdn-az.allevents.in/events1/banners/e2ffe6a0-bd9e-11f1-ad07-a917a2e98392-rimg-w1200-h600-dcf8f8c8-gmir.jpg?v=1790862553', type: 'event', postedAs: 'ptp', at: venue('v-kcc', 'Khar Comedy'), title: 'Duos with Prashasti Singh and Atul Khatri',
    body: 'Two comics, one stage. 18 and over.', createdAtIso: '2026-10-03T10:00:00+05:30',
    startsAt: IST('2026-10-11T20:00'), endsAt: IST('2026-10-11T21:30'), sourceUrl: 'https://allevents.in/mumbai/duos-ft-prashasti-singh-and-atul-khatri-kcc/3900030746586020', sourceLabel: AE, sup: [0, 1] },
  { id: 'real-event-07', imageUrl: 'https://cdn2.allevents.in/thumbs/thumb6ab37a06968c8.jpg', type: 'event', postedAs: 'ptp', at: venue('v-acropolis', 'Acropolis'), title: 'Free intro evening to a philosophy course',
    body: 'Orientation session at New Acropolis on 15th Road. Free, open to all adults.', createdAtIso: '2026-10-04T12:00:00+05:30',
    startsAt: IST('2026-10-13T19:30'), endsAt: IST('2026-10-13T21:30'), sourceUrl: 'https://allevents.in/mumbai/orientation-to-living-philosophy-course-an-invitation-to-a-school-of-philosophy-tickets/80002922315701', sourceLabel: AE, sup: [0, 2] },
  { id: 'real-event-08', imageUrl: 'https://cdn-az.allevents.in/events1/banners/d6d83030-c0d7-11f1-aa7e-893ff00ac3f2-rimg-w1200-h600-dcf8e8c8-gmir.jpg?v=1791216868', type: 'event', postedAs: 'ptp', at: venue('v-corona', 'Corona'), title: 'Bazaar and Beyond flea market, Oktoberfest edition',
    body: 'Lifestyle stalls, food and music, 3 pm to 11 pm. 18 and over.', createdAtIso: '2026-10-06T10:00:00+05:30',
    startsAt: IST('2026-10-17T15:00'), endsAt: IST('2026-10-17T23:00'), sourceUrl: 'https://allevents.in/mumbai/bazaar-and-beyond-oktoberfest-edition/3900030781608228', sourceLabel: AE, sup: [0, 2] },
  { id: 'real-event-09', imageUrl: 'https://cdn-az.allevents.in/events8/banners/d41ed100-bbff-11f1-9913-21574437e213-rimg-w1200-h600-dc080808-gmir.jpg?v=1790684304', type: 'event', postedAs: 'ptp', at: venue('v-balgandharva', 'Gandharva'), title: 'Allow Me!, stand-up by Rahul Dua',
    body: 'Stand-up show, 16 and over.', createdAtIso: '2026-10-01T10:00:00+05:30',
    startsAt: IST('2026-10-17T19:00'), endsAt: IST('2026-10-17T20:30'), sourceUrl: 'https://allevents.in/mumbai/allow-me-a-standup-comedy-show-by-rahul-dua/3900030387701608', sourceLabel: AE, sup: [0, 1] },
  { id: 'real-event-10', imageUrl: 'https://cdn-az.allevents.in/events7/banners/4492f770-be41-11f1-a0c5-ed8c5a3c0e2b-rimg-w1200-h600-dc882818-gmir.jpg?v=1790932295', type: 'event', postedAs: 'ptp', at: venue('v-kcc', 'Khar Comedy'), title: 'Out of Syllabus with Sapan Verma',
    body: 'Afternoon stand-up at Khar Comedy Club.', createdAtIso: '2026-10-05T10:00:00+05:30',
    startsAt: IST('2026-10-18T16:00'), endsAt: IST('2026-10-18T17:00'), sourceUrl: 'https://allevents.in/mumbai/out-of-syllabus-ft-sapan-verma-kcc/3900030762794136', sourceLabel: AE, sup: [0, 1] },

  // ---- Real civic issues from news reports. Curated by PTP. ----
  { id: 'real-civic-01', imageUrl: 'https://www.constructionworld.in/assets/uploads/img_38961_1787810202.webp', type: 'civic', postedAs: 'ptp', at: hill, tag: hill, title: 'Hawkers and stalls blocking the Hill Road footpath',
    body: 'Residents complained to the ward. H-West officials inspected and said notices would go out to encroachers within 15 days.',
    createdAtIso: '2026-08-27T10:00:00+05:30', sourceUrl: 'https://www.constructionworld.in/transport-infrastructure/highways-and-roads-infrastructure/bmc-removes-28-structures-and-targets-hill-road-encroachments/96430',
    sourceLabel: 'Reported by Construction World, 27 Aug', sup: [2, 7] },
  { id: 'real-civic-02', imageUrl: 'https://media.assettype.com/freepressjournal/2026-08-31/tsp972bu/Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Copy-of-Queen-Of-All-Mayhem-2026-08-31T215048.195.jpg', type: 'civic', postedAs: 'ptp', at: venue('garden', 'Patwardhan'), title: 'Patwardhan Park revamp still waiting for approval',
    body: 'BMC has proposed a Rs 5.1 crore facelift with new paths, toilets and play equipment. It awaits Standing Committee approval. Locals say regular upkeep is the real need.',
    createdAtIso: '2026-08-31T10:00:00+05:30', sourceUrl: 'https://www.freepressjournal.in/mumbai/mumbai-bmc-proposes-510-crore-facelift-for-bandras-patwardhan-park-excludes-underground-parking-plot',
    sourceLabel: 'Reported by Free Press Journal, 31 Aug', sup: [1, 4] },
  { id: 'real-civic-03', imageUrl: 'https://media.assettype.com/freepressjournal/2026-06-28/nj1rofgv/Untitled-design-16.png?rect=0%2C0%2C3900%2C2048&w=1200&auto=format%2Ccompress&ogImage=true', type: 'civic', postedAs: 'ptp', at: venue('v-reclamation', 'Neville'), title: 'Plan to turn the Reclamation football ground into a convention centre',
    body: 'BMC has proposed converting the ground. Players and local representatives have protested.',
    createdAtIso: '2026-06-28T10:00:00+05:30', sourceUrl: 'https://www.freepressjournal.in/amp/mumbai/bandra-reclamation-football-ground-conversion-plan-faces-opposition-from-mp-varsha-gaikwad-protesters-video',
    sourceLabel: 'Reported by Free Press Journal, 28 Jun', sup: [1, 5] },

  // ---- A few neighbour posts (demo content, marked seed) ----
  { id: 'seed-civic-01', type: 'civic', at: venue('church-hall', "St. Andrew's Church"), tag: hill, title: 'Streetlight out before the church steps',
    body: 'The pole just before the steps is dark after 7 pm. Hard for people walking home.', createdAtMin: -3 * 1440 - 130, sup: [1, 2] },
  // A second neighbour reporting the same streetlight at the same spot: the map merges it into seed-civic-01 ("+1").
  { id: 'seed-civic-03', type: 'civic', at: venue('church-hall', "St. Andrew's Church"), tag: hill, title: 'Light at the church steps not working',
    body: 'Third night in a row. The steps are hard to see.', createdAtMin: -1 * 1440 - 300, sup: [0, 1] },
  { id: 'seed-civic-02', type: 'civic', at: linking, tag: linking, title: 'Drain cover missing near the bus stop',
    body: 'Someone has put a stick in it for now. A cyclist could go in.', createdAtMin: -1 * 1440 - 60, sup: [2, 1] },
  { id: 'seed-ask-01', type: 'ask', at: hill, tag: hill, title: 'Someone to water my plants for 3 days?',
    body: 'Going out of town from Friday. About 12 pots, key with the watchman.', createdAtMin: -200, sup: [0, 0] },
  { id: 'seed-ask-02', type: 'ask', at: chapel, tag: chapel, title: 'Reliable electrician for a fan and two switches?',
    body: 'Please share a number on WhatsApp if you know one.', createdAtMin: -1100, sup: [1, 0] },
  { id: 'seed-ask-03', type: 'ask', at: linking, tag: linking, title: 'Can someone help my mother set up UPI?',
    body: 'She is 72 and nervous about it. Happy to pay for half an hour of your time.', createdAtMin: -2600, sup: [0, 2] },

  // ---- Notice by Push The Pin (real date) ----
  { id: 'real-area-01', type: 'area', postedAs: 'ptp', at: bandra, tag: bandra, topic: 'festival', radiusM: 6000, title: 'Navratri',
    body: 'Sharad Navratri runs Sunday 11 to Monday 19 October, Dussehra on 20 October. Expect garba nights and busier evenings.',
    createdAtIso: '2026-10-06T09:00:00+05:30', startsAt: IST('2026-10-11T00:00'), endsAt: IST('2026-10-19T23:59'),
    sourceUrl: 'https://gulfnews.com/lifestyle/when-is-navratri-2026-and-what-colour-to-wear-each-day-1.500693264', sourceLabel: 'Festival dates', sup: [0, 0] },
]

// ---- Neighbour comments on the demo neighbour posts only (never on real reported items), status live ----
const comments: SeedComment[] = [
  { id: 'seed-cmt-01', pinId: 'seed-civic-01', deviceId: 'seed-dev-3', createdAtMin: -40, text: 'Still dark last night. I used my phone torch on the steps.' },
  { id: 'seed-cmt-02', pinId: 'seed-civic-01', deviceId: 'seed-dev-8', createdAtMin: -1500, text: 'Told the ward office too, no reply yet.' },
  { id: 'seed-cmt-07', pinId: 'seed-civic-01', deviceId: 'seed-dev-12', createdAtMin: -600, text: 'Two lights out near the bus stop as well, not just the one.' },
  { id: 'seed-cmt-03', pinId: 'seed-civic-02', deviceId: 'seed-dev-5', createdAtMin: -95, text: 'Someone put a crate over it this morning. Still not safe for bikes.' },
  { id: 'seed-cmt-04', pinId: 'seed-ask-01', deviceId: 'seed-dev-11', createdAtMin: -70, text: "I'm two buildings down and free from Friday. Will message you." },
  { id: 'seed-cmt-05', pinId: 'seed-ask-02', deviceId: 'seed-dev-14', createdAtMin: -300, text: 'The electrical shop by the market sends someone the same day. Ask at the counter.' },
  { id: 'seed-cmt-06', pinId: 'seed-ask-03', deviceId: 'seed-dev-17', createdAtMin: -180, text: 'Happy to help on Sunday morning, no charge. My father needed two tries too.' },
]

const DEVICES = Array.from({ length: 20 }, (_, i) => `seed-dev-${i + 1}`)
const pins: SeedPin[] = []
const supports: SeedSupport[] = []
for (const s of specs) {
  const { lat, lng } = jitter(s.id, s.at)
  const tag = s.tag ?? ((s.postedAs ?? 'neighbour') !== 'neighbour' || s.type === 'event' ? s.at : undefined)
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
    createdAtMin: s.createdAtMin ?? 0,
    createdAtIso: s.createdAtIso ?? null,
    sourceUrl: s.sourceUrl ?? null,
    sourceLabel: s.sourceLabel ?? null,
    imageUrl: s.imageUrl ?? null,
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
  source: 'Places API (New) Text Search, cached in scripts/.cache. Real items carry fixed ISO times and sourceUrl (docs/REAL_DATA.md); demo neighbour posts use offsets from now.',
  pins,
  supports,
  comments,
}
writeFileSync('src/data/seed.generated.json', JSON.stringify(seedFile, null, 2) + '\n')

const now = args.has('now') ? Number(args.get('now')) : Date.now()
const { pins: mPins, supports: mSupports, comments: mComments } = materialise(seedFile, now)
if (args.has('dump'))
  writeFileSync(args.get('dump') as string, JSON.stringify({ pins: mPins, supports: mSupports, comments: mComments }, null, 2))

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
  const keepCmt = new Set(mComments.map((c) => c.id))
  for (const d of (await db.collection('comments').where('seed', '==', true).get()).docs)
    if (!keepCmt.has(d.id)) await d.ref.delete()
  const batch = db.batch()
  for (const p of mPins) batch.set(db.collection('pins').doc(p.id), p)
  for (const s of mSupports) {
    const { id, ...rest } = s
    batch.set(db.collection('supports').doc(id), rest)
  }
  for (const c of mComments) {
    const { id, ...rest } = c
    batch.set(db.collection('comments').doc(id), rest)
  }
  await batch.commit()
  console.log(`seeded ${mPins.length} pins, ${mSupports.length} supports and ${mComments.length} comments to ${target}`)
}
console.log(`Google requests this run: ${stats.googleRequests}`)

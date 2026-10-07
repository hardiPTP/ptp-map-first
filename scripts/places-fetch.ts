// Part of agent C's seed tooling (imported by scripts/seed.ts). Places API (New) Text Search, cached.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
// Photos: places.photos was requested but Google returned none for these venues (see scripts/.cache), so placePhotoUri stays null.
// Every raw response is cached in scripts/.cache/<slug>.json; a cached slug is never fetched again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export const CACHE_DIR = 'scripts/.cache'
export const stats = { googleRequests: 0 }

export const QUERIES: { slug: string; q: string; kind: 'venue' | 'street' }[] = [
  { slug: 'community-hall', q: 'community hall Bandra West Mumbai', kind: 'venue' },
  { slug: 'garden', q: 'garden Bandra West Mumbai', kind: 'venue' },
  { slug: 'gymkhana', q: 'gymkhana Bandra West Mumbai', kind: 'venue' },
  { slug: 'church-hall', q: 'church hall Bandra West Mumbai', kind: 'venue' },
  { slug: 'yoga-studio', q: 'yoga studio Bandra West Mumbai', kind: 'venue' },
  { slug: 'library', q: 'library Bandra West Mumbai', kind: 'venue' },
  { slug: 'street-hill-road', q: 'Hill Road, Bandra West, Mumbai', kind: 'street' },
  { slug: 'street-linking-road', q: 'Linking Road, Bandra West, Mumbai', kind: 'street' },
  { slug: 'street-sv-road', q: 'S.V. Road, Bandra West, Mumbai', kind: 'street' },
  { slug: 'street-chapel-road', q: 'Chapel Road, Bandra West, Mumbai', kind: 'street' },
  { slug: 'street-carter-road', q: 'Carter Road, Bandra West, Mumbai', kind: 'street' },
  { slug: 'street-bandra-west', q: 'Bandra West, Mumbai', kind: 'street' },
  // Real venues of the researched listings (docs/REAL_DATA.md)
  { slug: 'v-chimbai', q: 'Chimbai Village Theatre, Chimbai, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-borabora', q: 'Bora Bora, Waterfield Road, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-corona', q: 'Corona Garden, St John Baptist Road, Mount Mary, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-fort', q: 'Bandra Fort, Bandstand, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-acropolis', q: 'New Acropolis, 15th Road, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-balgandharva', q: 'Bal Gandharva Rang Mandir, Bandra West, Mumbai', kind: 'venue' },
  { slug: 'v-kcc', q: 'Khar Comedy Club, Linking Road, Khar West, Mumbai', kind: 'venue' },
  { slug: 'v-reclamation', q: 'Bandra Reclamation football ground, Bandra West, Mumbai', kind: 'venue' },
]

const CENTER = { latitude: 19.0596, longitude: 72.8295 }
const FIELDS =
  'places.id,places.displayName,places.location,places.formattedAddress,places.shortFormattedAddress,places.types,places.photos'

function loadKey(): string {
  if (!process.env.VITE_GOOGLE_MAPS_API_KEY) process.loadEnvFile('.env')
  const k = process.env.VITE_GOOGLE_MAPS_API_KEY
  if (!k) throw new Error('VITE_GOOGLE_MAPS_API_KEY missing in .env')
  return k
}

async function post(url: string, init: RequestInit, key: string, referer: boolean): Promise<Response> {
  stats.googleRequests++
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>), 'X-Goog-Api-Key': key }
  if (referer) headers.Referer = 'http://localhost:5173/'
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(30000) })
}

function errSummary(body: string): string {
  try {
    const e = JSON.parse(body).error
    return `${e.code} ${e.status}: ${String(e.message).replace(/AIza[\w-]+/g, '<key>')}`
  } catch {
    return body.slice(0, 200).replace(/AIza[\w-]+/g, '<key>')
  }
}

let useReferer = false

/** Cached Text Search. Returns the raw cached response. */
export async function textSearch(slug: string, q: string, kind: 'venue' | 'street') {
  const file = `${CACHE_DIR}/${slug}.json`
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  mkdirSync(CACHE_DIR, { recursive: true })
  const key = loadKey()
  // locationRestriction takes a rectangle only; this one is the centre +-0.02 lat / +-0.018 lng.
  const body: Record<string, unknown> = { textQuery: q, pageSize: kind === 'venue' ? 8 : 6 }
  body.locationBias = { circle: { center: CENTER, radius: 2500 } }
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
  }
  let res = await post('https://places.googleapis.com/v1/places:searchText', init, key, useReferer)
  if (!res.ok && !useReferer) {
    const t = await res.text()
    if (/referer/i.test(t)) {
      useReferer = true
      res = await post('https://places.googleapis.com/v1/places:searchText', init, key, true)
    } else throw new Error('Places Text Search failed: ' + errSummary(t))
  }
  if (!res.ok) throw new Error('Places Text Search failed: ' + errSummary(await res.text()))
  const json = await res.json()
  writeFileSync(file, JSON.stringify(json, null, 2))
  return json
}


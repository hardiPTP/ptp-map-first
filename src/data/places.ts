// Real places around a point, from Google Places (New) Nearby Search via the Maps JavaScript API.
// Docs: https://developers.google.com/maps/documentation/javascript/nearby-search
//       https://developers.google.com/maps/documentation/javascript/reference/place (field names)
// Three calls per centre (food, daily needs, outdoors and community), cached on the device for 12 hours so a
// normal day of use costs at most a handful of requests against the Maps Demo Key's daily cap.
// Place.isOpen() is beta-only, so "open now" is computed here from regularOpeningHours.periods in IST.
import type { LatLng, NearbyPlace } from '../types'

export const PLACES_RADIUS_M = 800 // the 10 minute walk ring
const TTL_MS = 12 * 60 * 60 * 1000
const CACHE_KEY = 'ptp.places.v1'

const GROUPS: string[][] = [
  ['restaurant', 'cafe', 'bakery'],
  ['pharmacy', 'supermarket', 'grocery_store'],
  ['park', 'library', 'church', 'hindu_temple', 'mosque', 'gym', 'art_gallery'],
]
const FIELDS = ['id', 'displayName', 'location', 'primaryTypeDisplayName', 'regularOpeningHours', 'businessStatus']

interface Point { day: number; hour: number; minute: number }
interface Period { open: Point; close?: Point | null }

/** Minutes since Sunday 00:00 in IST for an epoch ms. India has no DST. */
function istWeekMinute(now: number): number {
  const ist = new Date(now + 330 * 60_000)
  return ist.getUTCDay() * 1440 + ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

/** Open at `now`? null when Google has no hours. A period with no close is open 24 hours. */
export function openAt(periods: Period[] | null | undefined, now: number): boolean | null {
  if (!periods || periods.length === 0) return null
  const t = istWeekMinute(now)
  const WEEK = 7 * 1440
  for (const p of periods) {
    if (!p.close) return true
    const a = p.open.day * 1440 + p.open.hour * 60 + p.open.minute
    let b = p.close.day * 1440 + p.close.hour * 60 + p.close.minute
    if (b <= a) b += WEEK
    if ((t >= a && t < b) || (t + WEEK >= a && t + WEEK < b)) return true
  }
  return false
}

type Cached = { at: number; key: string; places: (Omit<NearbyPlace, 'openNow'> & { periods: Period[] | null })[] }

const keyFor = (c: LatLng) => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`

function readCache(c: LatLng): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Cached
    return v.key === keyFor(c) && Date.now() - v.at < TTL_MS ? v : null
  } catch {
    return null
  }
}

function writeCache(v: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v))
  } catch {
    /* storage full or blocked: fine, we just fetch again next time */
  }
}

let inFlight: Promise<Cached['places']> | null = null

async function fetchAround(center: LatLng): Promise<Cached['places']> {
  const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const results = await Promise.all(
    GROUPS.map((types) =>
      Place.searchNearby({
        fields: FIELDS,
        locationRestriction: { center, radius: PLACES_RADIUS_M },
        includedPrimaryTypes: types,
        maxResultCount: 20,
        rankPreference: SearchNearbyRankPreference.POPULARITY,
      }).then((r) => r.places, () => [] as google.maps.places.Place[]),
    ),
  )
  const seen = new Set<string>()
  const out: Cached['places'] = []
  for (const p of results.flat()) {
    if (!p.location || seen.has(p.id)) continue
    if (p.businessStatus && String(p.businessStatus) !== 'OPERATIONAL') continue
    seen.add(p.id)
    const periods = (p.regularOpeningHours?.periods ?? null) as unknown as Period[] | null
    out.push({
      id: p.id,
      name: p.displayName ?? 'Place',
      lat: p.location.lat(),
      lng: p.location.lng(),
      kind: p.primaryTypeDisplayName ?? null,
      periods,
    })
  }
  return out
}

/** Places within the walk radius of `center`, cached 12 h per centre. Never throws: returns [] on failure. */
export async function nearbyPlaces(center: LatLng, now = Date.now()): Promise<NearbyPlace[]> {
  const hit = readCache(center)
  let list = hit?.places
  if (!list) {
    inFlight ??= fetchAround(center).finally(() => (inFlight = null))
    try {
      list = await inFlight
    } catch {
      return []
    }
    if (list.length) writeCache({ at: Date.now(), key: keyFor(center), places: list })
  }
  return list.map(({ periods, ...p }) => ({ ...p, openNow: openAt(periods, now) }))
}

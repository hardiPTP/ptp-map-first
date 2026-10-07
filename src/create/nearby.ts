// Nearest Google place for a spot. One call per lookup; callers decide when (map idle only, debounced).
// Place.searchNearby: https://developers.google.com/maps/documentation/javascript/nearby-search
// Request: fields + locationRestriction {center, radius} + maxResultCount + rankPreference
// (SearchNearbyRankPreference.DISTANCE). Returns { places }; each Place has id, displayName, location.
import { distanceM } from '../lib/geo'
import type { LatLng } from '../types'

export const NEARBY_RADIUS_M = 75
export const MIN_MOVE_M = 10
export const LOOKUP_DEBOUNCE_MS = 600

export interface NearbyPlace {
  placeId: string
  placeName: string
}

type PlacesLib = Pick<typeof google.maps.places, 'Place' | 'SearchNearbyRankPreference'>

export async function lookupNearest(lib: PlacesLib, at: LatLng): Promise<NearbyPlace | null> {
  try {
    const { places } = await lib.Place.searchNearby({
      fields: ['id', 'displayName'],
      locationRestriction: { center: at, radius: NEARBY_RADIUS_M },
      maxResultCount: 1,
      rankPreference: lib.SearchNearbyRankPreference.DISTANCE,
    })
    const p = places[0]
    if (!p?.id || !p.displayName) return null
    return { placeId: p.id, placeName: p.displayName }
  } catch {
    return null
  }
}

/** True when the centre moved far enough since the last lookup to be worth another call. */
export function movedEnough(last: LatLng | null, now: LatLng): boolean {
  return !last || distanceM(last, now) >= MIN_MOVE_M
}

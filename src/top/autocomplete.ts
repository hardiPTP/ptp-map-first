// Google Places Autocomplete (New), JS API. One session token per search session.
// Docs: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
// Reference: https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data
// "A session is concluded when fetchFields() is called"; the token is passed automatically from toPlace().
import { BANDRA_WEST } from '../store'
import type { LatLng } from '../types'

export const MIN_CHARS = 3
export const DEBOUNCE_MS = 300
export const BIAS_RADIUS_M = 3000

export interface PlaceSuggestion {
  placeId: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

type PlacesLib = Pick<typeof google.maps.places, 'AutocompleteSuggestion' | 'AutocompleteSessionToken'>

/** Owns the session token. Create on first request of a search, discard on selection, clear or close. */
export class SearchSession {
  private token: google.maps.places.AutocompleteSessionToken | null = null
  private lib: PlacesLib
  constructor(lib: PlacesLib) {
    this.lib = lib
  }

  async suggest(input: string): Promise<PlaceSuggestion[]> {
    const q = input.trim()
    if (q.length < MIN_CHARS) return []
    if (!this.token) this.token = new this.lib.AutocompleteSessionToken()
    const { suggestions } = await this.lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: q,
      sessionToken: this.token,
      locationBias: { center: BANDRA_WEST, radius: BIAS_RADIUS_M },
      region: 'in',
    })
    const out: PlaceSuggestion[] = []
    for (const s of suggestions) {
      const p = s.placePrediction
      if (!p) continue
      out.push({
        placeId: p.placeId,
        main: p.mainText?.text ?? p.text.text,
        secondary: p.secondaryText?.text ?? '',
        prediction: p,
      })
    }
    return out
  }

  /** Resolves the chosen prediction. fetchFields ends the session, so the token is dropped. */
  async select(s: PlaceSuggestion): Promise<{ placeId: string; placeName: string; location: LatLng } | null> {
    const place = s.prediction.toPlace()
    this.token = null
    await place.fetchFields({ fields: ['displayName', 'location'] })
    if (!place.location) return null
    return {
      placeId: s.placeId,
      placeName: place.displayName ?? s.main,
      location: { lat: place.location.lat(), lng: place.location.lng() },
    }
  }

  /** Search cleared or closed: discard the token without a selection. */
  reset() {
    this.token = null
  }
  get hasToken() {
    return this.token !== null
  }
}

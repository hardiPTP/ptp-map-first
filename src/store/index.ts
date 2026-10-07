// Frozen store API (Phase 0). Agents read/write through these actions only.
// Change requests go to the lead.
import { create } from 'zustand'
import type { Bounds, Filter, LatLng, Pin, SheetHeight, Support } from '../types'

/** Bandra West (Ward H-West). Centre given in docs/IMPLEMENTATION.md Gate 0. */
export const BANDRA_WEST: LatLng = { lat: 19.0596, lng: 72.8295 }
export const AREA_NAME = 'Bandra West'
export const DEFAULT_ZOOM = 15

export type LocationStatus = 'unknown' | 'prompting' | 'granted' | 'denied'
/** "area" = the masthead area (Bandra West); "nearMe" = user location. */
export type AreaMode = 'area' | 'nearMe'

export interface Viewport {
  bounds: Bounds | null
  zoom: number
  /** Centre of the VISIBLE map band (between top bar and sheet), not the map's geometric centre. */
  center: LatLng
}

/** A one-shot camera command for the map. nonce changes on every request so repeats still fire. */
export interface FlyTo extends LatLng {
  zoom?: number
  nonce: number
}

export type CreateStep = 'idle' | 'placing' | 'details'
export interface CreateState {
  step: CreateStep
  /** Chosen spot (set on "Use this spot" or long-press). */
  at: LatLng | null
  placeId: string | null
  placeName: string | null
}

/** A Google place picked in search: the sheet lists pins at this placeId. */
export interface SearchPlace {
  placeId: string
  placeName: string
}

export interface AppState {
  // data (filled by the repo subscription in app/)
  pins: Pin[]
  supports: Support[]
  deviceId: string | null

  // filters and selection
  filter: Filter
  selectedPinId: string | null
  /** Pin matching the card currently in view while scrolling the feed. Highlight only, never moves the map. */
  highlightedPinId: string | null
  selectedAreaId: string | null
  searchPlace: SearchPlace | null
  detailPinId: string | null

  // layout
  sheetHeight: SheetHeight
  viewport: Viewport
  flyTo: FlyTo | null

  // location
  areaMode: AreaMode
  userLocation: LatLng | null
  locationStatus: LocationStatus

  // creation
  create: CreateState

  // actions
  setPins(pins: Pin[]): void
  setSupports(supports: Support[]): void
  setDeviceId(id: string): void
  setFilter(f: Filter): void
  /** Select a pin. fly=true (card tap) also flies the map to it. */
  selectPin(id: string | null, opts?: { fly?: boolean }): void
  highlightPin(id: string | null): void
  selectArea(id: string | null): void
  setSearchPlace(p: SearchPlace | null): void
  openDetail(id: string | null): void
  setSheetHeight(h: SheetHeight): void
  /** Called by the map on idle only. */
  setViewport(v: Viewport): void
  requestFlyTo(target: LatLng & { zoom?: number }): void
  setAreaMode(m: AreaMode): void
  setUserLocation(l: LatLng | null): void
  setLocationStatus(s: LocationStatus): void
  /** "+ Pin": enter placing mode. Long-press: pass `at` and skipToDetails=true. */
  startCreate(opts?: { at?: LatLng; skipToDetails?: boolean }): void
  /** "Use this spot" */
  confirmSpot(at: LatLng, place: { placeId: string | null; placeName: string | null }): void
  cancelCreate(): void
}


let nonce = 0
const idleCreate: CreateState = { step: 'idle', at: null, placeId: null, placeName: null }

export const useStore = create<AppState>()((set, get) => ({
  pins: [],
  supports: [],
  deviceId: null,

  filter: 'all',
  selectedPinId: null,
  highlightedPinId: null,
  selectedAreaId: null,
  searchPlace: null,
  detailPinId: null,

  sheetHeight: 'half',
  viewport: { bounds: null, zoom: DEFAULT_ZOOM, center: BANDRA_WEST },
  flyTo: null,

  areaMode: 'area',
  userLocation: null,
  locationStatus: 'unknown',

  create: idleCreate,

  setPins: (pins) => set({ pins }),
  setSupports: (supports) => set({ supports }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setFilter: (filter) => set({ filter }),
  selectPin: (id, opts) => {
    set({ selectedPinId: id })
    if (id && opts?.fly) {
      const pin = get().pins.find((p) => p.id === id)
      if (pin) get().requestFlyTo({ lat: pin.lat, lng: pin.lng })
    }
  },
  highlightPin: (highlightedPinId) => set({ highlightedPinId }),
  selectArea: (selectedAreaId) => set({ selectedAreaId }),
  setSearchPlace: (searchPlace) => set({ searchPlace }),
  openDetail: (detailPinId) => set({ detailPinId }),
  setSheetHeight: (sheetHeight) => set({ sheetHeight }),
  setViewport: (viewport) => set({ viewport }),
  requestFlyTo: (target) => set({ flyTo: { ...target, nonce: ++nonce } }),
  setAreaMode: (areaMode) => set({ areaMode }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
  startCreate: (opts) =>
    set({
      create: {
        step: opts?.skipToDetails ? 'details' : 'placing',
        at: opts?.at ?? null,
        placeId: null,
        placeName: null,
      },
    }),
  confirmSpot: (at, place) => set({ create: { step: 'details', at, ...place } }),
  cancelCreate: () => set({ create: idleCreate }),
}))

// Markers for Map Mode B (no Map ID): one OverlayView + React portal. Look: Figma pin/map (docs/figma/SPEC.md).
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../design/primitives'
import { isPulsing } from '../lib/pulse'
import { nearbyPlaces } from '../data/places'
import { BANDRA_WEST, useStore } from '../store'
import type { NearbyPlace } from '../types'
import type { Pin } from '../types'
import { clusterPins, type Cluster } from './cluster'
import { createMarkerOverlay, type MarkerOverlay } from './overlay'
import { useLongPress } from './useLongPress'
import { useVisiblePins } from './visible'
import './map.css'

const clock = () => Date.now()

function Glyph({ pin }: { pin: Pin }) {
  if (pin.type === 'civic') return <Icon name="pin-icon-warning" size={16} tint={false} />
  if (pin.type === 'event') return <Icon name="pin-icon-calendar" size={16} tint={false} />
  return <Icon name="ic-bubble" size={16} />
}

function PinMarker({ pin, selected, pulse }: { pin: Pin; selected: boolean; pulse: boolean }) {
  const select = () => {
    const s = useStore.getState()
    s.selectPin(pin.id)
    s.openDetail(pin.id)
  }
  const cls = ['map-mk', `map-mk--${pin.type}`, selected && 'is-selected', pin.postedAs === 'place' && 'is-place']
    .filter(Boolean)
    .join(' ')
  return (
    <div className="map-anchor" data-lat={pin.lat} data-lng={pin.lng} style={{ zIndex: selected ? 3 : 2 }}>
      <button type="button" className={cls} aria-label={pin.title} aria-pressed={selected} onClick={select}>
        {selected && <span className="map-mk__halo" />}
        {pulse && <span className="map-mk__pulse" />}
        <span className="map-mk__stalk" />
        <span className="map-mk__tip" />
        <span className="map-mk__disc">
          <Glyph pin={pin} />
        </span>
      </button>
    </div>
  )
}

/** Real Google places: quiet ink dots (context, not content). Names show close in, or when the Places chip is on. */
function PlaceDot({ place, labelled, selected }: { place: NearbyPlace; labelled: boolean; selected: boolean }) {
  const pick = () => {
    const s = useStore.getState()
    s.setSearchPlace({ placeId: place.id, placeName: place.name })
    s.requestFlyTo({ lat: place.lat, lng: place.lng })
    if (s.sheetHeight === 'peek') s.setSheetHeight('half')
  }
  return (
    <div className="map-anchor" data-lat={place.lat} data-lng={place.lng} style={{ zIndex: selected ? 2 : 1 }}>
      <button
        type="button"
        className={['map-place', selected && 'is-selected'].filter(Boolean).join(' ')}
        aria-label={[place.name, place.kind].filter(Boolean).join(', ')}
        onClick={pick}
      >
        <span className="map-place__dot" />
        {(labelled || selected) && <span className="map-place__name">{place.name}</span>}
      </button>
    </div>
  )
}

/** Greedy declutter: at zoom 17 a cell is about 45 m tall and 130 m wide (one label line); halves per zoom step. */
export function labelPlaces(places: NearbyPlace[], zoom: number): Set<string> {
  const out = new Set<string>()
  if (zoom < 17) return out
  const k = 2 ** (zoom - 17)
  const cellLat = 0.0004 / k
  const cellLng = 0.0012 / k
  const taken = new Set<string>()
  for (const p of places) {
    const key = `${Math.floor(p.lat / cellLat)}:${Math.floor(p.lng / cellLng)}`
    if (taken.has(key)) continue
    taken.add(key)
    out.add(p.id)
  }
  return out
}

/** Loads real places once the Places library is ready, around the user or the area centre. Cached 12 h. */
function usePlaces() {
  const lib = useMapsLibrary('places')
  const userLocation = useStore((s) => s.userLocation)
  const areaMode = useStore((s) => s.areaMode)
  const center = areaMode === 'nearMe' && userLocation ? userLocation : BANDRA_WEST
  useEffect(() => {
    if (!lib) return
    let alive = true
    nearbyPlaces(center).then((list) => alive && useStore.getState().setPlaces(list))
    return () => {
      alive = false
    }
  }, [lib, center])
}

function ClusterMarker({ cluster, zoom }: { cluster: Cluster; zoom: number }) {
  return (
    <div className="map-anchor" data-lat={cluster.lat} data-lng={cluster.lng} style={{ zIndex: 2 }}>
      <button
        type="button"
        className="map-cluster"
        aria-label={`${cluster.count} pins, zoom in`}
        onClick={() => useStore.getState().requestFlyTo({ lat: cluster.lat, lng: cluster.lng, zoom: zoom + 2 })}
      >
        {cluster.count}
      </button>
    </div>
  )
}

function YouMarker({ at }: { at: { lat: number; lng: number } }) {
  return (
    <div className="map-anchor" data-lat={at.lat} data-lng={at.lng} style={{ zIndex: 1 }}>
      <span className="map-you">
        <Icon name="pin-you" size={44} tint={false} />
      </span>
    </div>
  )
}

export function Markers() {
  const map = useMap()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<MarkerOverlay | null>(null)
  const pins = useVisiblePins()
  const supports = useStore((s) => s.supports)
  const zoom = useStore((s) => s.viewport.zoom)
  const selectedId = useStore((s) => s.selectedPinId)
  const highlightId = useStore((s) => s.highlightedPinId)
  const userLocation = useStore((s) => s.userLocation)
  const places = useStore((s) => s.places)
  const filter = useStore((s) => s.filter)
  const pickedPlaceId = useStore((s) => s.searchPlace?.placeId ?? null)
  usePlaces()

  useEffect(() => {
    if (!map) return
    const o = createMarkerOverlay(map, setHost)
    overlayRef.current = o
    return () => {
      o.setMap(null)
      overlayRef.current = null
      setHost(null)
    }
  }, [map])

  useLongPress(map, overlayRef)

  const { singles, clusters } = useMemo(() => {
    const keep = new Set([selectedId, highlightId].filter((x): x is string => !!x))
    return clusterPins(pins, zoom, { keepSingle: keep })
  }, [pins, zoom, selectedId, highlightId])

  // Reposition anchors after every render (new markers have no transform yet).
  useLayoutEffect(() => {
    overlayRef.current?.draw()
  })

  // Place names only close in, and only one per screen cell so they never pile on top of each other.
  const labelled = useMemo(() => labelPlaces(places, zoom), [places, zoom])

  if (!host) return null
  const now = clock()
  return createPortal(
    <>
      {(zoom >= 16 || filter === 'places') &&
        places.map((pl) => (
          <PlaceDot key={pl.id} place={pl} selected={pl.id === pickedPlaceId} labelled={labelled.has(pl.id)} />
        ))}
      {clusters.map((c) => (
        <ClusterMarker key={c.id} cluster={c} zoom={zoom} />
      ))}
      {singles.map((p) => (
        <PinMarker
          key={p.id}
          pin={p}
          selected={p.id === selectedId || p.id === highlightId}
          pulse={isPulsing(p, supports, now)}
        />
      ))}
      {userLocation && <YouMarker at={userLocation} />}
    </>,
    host,
  )
}

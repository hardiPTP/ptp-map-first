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
import { revealOnFocus } from './reveal'
import { useLongPress } from './useLongPress'
import { useMapPins } from './visible'
import './map.css'

const clock = () => Date.now()

/** The glyph's meaning, spoken with the title (WCAG 1.1.1): the disc shape and symbol carry the type. */
const TYPE_WORD: Record<Pin['type'], string> = { civic: 'Issue', event: 'Event', ask: 'Ask', offer: 'Offer', area: 'Notice' }

/** Accessible name of a pin marker: type, title, then what the pulse ring and the merge say. */
export function markerLabel(pin: Pin, merged: number, pulse: boolean): string {
  const parts = [`${TYPE_WORD[pin.type]}: ${pin.title}`]
  if (pin.postedAs === 'place' && pin.placeName) parts.push(`posted by ${pin.placeName}`)
  if (merged) parts.push(`and ${merged} similar ${merged === 1 ? 'post' : 'posts'} here`)
  if (pulse) parts.push('recent activity')
  return parts.join(', ')
}

/** 12 px in the 24 disc, 16 in the selected 32 disc. Offers (a claimed place's deal): ic-heart, the nearest glyph. */
function Glyph({ pin, selected }: { pin: Pin; selected: boolean }) {
  const size = selected ? 16 : 12
  if (pin.type === 'civic') return <Icon name="pin-icon-warning" size={size} tint={false} />
  if (pin.type === 'event') return <Icon name="pin-icon-calendar" size={size} tint={false} />
  if (pin.type === 'offer') return <Icon name="ic-heart" size={size} />
  return <Icon name="ic-bubble" size={size} />
}

/**
 * `selected` is the selected or feed-highlighted pin (bigger disc). Only the truly selected pin is raised above
 * others (`raised`): the map layers decide which of two stacked pins carries words without following the feed
 * highlight, so the stacking order must not follow it either (lib/tags coveredPins).
 */
function PinMarker({ pin, selected, raised, pulse, merged }: { pin: Pin; selected: boolean; raised: boolean; pulse: boolean; merged: number }) {
  const select = () => {
    const s = useStore.getState()
    s.selectPin(pin.id)
    s.openDetail(pin.id)
  }
  const cls = ['map-mk', `map-mk--${pin.type}`, selected && 'is-selected', pin.postedAs === 'place' && 'is-place']
    .filter(Boolean)
    .join(' ')
  return (
    <div className="map-anchor" data-lat={pin.lat} data-lng={pin.lng} style={{ zIndex: raised ? 3 : 2 }}>
      <button
        type="button"
        className={cls}
        aria-label={markerLabel(pin, merged, pulse)}
        aria-haspopup="dialog"
        onClick={select}
        onFocus={(e) => revealOnFocus(e, pin)}
      >
        {selected && <span className="map-mk__halo" />}
        {pulse && <span className="map-mk__pulse" />}
        <span className="map-mk__disc">
          <Glyph pin={pin} selected={selected} />
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
        onFocus={(e) => revealOnFocus(e, place)}
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
        onFocus={(e) => revealOnFocus(e, cluster)}
      >
        {cluster.count}
      </button>
    </div>
  )
}

function YouMarker({ at }: { at: { lat: number; lng: number } }) {
  return (
    <div className="map-anchor" data-lat={at.lat} data-lng={at.lng} style={{ zIndex: 1 }}>
      <span className="map-you" role="img" aria-label="You are here">
        <Icon name="pin-you" size={44} tint={false} />
      </span>
    </div>
  )
}

export function Markers() {
  const map = useMap()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<MarkerOverlay | null>(null)
  const { pins, others } = useMapPins()
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

  // A feed card whose pin is merged into another lights up that group's marker.
  const lit = useMemo(() => {
    if (!highlightId || pins.some((p) => p.id === highlightId)) return highlightId
    for (const [lead, ids] of others) if (ids.includes(highlightId)) return lead
    return null
  }, [pins, others, highlightId])

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
          selected={p.id === selectedId || p.id === lit}
          raised={p.id === selectedId}
          merged={others.get(p.id)?.length ?? 0}
          pulse={isPulsing(p, supports, now)}
        />
      ))}
      {userLocation && <YouMarker at={userLocation} />}
    </>,
    host,
  )
}

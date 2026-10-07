// Markers for Map Mode B (no Map ID): one OverlayView + React portal. Look: Figma pin/map (docs/figma/SPEC.md).
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../design/primitives'
import { isPulsing } from '../lib/pulse'
import { useStore } from '../store'
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

  if (!host) return null
  const now = clock()
  return createPortal(
    <>
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

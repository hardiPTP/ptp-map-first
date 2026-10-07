// Public map API: <MapView />. No other code needs to know the map mode.
// @vis.gl/react-google-maps <Map>: https://visgl.github.io/react-google-maps/docs/api-reference/components/map
import { Map, useMap, type MapEvent } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import { BANDRA_WEST, DEFAULT_ZOOM, useStore } from '../store'
import { Circles } from './Circles'
import { WARM_MUTED_STYLE } from './mapStyle'
import { Markers } from './Markers'
import { MapTags } from './tags'
import { clickSuppressed } from './useLongPress'
import { MAP_ID, MAP_MODE } from './mapMode'

function onIdle(ev: MapEvent) {
  const m = ev.map
  const b = m.getBounds()
  const c = visibleCentre(m)
  if (!b || !c) return
  const ne = b.getNorthEast()
  const sw = b.getSouthWest()
  useStore.getState().setViewport({
    bounds: { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() },
    zoom: m.getZoom() ?? DEFAULT_ZOOM,
    center: c,
  })
}

/** Height of the top bar (masthead, search, chips), published by the sheet's CSS. */
function cssPx(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/**
 * The map is full bleed, but the part people can see is between the top bar and the sheet.
 * Returns the map centre that puts `target` in the middle of that visible band.
 * Uses Map.getProjection / Projection.fromLatLngToPoint (world coords = px / 2^zoom):
 * https://developers.google.com/maps/documentation/javascript/coordinates
 */
function centreFor(map: google.maps.Map, target: google.maps.LatLngLiteral, zoom: number): google.maps.LatLngLiteral {
  const proj = map.getProjection()
  if (!proj) return target
  const dy = bandDy(map)
  const pt = proj.fromLatLngToPoint(target)
  if (!pt) return target
  const c = proj.fromPointToLatLng(new google.maps.Point(pt.x, pt.y - dy / 2 ** zoom))
  return c ? { lat: c.lat(), lng: c.lng() } : target
}

/** Screen y offset (px) of the visible band's middle from the map's middle. */
function bandDy(map: google.maps.Map): number {
  const top = cssPx('--top-bar-h', 112)
  const sheet = cssPx('--sheet-offset', 0)
  const h = map.getDiv().clientHeight
  return (top + (h - sheet)) / 2 - h / 2
}

/**
 * The centre of what people can see (between top bar and sheet). Stored as viewport.center, so the
 * walk ring, walking times and the header count use the visible middle, not a point under the sheet.
 */
function visibleCentre(map: google.maps.Map): google.maps.LatLngLiteral | null {
  const c = map.getCenter()
  const proj = map.getProjection()
  if (!c) return null
  if (!proj) return { lat: c.lat(), lng: c.lng() }
  const pt = proj.fromLatLngToPoint(c)
  const ll = pt && proj.fromPointToLatLng(new google.maps.Point(pt.x, pt.y + bandDy(map) / 2 ** (map.getZoom() ?? DEFAULT_ZOOM)))
  return ll ? { lat: ll.lat(), lng: ll.lng() } : { lat: c.lat(), lng: c.lng() }
}

/** Applies one-shot camera commands from the store, and centres Bandra West in the visible band once. */
function FlyToController() {
  const map = useMap()
  const flyTo = useStore((s) => s.flyTo)
  useEffect(() => {
    if (!map) return
    const centre = () => map.setCenter(centreFor(map, BANDRA_WEST, map.getZoom() ?? DEFAULT_ZOOM))
    if (map.getProjection()) {
      centre()
      return
    }
    const l = map.addListener('projection_changed', () => {
      l.remove()
      centre()
    })
    return () => l.remove()
  }, [map])
  useEffect(() => {
    if (!map || !flyTo) return
    const zoom = flyTo.zoom ?? map.getZoom() ?? DEFAULT_ZOOM
    if (flyTo.zoom != null && flyTo.zoom !== map.getZoom()) map.setZoom(flyTo.zoom)
    map.panTo(centreFor(map, { lat: flyTo.lat, lng: flyTo.lng }, zoom))
  }, [map, flyTo])
  return null
}

export function MapView({ children }: { children?: React.ReactNode }) {
  return (
    <Map
      defaultCenter={BANDRA_WEST}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      {...(MAP_MODE === 'A' ? { mapId: MAP_ID } : { styles: WARM_MUTED_STYLE })}
      onIdle={onIdle}
      onClick={() => {
        if (!clickSuppressed()) useStore.getState().selectPin(null)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <FlyToController />
      <Circles />
      <Markers />
      <MapTags />
      {children}
    </Map>
  )
}

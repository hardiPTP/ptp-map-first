// Public map API: <MapView />. No other code needs to know the map mode.
// @vis.gl/react-google-maps <Map>: https://visgl.github.io/react-google-maps/docs/api-reference/components/map
import { Map, useMap, type MapEvent } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import { BANDRA_WEST, DEFAULT_ZOOM, useStore } from '../store'
import { WARM_MUTED_STYLE } from './mapStyle'
import { MAP_ID, MAP_MODE } from './mapMode'

function onIdle(ev: MapEvent) {
  const m = ev.map
  const b = m.getBounds()
  const c = m.getCenter()
  if (!b || !c) return
  const ne = b.getNorthEast()
  const sw = b.getSouthWest()
  useStore.getState().setViewport({
    bounds: { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() },
    zoom: m.getZoom() ?? DEFAULT_ZOOM,
    center: { lat: c.lat(), lng: c.lng() },
  })
}

/** Applies one-shot camera commands from the store. */
function FlyToController() {
  const map = useMap()
  const flyTo = useStore((s) => s.flyTo)
  useEffect(() => {
    if (!map || !flyTo) return
    map.panTo({ lat: flyTo.lat, lng: flyTo.lng })
    if (flyTo.zoom != null) map.setZoom(flyTo.zoom)
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
      style={{ width: '100%', height: '100%' }}
    >
      <FlyToController />
      {children}
    </Map>
  )
}

// Placing mode: fixed pin at the map's geometric centre, the user moves the map under it.
// useMap: https://visgl.github.io/react-google-maps/docs/api-reference/hooks/use-map
// Map.panTo / setZoom / addListener('idle'): https://developers.google.com/maps/documentation/javascript/reference/map
// Place lookup happens ONLY after the map goes idle, debounced, and only if the centre moved >= 10 m.
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../design/primitives'
import { distanceM } from '../lib/geo'
import { useStore } from '../store'
import type { LatLng } from '../types'
import { LOOKUP_DEBOUNCE_MS, lookupNearest, movedEnough, type NearbyPlace } from './nearby'

export const STREET_ZOOM = 17

export function Placing({ onBack }: { onBack: () => void }) {
  const map = useMap()
  const places = useMapsLibrary('places')
  const [found, setFound] = useState<{ at: LatLng; place: NearbyPlace | null } | null>(null)
  const lastLookup = useRef<LatLng | null>(null)
  const reqId = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lookupRef = useRef<() => void>(() => {})

  // Enter: sheet to peek, zoom to street level on the user (or the chosen spot / the map centre).
  const entered = useRef(false)
  useEffect(() => {
    if (!map || entered.current) return
    entered.current = true
    const s = useStore.getState()
    s.setSheetHeight('peek')
    const c = map.getCenter()
    const target: LatLng | null = s.create.at ?? s.userLocation ?? (c ? { lat: c.lat(), lng: c.lng() } : null)
    const moves = !c || !target || distanceM({ lat: c.lat(), lng: c.lng() }, target) > 1
    if (map.getZoom() !== STREET_ZOOM) map.setZoom(STREET_ZOOM)
    if (target && moves) map.panTo(target)
    // If nothing will move, no idle event comes: schedule the one lookup ourselves.
    if (!moves && map.getZoom() === STREET_ZOOM) schedule()
    function schedule() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => lookupRef.current(), LOOKUP_DEBOUNCE_MS)
    }
  }, [map])

  useEffect(() => {
    lookupRef.current = () => {
      if (!map || !places) return
      const c = map.getCenter()
      if (!c) return
      const at = { lat: c.lat(), lng: c.lng() }
      if (!movedEnough(lastLookup.current, at)) return
      lastLookup.current = at
      const id = ++reqId.current
      void lookupNearest(places, at).then((place) => {
        if (id === reqId.current) setFound({ at, place })
      })
    }
  }, [map, places])

  useEffect(() => {
    if (!map) return
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => lookupRef.current(), LOOKUP_DEBOUNCE_MS)
    }
    const idle = map.addListener('idle', schedule)
    const drag = map.addListener('dragstart', () => {
      reqId.current++ // drop any in-flight answer for the old spot
      if (timer.current) clearTimeout(timer.current)
      setFound(null)
    })
    // The lookup may be due already (places library loaded after the first idle).
    return () => {
      idle.remove()
      drag.remove()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [map])

  // The places library can arrive after the map went idle: look once when it does.
  useEffect(() => {
    if (map && places && !lastLookup.current && entered.current) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => lookupRef.current(), LOOKUP_DEBOUNCE_MS)
    }
  }, [map, places])

  const use = () => {
    const c = map?.getCenter()
    if (!c) return
    const at = { lat: c.lat(), lng: c.lng() }
    const fresh = found && found.place && distanceM(found.at, at) < 25 ? found.place : null
    useStore.getState().confirmSpot(at, { placeId: fresh?.placeId ?? null, placeName: fresh?.placeName ?? null })
  }

  return (
    <>
      <div className="create-pin" data-testid="create-pin" aria-hidden>
        <div className="create-pin__body">
          <span className="create-pin__halo" />
          <span className="create-pin__disc">
            <Icon name="ic-pin" size={16} />
          </span>
          <span className="create-pin__stalk" />
          <span className="create-pin__tip" />
        </div>
        {found && (
          <span className={['create-pin__name', !found.place && 'create-pin__name--none'].filter(Boolean).join(' ')} data-testid="create-placename">
            {found.place ? found.place.placeName : 'Unnamed spot'}
          </span>
        )}
      </div>
      <div className="ptp-sheet create-panel">
        <p className="create-panel__line">Move the map to the spot</p>
        <div className="create-panel__row">
          <Button onClick={onBack}>Back</Button>
          <Button variant="primary" size="big" fill onClick={use}>
            Use this spot
          </Button>
        </div>
      </div>
    </>
  )
}

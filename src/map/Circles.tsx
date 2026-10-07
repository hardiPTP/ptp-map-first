// Walk ring and area tint as google.maps.Circle. Docs: https://developers.google.com/maps/documentation/javascript/reference/polygon#Circle
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef } from 'react'
import { WALK_RING_M } from '../lib/geo'
import { useStore } from '../store'
import { token } from './token'

export function Circles() {
  const map = useMap()
  const walk = useRef<google.maps.Circle | null>(null)
  const area = useRef<google.maps.Circle | null>(null)
  const areaMode = useStore((s) => s.areaMode)
  const userLocation = useStore((s) => s.userLocation)
  const center = useStore((s) => s.viewport.center)
  const selectedAreaId = useStore((s) => s.selectedAreaId)
  const pins = useStore((s) => s.pins)

  useEffect(() => {
    if (!map) return
    const base = { map, clickable: false, draggable: false, editable: false }
    walk.current = new google.maps.Circle({
      ...base,
      radius: WALK_RING_M,
      strokeColor: token('--colour-ink-100', '#17140f'),
      strokeOpacity: 0.28,
      strokeWeight: 1.5,
      fillColor: token('--colour-ink-100', '#17140f'),
      fillOpacity: 0.03,
      zIndex: 1,
    })
    area.current = new google.maps.Circle({
      ...base,
      visible: false,
      radius: 1,
      // Ink, not orange: on the map orange means an open problem only (Figma colour rule; REVIEW #8).
      strokeColor: token('--colour-ink-100', '#17140f'),
      strokeOpacity: 0.45,
      strokeWeight: 1.5,
      fillColor: token('--colour-ink-100', '#17140f'),
      fillOpacity: 0.1,
      zIndex: 2,
    })
    return () => {
      walk.current?.setMap(null)
      area.current?.setMap(null)
      walk.current = area.current = null
    }
  }, [map])

  useEffect(() => {
    const origin = areaMode === 'nearMe' && userLocation ? userLocation : center
    walk.current?.setCenter(origin)
  }, [map, areaMode, userLocation, center])

  useEffect(() => {
    const a = selectedAreaId ? pins.find((p) => p.id === selectedAreaId && p.type === 'area') : undefined
    if (!a || !area.current) {
      area.current?.setVisible(false)
      return
    }
    area.current.setOptions({ center: { lat: a.lat, lng: a.lng }, radius: a.radiusM ?? 500, visible: true })
  }, [map, selectedAreaId, pins])

  return null
}

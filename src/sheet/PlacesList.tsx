// Places chip: the real places Google returned within the walk ring, nearest first. Tapping one flies the map there
// and lists any pins at that place (search-place mode).
import { useMemo } from 'react'
import { distanceM, formatDistance } from '../lib/geo'
import { useStore } from '../store'
import type { LatLng } from '../types'

export function PlacesList({ origin }: { origin: LatLng }) {
  const places = useStore((s) => s.places)
  const sorted = useMemo(() => [...places].sort((a, b) => distanceM(origin, a) - distanceM(origin, b)), [places, origin])
  if (sorted.length === 0) return <p className="sheet-empty">Places will show here once the map has loaded them.</p>
  return (
    <ul className="sheet-places">
      {sorted.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="sheet-place"
            onClick={() => {
              const s = useStore.getState()
              s.setSearchPlace({ placeId: p.id, placeName: p.name })
              s.requestFlyTo({ lat: p.lat, lng: p.lng, zoom: 17 })
            }}
          >
            <span>
              <span className="sheet-place__name">{p.name}</span>
              <span className="sheet-place__meta">
                {[p.kind, p.openNow == null ? null : p.openNow ? 'Open now' : 'Closed now'].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="sheet-place__dist">{formatDistance(origin, p)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

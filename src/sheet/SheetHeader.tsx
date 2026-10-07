// Sheet heading. Figma heading/sort (3617:3490): line one is the question, the accent part is the one thing you can
// change (the area), which opens the area sheet. The count line says what is in range. Map / List pill on the right.
import { useState } from 'react'
import { Button, Icon } from '../design/primitives'
import { formatWalk, walkMin } from '../lib/geo'
import { AREA_NAME, BANDRA_WEST, useStore } from '../store'
import { AreaSheet } from '../top/Sheets'
import type { SheetHeight } from '../types'
import type { FeedResult } from './useFeed'

export function headerCopy(args: {
  feed: Pick<FeedResult, 'nearCount' | 'mode' | 'items'>
  areaMode: 'area' | 'nearMe'
  searchName: string | null
  /** Places chip on: the count line counts places instead of pins. */
  placesCount?: number | null
}): { title: string; sub: string | null } {
  const { feed, areaMode, searchName, placesCount } = args
  if (searchName) {
    const n = feed.items.length
    return { title: searchName, sub: n === 0 ? 'Nothing posted here yet' : `${n} ${n === 1 ? 'pin' : 'pins'} here` }
  }
  const title = areaMode === 'nearMe' ? 'near you' : `in ${AREA_NAME}`
  if (placesCount != null)
    return { title, sub: placesCount === 0 ? 'Loading places' : `${placesCount} places within a 10 min walk, from Google` }
  const n = feed.nearCount
  const sub =
    n === 0
      ? 'Nothing new within a 10 min walk'
      : `${n} ${n === 1 ? 'thing' : 'things'} within a 10 min walk${feed.mode === 'sinceLastNight' ? ', since last night' : ''}`
  return { title, sub }
}

export function SheetHeader({ feed, height, onPill }: { feed: FeedResult; height: SheetHeight; onPill: () => void }) {
  const areaMode = useStore((s) => s.areaMode)
  const searchPlace = useStore((s) => s.searchPlace)
  const setSearchPlace = useStore((s) => s.setSearchPlace)
  const place = useStore((s) => (s.searchPlace ? s.places.find((p) => p.id === s.searchPlace?.placeId) ?? null : null))
  const placesCount = useStore((s) => (s.filter === 'places' ? s.places.length : null))
  // Distance to a picked place is from where you are (or the area centre), not from the map centre it flew to.
  const from = useStore((s) => (s.areaMode === 'nearMe' && s.userLocation ? s.userLocation : BANDRA_WEST))
  const [areaOpen, setAreaOpen] = useState(false)
  const { title, sub } = headerCopy({ feed, areaMode, searchName: searchPlace?.placeName ?? null, placesCount })

  return (
    <div className="sheet-header">
      <div className="sheet-header__text">
        {searchPlace ? (
          <>
            <h2 className="sheet-header__title">{title}</h2>
            <p className="sheet-header__sub">
              {[
                place?.kind,
                place?.openNow == null ? null : place.openNow ? 'Open now' : 'Closed now',
                place ? formatWalk(walkMin(from, place)) : null,
                sub,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="sheet-header__row">
              {place && (
                <Button
                  variant="quiet"
                  icon="ic-plus"
                  onClick={() => useStore.getState().confirmSpot({ lat: place.lat, lng: place.lng }, { placeId: place.id, placeName: place.name })}
                >
                  Pin something here
                </Button>
              )}
              <button type="button" className="sheet-header__back" onClick={() => setSearchPlace(null)}>
                Back to nearby
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="sheet-header__title">
              What's on{' '}
              <button type="button" className="sheet-header__area" onClick={() => setAreaOpen(true)} aria-haspopup="dialog">
                {title}
                <Icon name="heading-sort-chevron-down-22" size={20} tint={false} />
              </button>
            </h2>
            <p className="sheet-header__sub">{sub}</p>
          </>
        )}
      </div>
      <Button variant="quiet" icon={height === 'full' ? 'ic-map' : 'ic-doc'} onClick={onPill}>
        {height === 'full' ? 'Map' : 'List'}
      </Button>
      {areaOpen && <AreaSheet onClose={() => setAreaOpen(false)} />}
    </div>
  )
}

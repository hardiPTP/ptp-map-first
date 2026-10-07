import { Button } from '../design/primitives'
import { AREA_NAME, useStore } from '../store'
import type { SheetHeight } from '../types'
import type { FeedResult } from './useFeed'

export function headerCopy(args: {
  feed: Pick<FeedResult, 'nearCount' | 'mode' | 'items'>
  areaMode: 'area' | 'nearMe'
  searchName: string | null
}): { title: string; sub: string | null } {
  const { feed, areaMode, searchName } = args
  if (searchName) {
    const n = feed.items.length
    return { title: n === 0 ? `Nothing posted at ${searchName}` : `${n} ${n === 1 ? 'thing' : 'things'} at ${searchName}`, sub: null }
  }
  const n = feed.nearCount
  const last = feed.mode === 'sinceLastNight'
  const title =
    n === 0
      ? 'Nothing new within a 10 min walk'
      : `${n} ${n === 1 ? 'thing' : 'things'} within a 10 min walk${last ? '' : ' today'}`
  const parts: string[] = []
  if (areaMode === 'area') parts.push(`Showing ${AREA_NAME}`)
  if (last) parts.push(areaMode === 'area' ? 'since last night' : 'Since last night')
  return { title, sub: parts.length ? parts.join(', ') : null }
}

/** Header: count title (headline token), sub line (meta-lg), Map / List pill. */
export function SheetHeader({ feed, height, onPill }: { feed: FeedResult; height: SheetHeight; onPill: () => void }) {
  const areaMode = useStore((s) => s.areaMode)
  const searchPlace = useStore((s) => s.searchPlace)
  const setSearchPlace = useStore((s) => s.setSearchPlace)
  const { title, sub } = headerCopy({ feed, areaMode, searchName: searchPlace?.placeName ?? null })
  return (
    <div className="sheet-header">
      <div className="sheet-header__text">
        <h2 className="sheet-header__title">{title}</h2>
        {sub && <p className="sheet-header__sub">{sub}</p>}
        {searchPlace && (
          <button type="button" className="sheet-header__back" onClick={() => setSearchPlace(null)}>
            Back to nearby
          </button>
        )}
      </div>
      <Button variant="quiet" icon={height === 'full' ? 'ic-map' : 'ic-doc'} onClick={onPill}>
        {height === 'full' ? 'Map' : 'List'}
      </Button>
    </div>
  )
}

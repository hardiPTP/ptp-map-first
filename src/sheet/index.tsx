// OWNED BY AGENT B. SheetLayer = BottomSheet + SheetHeader + AreaStrip + Feed.
import { useRef } from 'react'
import { useStore } from '../store'
import { AreaStrip } from './AreaStrip'
import { BottomSheet } from './BottomSheet'
import { Feed } from './Feed'
import { PlacesList } from './PlacesList'
import { SheetHeader } from './SheetHeader'
import { useFeed } from './useFeed'
import './sheet.css'

export function SheetLayer() {
  const feed = useFeed()
  const scrollRef = useRef<HTMLDivElement>(null)
  const searching = useStore((s) => s.searchPlace != null)
  const placesOnly = useStore((s) => s.filter === 'places')
  return (
    <BottomSheet
      scrollRef={scrollRef}
      header={(height, pill) => <SheetHeader feed={feed} height={height} onPill={pill} />}
    >
      {!searching && !placesOnly && <AreaStrip origin={feed.origin} now={feed.now} />}
      {placesOnly && !searching ? <PlacesList origin={feed.origin} /> : <Feed feed={feed} scrollRoot={scrollRef} />}
    </BottomSheet>
  )
}

// OWNED BY AGENT B. SheetLayer = BottomSheet + SheetHeader + AreaStrip + Feed.
import { useRef } from 'react'
import { useStore } from '../store'
import { AreaStrip } from './AreaStrip'
import { BottomSheet } from './BottomSheet'
import { Feed } from './Feed'
import { SheetHeader } from './SheetHeader'
import { useFeed } from './useFeed'
import './sheet.css'

export function SheetLayer() {
  const feed = useFeed()
  const scrollRef = useRef<HTMLDivElement>(null)
  const searching = useStore((s) => s.searchPlace != null)
  return (
    <BottomSheet
      scrollRef={scrollRef}
      header={(height, pill) => <SheetHeader feed={feed} height={height} onPill={pill} />}
    >
      {!searching && <AreaStrip origin={feed.origin} now={feed.now} />}
      <Feed feed={feed} scrollRoot={scrollRef} />
    </BottomSheet>
  )
}

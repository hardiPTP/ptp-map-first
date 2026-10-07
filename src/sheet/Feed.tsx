import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { PinCard } from './PinCard'
import type { FeedResult } from './useFeed'

/** Feed list. Sets highlightedPinId to the top-most visible card; never moves the map. */
export function Feed({ feed, scrollRoot }: { feed: FeedResult; scrollRoot: React.RefObject<HTMLElement | null> }) {
  const supports = useStore((s) => s.supports)
  const deviceId = useStore((s) => s.deviceId)
  const highlighted = useStore((s) => s.highlightedPinId)
  const listRef = useRef<HTMLUListElement>(null)

  const { counts, mine } = useMemo(() => {
    const counts = new Map<string, number>()
    const mine = new Set<string>()
    for (const s of supports) {
      counts.set(s.pinId, (counts.get(s.pinId) ?? 0) + 1)
      if (deviceId && s.deviceId === deviceId) mine.add(s.pinId)
    }
    return { counts, mine }
  }, [supports, deviceId])

  useEffect(() => {
    const root = scrollRoot.current
    const list = listRef.current
    if (!root || !list || typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const pick = () => {
      const first = Array.from(list.children).find((el) => visible.has((el as HTMLElement).dataset.pinId ?? ''))
      useStore.getState().highlightPin(first ? ((first as HTMLElement).dataset.pinId ?? null) : null)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.pinId
          if (!id) continue
          if (e.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        pick()
      },
      { root, threshold: 0.5 },
    )
    Array.from(list.children).forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [feed.items, scrollRoot])

  return (
    <ul className="sheet-feed" ref={listRef}>
      {feed.items.map((pin) => (
        <li key={pin.id} data-pin-id={pin.id} className="sheet-feed__item">
          <PinCard
            pin={pin}
            origin={feed.origin}
            now={feed.now}
            count={counts.get(pin.id) ?? 0}
            supported={mine.has(pin.id)}
            highlighted={highlighted === pin.id}
          />
        </li>
      ))}
    </ul>
  )
}

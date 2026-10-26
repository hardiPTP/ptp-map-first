// Which pins the map shows: live (lib/pulse), matching the chip, never area updates.
import { useMemo } from 'react'
import { mergeSimilar, type Merged } from '../lib/merge'
import { isLive } from '../lib/pulse'
import { interest } from '../lib/rank'
import { useStore } from '../store'
import type { Filter, Pin, Support } from '../types'

export function visiblePins(pins: Pin[], supports: Support[], filter: Filter, now: number): Pin[] {
  return pins.filter(
    (p) => p.type !== 'area' && (filter === 'all' || p.type === filter) && isLive(p, supports, now),
  )
}

/**
 * What the map draws: visible pins with similar ones merged (lib/merge), the most important leading, the selected pin
 * always its own marker. Markers and the map layers both call this with the same inputs, so they agree.
 */
export function mapPins(pins: Pin[], supports: Support[], filter: Filter, now: number, selectedId: string | null): Merged {
  return mergeSimilar(
    visiblePins(pins, supports, filter, now),
    (p) => interest(p, supports, now),
    new Set(selectedId ? [selectedId] : []),
  )
}

const clock = () => Date.now()

/** Recomputed when data, filter, selection or viewport (map idle) changes. No timers. */
export function useMapPins(): Merged {
  const pins = useStore((s) => s.pins)
  const supports = useStore((s) => s.supports)
  const filter = useStore((s) => s.filter)
  const selectedId = useStore((s) => s.selectedPinId)
  const viewport = useStore((s) => s.viewport)
  return useMemo(
    () => mapPins(pins, supports, filter, clock(), selectedId),
    // viewport is a deliberate dependency: it refreshes "now" on map idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pins, supports, filter, selectedId, viewport],
  )
}

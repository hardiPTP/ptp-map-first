// Which pins the map shows: live (lib/pulse), matching the chip, never area updates.
import { useMemo } from 'react'
import { isLive } from '../lib/pulse'
import { useStore } from '../store'
import type { Filter, Pin, Support } from '../types'

export function visiblePins(pins: Pin[], supports: Support[], filter: Filter, now: number): Pin[] {
  return pins.filter(
    (p) => p.type !== 'area' && (filter === 'all' || p.type === filter) && isLive(p, supports, now),
  )
}

const clock = () => Date.now()

/** Recomputed when data, filter or viewport (map idle) changes. No timers. */
export function useVisiblePins(): Pin[] {
  const pins = useStore((s) => s.pins)
  const supports = useStore((s) => s.supports)
  const filter = useStore((s) => s.filter)
  const viewport = useStore((s) => s.viewport)
  // viewport is a deliberate dependency: it refreshes "now" on map idle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => visiblePins(pins, supports, filter, clock()), [pins, supports, filter, viewport])
}

import { useMemo } from 'react'
import { distanceM, WALK_RING_M } from '../lib/geo'
import { isLive, pulseWindow, type PulseWindow } from '../lib/pulse'
import { rankPins } from '../lib/rank'
import { useStore } from '../store'
import type { Bounds, Filter, LatLng, Pin, Support } from '../types'
import { useOrigin } from './origin'

export interface FeedResult {
  items: Pin[]
  /** Items within the 10 min walk ring around the origin. */
  nearCount: number
  mode: PulseWindow['mode'] | 'type' | 'search'
  now: number
  origin: LatLng
}

function inBounds(p: Pin, b: Bounds | null): boolean {
  if (!b) return true
  const lngOk = b.west <= b.east ? p.lng >= b.west && p.lng <= b.east : p.lng >= b.west || p.lng <= b.east
  return p.lat <= b.north && p.lat >= b.south && lngOk
}

/** Pure feed builder (unit tested). docs/DECISIONS.md "Pulse feed composition". */
export function buildFeed(args: {
  pins: Pin[]
  supports: Support[]
  filter: Filter
  bounds: Bounds | null
  searchPlaceId: string | null
  origin: LatLng
  now: number
  /** This device; its pins posted in the last 10 minutes go to the top (PRD "Creating a pin" step 6). */
  deviceId?: string | null
}): FeedResult {
  const { pins, supports, filter, bounds, searchPlaceId, origin, now, deviceId } = args
  // A picked place lists every pin there, even when the Places chip is on.
  const f: Filter = searchPlaceId && filter === 'places' ? 'all' : filter
  const base = pins.filter((p) => p.type !== 'area' && (f === 'all' || p.type === f))
  let items: Pin[]
  let mode: FeedResult['mode']
  if (searchPlaceId) {
    items = base.filter((p) => p.placeId === searchPlaceId && isLive(p, supports, now))
    mode = 'search'
  } else if (f !== 'all') {
    // A type chip lists every live pin of that type in view, not only the Pulse window
    // (lead decision at Gate 1, docs/DECISIONS.md).
    items = base.filter((p) => inBounds(p, bounds) && isLive(p, supports, now))
    mode = 'type'
  } else {
    const w = pulseWindow(base.filter((p) => inBounds(p, bounds)), supports, now)
    items = w.items
    mode = w.mode
  }
  items = rankPins(items, supports, origin, now)
  if (deviceId) {
    const mineNew = (p: Pin) => p.createdBy === deviceId && now - p.createdAt < JUST_POSTED_MS
    items = [...items.filter(mineNew).sort((a, b) => b.createdAt - a.createdAt), ...items.filter((p) => !mineNew(p))]
  }
  const nearCount = items.filter((p) => distanceM(origin, p) <= WALK_RING_M).length
  return { items, nearCount, mode, now, origin }
}

const readNow = () => Date.now()
const JUST_POSTED_MS = 10 * 60 * 1000

export function useFeed(): FeedResult {
  const pins = useStore((s) => s.pins)
  const supports = useStore((s) => s.supports)
  const filter = useStore((s) => s.filter)
  const bounds = useStore((s) => s.viewport.bounds)
  const searchPlace = useStore((s) => s.searchPlace)
  const deviceId = useStore((s) => s.deviceId)
  const origin = useOrigin()
  // "now" is read when the data or view changes; no timers anywhere.
  return useMemo(
    () => buildFeed({ pins, supports, filter, bounds, searchPlaceId: searchPlace?.placeId ?? null, origin, now: readNow(), deviceId }),
    [pins, supports, filter, bounds, searchPlace, origin, deviceId],
  )
}

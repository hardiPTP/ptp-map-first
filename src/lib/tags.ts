// OWNED BY AGENT F. PRD "Map tags": which pins carry a tag, and what it says. Pure: no Google, no DOM, no clock
// (callers pass `now`). All geometry is in screen px (any origin; only relative positions matter).
import type { Pin, Support } from '../types'
import { distanceM, WALK_M_PER_MIN } from './geo'
import { supports7d } from './rank'
import { CLUSTER_MAX_ZOOM, worldPx, type Cluster } from '../map/cluster'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/** Civic deadline: the ring fills over 7 days (PRD). */
export const CIVIC_DEADLINE_MS = 7 * DAY
/** "Fresh supports": the last 3 hours. */
export const FRESH_SUPPORT_MS = 3 * HOUR
/** Event "soon": starts within 2 hours. */
export const EVENT_SOON_MS = 2 * HOUR
/** A new candidate must beat a showing tag by this factor (30%). */
export const STICKY_FACTOR = 1.3
/** After this many shows without a tap, freshness is halved. */
export const SEEN_LIMIT = 3
/** Tag screen box: height 24 (Tag primitive). Width is estimated from the value text. */
export const TAG_H = 24

export type TagKind = 'civic-timer' | 'civic-busy' | 'event' | 'ask' | 'cluster'
export type TagSymbol = 'ring' | 'arrow-up' | 'clock' | 'avatar' | 'hand' | 'none'

export interface TagContent {
  kind: TagKind
  symbol: TagSymbol
  /** Short value, no sentences: "12d", "+5", "in 40m", "5 PM", "Sat", "2", "3h", "8 events". */
  value: string
  /** Civic timer only: 0..1 fill of the 7-day ring (1 = full). */
  ringFill?: number
  /** Civic timer only: past the 7-day deadline (ring turns red). */
  past?: boolean
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface TagCandidate {
  /** Pin id, or cluster id. */
  id: string
  lat: number
  lng: number
  content: TagContent
  /** 1, 1.5 or 2. */
  urgency: number
  /** Where the tag would be drawn, in screen px. */
  box: Box
  /** The marker body this tag belongs to (ignored by the obstacle test). */
  markerBox?: Box
}

export interface SelectOptions {
  /** Selected pin id: always tagged, outside the zoom cap and the overlap rule. */
  selectedId?: string | null
  /** Marker bodies of ALL shown pins (screen px). A tag that covers another pin's marker is skipped. */
  obstacles?: Box[]
}

export interface TagViewport {
  /** Origin for nearness: the visible-band centre. */
  center: { lat: number; lng: number }
}

/** How many tags a zoom may show: <=13 clusters only (no cap on counts), 14 to 16 three, 17+ six. */
export function zoomCap(zoom: number): number {
  if (zoom <= CLUSTER_MAX_ZOOM) return Infinity
  if (zoom <= 16) return 3
  return 6
}

/** PRD: Nearness = 1 / (1 + walkMin / 10). */
export function nearness(walkMinutes: number): number {
  return 1 / (1 + walkMinutes / 10)
}

/** PRD: freshness halved once a tag was shown 3 times without a tap. */
export function freshness(seenCount: number): number {
  return seenCount >= SEEN_LIMIT ? 0.5 : 1
}

/** score = interest (1) x urgency x nearness x freshness. */
export function tagScore(c: TagCandidate, origin: { lat: number; lng: number }, seenCounts: Record<string, number>): number {
  const walk = distanceM(origin, c) / WALK_M_PER_MIN
  return 1 * c.urgency * nearness(walk) * freshness(seenCounts[c.id] ?? 0)
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * Picks the tags to show on a map idle.
 * Order of candidates: selected first; then by effective score (score x 1.3 for a tag already showing, so a new
 * candidate must reach 1.3 x the old score to displace it; ties go to the new one). A candidate is skipped when its box
 * overlaps an already accepted tag, or another pin's marker body; the next candidate is tried. Stops at the zoom cap.
 * Returns the chosen ids in rank order.
 */
export function selectTags(
  candidates: TagCandidate[],
  viewport: TagViewport,
  zoom: number,
  previous: ReadonlySet<string>,
  seenCounts: Record<string, number>,
  opts: SelectOptions = {},
): string[] {
  const { selectedId = null, obstacles = [] } = opts
  const cap = zoomCap(zoom)
  const ranked = candidates
    .filter((c) => c.id !== selectedId)
    .map((c) => {
      const score = tagScore(c, viewport.center, seenCounts)
      return { c, eff: previous.has(c.id) ? score * STICKY_FACTOR : score, sticky: previous.has(c.id) }
    })
    .sort((a, b) => b.eff - a.eff || Number(a.sticky) - Number(b.sticky))
  const chosen: TagCandidate[] = []
  const sel = candidates.find((c) => c.id === selectedId)
  if (sel) chosen.push(sel)
  let count = 0
  for (const { c } of ranked) {
    if (count >= cap) break
    if (chosen.some((o) => overlaps(c.box, o.box))) continue
    if (obstacles.some((o) => o !== c.markerBox && !sameBox(o, c.markerBox) && overlaps(c.box, o))) continue
    chosen.push(c)
    count++
  }
  return chosen.map((c) => c.id)
}

function sameBox(a: Box, b?: Box): boolean {
  return !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

// ---------- content ----------

/** Tag width estimate (px): symbol + paddings (Tag primitive: 6 + 14 + 4 + 8) plus about 8 px per character. */
export function tagWidth(value: string): number {
  return 32 + Math.ceil(value.length * 8)
}

/** Whole days open, e.g. 12 for "12d". */
export function daysOpen(pin: Pin, now: number): number {
  return Math.max(0, Math.floor((now - pin.createdAt) / DAY))
}

/** Ring fill 0..1 over the 7-day deadline, and whether it is past. */
export function ringState(pin: Pin, now: number): { fill: number; past: boolean } {
  const age = Math.max(0, now - pin.createdAt)
  return { fill: Math.min(1, age / CIVIC_DEADLINE_MS), past: age > CIVIC_DEADLINE_MS }
}

/** Supports in the last 3 hours (pins in `supports` plus nothing else). */
export function freshSupports(pinId: string, supports: Support[], now: number): number {
  let n = 0
  for (const s of supports) if (s.pinId === pinId && now - s.createdAt <= FRESH_SUPPORT_MS) n++
  return n
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** "in 40m", "in 1h 20m". Minimum "in 1m". */
export function formatIn(ms: number): string {
  const m = Math.max(1, Math.round(ms / MIN))
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `in ${h}h ${r}m` : `in ${h}h`
}

/** "5 PM", "5:30 PM" (local time). */
export function formatClock(t: number): string {
  const d = new Date(t)
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "3h", "12m", "2d": time since asking. */
export function formatAgo(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN))
  if (m < 60) return `${Math.max(1, m)}m`
  if (m < 24 * 60) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / (24 * 60))}d`
}

/** Event time tag value. Started events (not yet over) read "now". */
export function eventValue(startsAt: number, now: number): { value: string; urgency: number } {
  const until = startsAt - now
  if (until <= 0) return { value: 'now', urgency: 2 }
  if (until <= EVENT_SOON_MS) return { value: formatIn(until), urgency: 2 }
  if (sameDay(startsAt, now)) return { value: formatClock(startsAt), urgency: 1.5 }
  return { value: WEEKDAYS[new Date(startsAt).getDay()], urgency: 1 }
}

/** Content and urgency for one pin, or null for pins that get no tag (area updates). */
export function tagContent(pin: Pin, supports: Support[], now: number): { content: TagContent; urgency: number } | null {
  if (pin.type === 'area') return null
  const fresh = freshSupports(pin.id, supports, now)
  const freshU = fresh > 0 ? 1.5 : 1
  if (pin.type === 'civic') {
    if (fresh > 0) {
      return { content: { kind: 'civic-busy', symbol: 'arrow-up', value: `+${fresh}` }, urgency: 1.5 }
    }
    const { fill, past } = ringState(pin, now)
    return {
      content: { kind: 'civic-timer', symbol: 'ring', value: `${daysOpen(pin, now)}d`, ringFill: fill, past },
      urgency: past ? 2 : 1,
    }
  }
  if (pin.type === 'event') {
    if (pin.startsAt == null) return null
    const { value, urgency } = eventValue(pin.startsAt, now)
    return {
      content: { kind: 'event', symbol: pin.postedAs === 'place' ? 'avatar' : 'clock', value },
      urgency: Math.max(urgency, freshU),
    }
  }
  const offers = supports7d(pin.id, supports, now)
  return {
    content: {
      kind: 'ask',
      symbol: 'hand',
      value: offers > 0 ? String(offers) : formatAgo(now - pin.createdAt),
    },
    urgency: freshU,
  }
}

/** Cluster tag: count of the most common type, "8 events" / "3 issues" / "2 asks". Null when only area pins. */
export function clusterContent(cluster: Cluster): TagContent {
  const counts: Record<string, number> = {}
  for (const p of cluster.pins) counts[p.type] = (counts[p.type] ?? 0) + 1
  const [type, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['civic', cluster.count]
  const noun: Record<string, [string, string]> = { event: ['event', 'events'], civic: ['issue', 'issues'], ask: ['ask', 'asks'] }
  const [one, many] = noun[type] ?? ['pin', 'pins']
  return { kind: 'cluster', symbol: 'none', value: `${n} ${n === 1 ? one : many}` }
}

// ---------- screen geometry ----------

/** Marker bodies (Figma pin/map): default 36x50 tip-anchored; selected 54x68. */
export function markerBox(at: { x: number; y: number }, selected: boolean): Box {
  return selected ? { x: at.x - 27, y: at.y - 65.5, w: 54, h: 68 } : { x: at.x - 18, y: at.y - 47.5, w: 36, h: 50 }
}

/** Tag box beside a pin marker: starts 6 px right of the disc, vertically centred on the disc. */
export function pinTagBox(at: { x: number; y: number }, selected: boolean, value: string): Box {
  const cy = at.y + (selected ? -38.5 : -31.5)
  return { x: at.x + 22, y: cy - TAG_H / 2, w: tagWidth(value), h: TAG_H }
}

/** Cluster marker is a 44 circle centred on the anchor. */
export function clusterTagBox(at: { x: number; y: number }, value: string): Box {
  return { x: at.x + 28, y: at.y - TAG_H / 2, w: tagWidth(value), h: TAG_H }
}

/** Screen px of a lat/lng relative to a known centre point (Web Mercator, same maths as Google's projection). */
export function toScreen(
  p: { lat: number; lng: number },
  centre: { lat: number; lng: number },
  zoom: number,
  centreScreen: { x: number; y: number },
): { x: number; y: number } {
  const a = worldPx(p, zoom)
  const c = worldPx(centre, zoom)
  return { x: centreScreen.x + a.x - c.x, y: centreScreen.y + a.y - c.y }
}

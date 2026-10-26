// OWNED BY AGENT F. PRD "Map tags": which pins carry a tag, and what it says. Pure: no Google, no DOM, no clock
// (callers pass `now`). All geometry is in screen px (any origin; only relative positions matter).
import type { Pin, Support } from '../types'
import { OFFER_FACTOR } from './claims'
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

export type TagKind = 'civic-timer' | 'event' | 'ask' | 'offer' | 'merged' | 'cluster'
export type TagSymbol = 'ring' | 'clock' | 'avatar' | 'hand' | 'none'

export interface TagContent {
  kind: TagKind
  symbol: TagSymbol
  /** Short value, no sentences: "12d", "+2" (merged), "in 40m", "5 PM", "Sat", "2", "3h", "8 events". */
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
  /** Other boxes of the same pin the obstacle test ignores (pin text: the pin's own tag, which moves after it). */
  own?: Box[]
  /** Fallback spots, tried in order when `box` is blocked (bubbles: below the pin). */
  alts?: Box[]
}

/** A chosen candidate and where it went: alt -1 = its main box, 0.. = alts[alt]. */
export interface Placed {
  id: string
  box: Box
  alt: number
}

export interface SelectOptions {
  /** Selected pin id: always tagged, outside the zoom cap and the overlap rule. */
  selectedId?: string | null
  /** Marker bodies of ALL shown pins (screen px). A tag that covers another pin's marker is skipped. */
  obstacles?: Box[]
  /** Overrides the zoom cap (bubbles: 3, name labels: no cap). The selected candidate never counts. */
  cap?: number
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
  return placeTags(candidates, viewport, zoom, previous, seenCounts, opts).map((p) => p.id)
}

/** selectTags, also saying where each one went (a candidate whose box is blocked tries its alts, in order). */
export function placeTags(
  candidates: TagCandidate[],
  viewport: TagViewport,
  zoom: number,
  previous: ReadonlySet<string>,
  seenCounts: Record<string, number>,
  opts: SelectOptions = {},
): Placed[] {
  const { selectedId = null, obstacles = [] } = opts
  const cap = opts.cap ?? zoomCap(zoom)
  const ranked = candidates
    .filter((c) => c.id !== selectedId)
    .map((c) => {
      const score = tagScore(c, viewport.center, seenCounts)
      return { c, eff: previous.has(c.id) ? score * STICKY_FACTOR : score, sticky: previous.has(c.id) }
    })
    .sort((a, b) => b.eff - a.eff || Number(a.sticky) - Number(b.sticky))
  const chosen: Placed[] = []
  const sel = candidates.find((c) => c.id === selectedId)
  if (sel) chosen.push({ id: sel.id, box: sel.box, alt: -1 })
  let count = 0
  for (const { c } of ranked) {
    if (count >= cap) break
    const spots = [c.box, ...(c.alts ?? [])]
    const k = spots.findIndex(
      (b) => !chosen.some((o) => overlaps(b, o.box)) && !obstacles.some((o) => !isOwn(o, c) && overlaps(b, o)),
    )
    if (k < 0) continue
    chosen.push({ id: c.id, box: spots[k], alt: k - 1 })
    count++
  }
  return chosen
}

function sameBox(a: Box, b?: Box): boolean {
  return !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

function isOwn(o: Box, c: TagCandidate): boolean {
  return o === c.markerBox || sameBox(o, c.markerBox) || !!c.own?.some((b) => b === o || sameBox(o, b))
}

// ---------- layers: opinion bubbles, map tags, name labels ----------

/**
 * Popups (bubbles) by zoom, like Pulse on the map: the most important and recent pins first, more as you zoom in.
 * <=13 none (clusters); 14: 2; 15: 3; 16: 4; 17+: 5. Zoomed in on one pin, it gets its popup.
 */
export function popupCap(zoom: number): number {
  if (zoom <= CLUSTER_MAX_ZOOM) return 0
  if (zoom < 15) return 2
  if (zoom < 16) return 3
  if (zoom < 17) return 4
  return 5
}

/**
 * Pin text (Google style, right of the pin) by zoom: the most relevant pins get text first, more as you zoom in.
 * <=13 only the selected pin; 14: 3; 15: 5; 16: 8; 17+: as many as fit. The selected pin never counts.
 */
export function textCap(zoom: number): number {
  if (zoom <= CLUSTER_MAX_ZOOM) return 0
  if (zoom < 15) return 3
  if (zoom < 16) return 5
  if (zoom < 17) return 8
  return Infinity
}

export interface LayerInput {
  /** Tag candidates: single pins and clusters (box = tag box). */
  tags: TagCandidate[]
  /** Popup candidates: any pin (box = bubble box, urgency = the pin's interest, as Pulse ranks it). */
  bubbles: TagCandidate[]
  /** Popups that show the pin's own title (no comment yet): those pins do not repeat it as pin text. */
  titled?: ReadonlySet<string>
  /** Pin text candidates (box = the text alone in the slot right of the pin, pinTextBox). */
  labels: TagCandidate[]
  zoom: number
  viewport: TagViewport
  selectedId?: string | null
  /** Marker bodies of all shown pins and clusters. */
  obstacles: Box[]
  /** Extra boxes only name labels must avoid (Google place names drawn by the places layer). */
  labelObstacles?: Box[]
  /**
   * Screen width: pin text that would run past the right edge (with its tag) is shortened to the room left, at least
   * TEXT_MIN_W; with less room than that it is left out (the selected pin keeps it, at TEXT_MIN_W).
   */
  screenW?: number
  previous: { tags: ReadonlySet<string>; bubbles: ReadonlySet<string>; labels: ReadonlySet<string> }
  seenCounts: Record<string, number>
}

export interface LayerPlan {
  tags: string[]
  bubbles: string[]
  /** Bubbles that opened below their pin (the spot above was taken). */
  below: string[]
  /** Pins that show their text. A pin in both labels and tags draws text, then its tag after it. */
  labels: string[]
  /** Text boxes shortened to fit the screen: pin id -> text width in px (the UI caps the text there, with an ellipsis). */
  textW: Record<string, number>
}

/** Text followed by the pin's tag (4 px gap), as one box, both centred on the disc. */
export function textWithTag(text: Box, tag: Box): Box {
  const y = Math.min(text.y, tag.y)
  return { x: text.x, y, w: text.w + TEXT_TAG_GAP + tag.w, h: Math.max(text.y + text.h, tag.y + tag.h) - y }
}

/**
 * One pass on map idle, three layers through the same score, stickiness and overlap check (selectTags):
 * 1. Bubbles: top 3 by tag score, never on the selected pin (it always shows its tag, PRD rule 4), none at
 *    cluster zooms. 2. Tags: pins that got a bubble are left out (a pin shows a tag or a bubble, never both);
 *    bubbles are obstacles, and so is the tag slot beside a bubbled pin, so a pin stacked under it cannot put its
 *    tag there and read as the same pin having both. 3. Pin text right of the pin, capped by zoom (textCap; the
 *    selected pin always). A pin that also has a tag puts the text first and the tag after it, so its box grows to
 *    text + tag; every other marker, bubble, tag and text is an obstacle, so nothing ever collides.
 */
export function planLayers(i: LayerInput): LayerPlan {
  const { zoom, viewport, seenCounts, obstacles } = i
  const selectedId = i.selectedId ?? null
  const selTag = i.tags.find((c) => c.id === selectedId)

  const placed = placeTags(
    i.bubbles.filter((c) => c.id !== selectedId),
    viewport,
    zoom,
    i.previous.bubbles,
    seenCounts,
    { cap: popupCap(zoom), obstacles: selTag ? [...obstacles, selTag.box] : obstacles },
  )
  const bubbles = placed.map((p) => p.id)
  const below = placed.filter((p) => p.alt === 0).map((p) => p.id)
  const bubbleBoxes = placed.map((p) => p.box)
  const hasBubble = new Set(bubbles)

  const tags = selectTags(
    i.tags.filter((c) => !hasBubble.has(c.id)),
    viewport,
    zoom,
    i.previous.tags,
    seenCounts,
    { selectedId, obstacles: [...obstacles, ...bubbleBoxes, ...i.tags.filter((c) => hasBubble.has(c.id)).map((c) => c.box)] },
  )

  const tagged = new Map(tags.map((id) => [id, i.tags.find((c) => c.id === id)!.box]))
  const textW: Record<string, number> = {}
  const textCands = i.labels
    .filter((c) => !(hasBubble.has(c.id) && i.titled?.has(c.id)))
    .map((c) => {
      const tag = tagged.get(c.id)
      let text = c.box
      const extra = tag ? TEXT_TAG_GAP + tag.w : 0
      const over = i.screenW == null ? 0 : text.x + text.w + extra - i.screenW
      if (over > 0) {
        // The selected pin always keeps its text: shortened as far as TEXT_MIN_W, never dropped.
        if (text.w - over < TEXT_MIN_W && c.id !== selectedId) return null
        text = { ...text, w: Math.max(TEXT_MIN_W, text.w - over) }
        textW[c.id] = text.w
      }
      return tag ? { ...c, box: textWithTag(text, tag), own: [tag] } : { ...c, box: text }
    })
    .filter((c): c is TagCandidate => c != null)
  const labels = selectTags(
    textCands,
    viewport,
    zoom,
    i.previous.labels,
    seenCounts,
    {
      selectedId,
      cap: textCap(zoom),
      obstacles: [...obstacles, ...(i.labelObstacles ?? []), ...bubbleBoxes, ...tagged.values()],
    },
  )
  return { tags, bubbles, below, labels, textW: Object.fromEntries(Object.entries(textW).filter(([id]) => labels.includes(id))) }
}

/**
 * Bubble: max 168 wide (10 px sides). "@ Place" text/micro 12/16 (when the pin has a place), quote text/label 13/18
 * up to 2 lines, "500 m away" (+ "+2") text/micro, 7 px tail. Its tail tip sits 2 px above the disc.
 */
export const BUBBLE_MAX_W = 168
const BUBBLE_PAD_X = 10
const BUBBLE_TAIL = 7
/** Anchor (disc centre) to the bubble's bottom edge, tail included: disc radius (12) + 2. */
export const BUBBLE_BOTTOM = 14

export function bubbleBox(at: { x: number; y: number }, b: { place: string | null; quote: string; foot: string }): Box {
  const inner = BUBBLE_MAX_W - 2 * BUBBLE_PAD_X
  const quoteW = b.quote.length * 6.6
  const lines = Math.min(2, Math.max(1, Math.ceil(quoteW / inner)))
  const placeW = b.place ? 14 + b.place.length * 6.2 : 0
  const w = Math.ceil(Math.min(inner, Math.max(quoteW, placeW, b.foot.length * 6.2)) + 2 * BUBBLE_PAD_X)
  const h = 8 + (b.place ? 16 + 2 : 0) + lines * 18 + 2 + 16 + 8 + BUBBLE_TAIL
  const bottom = at.y - BUBBLE_BOTTOM
  return { x: at.x - w / 2, y: bottom - h, w, h }
}

/** The same bubble opened below the pin (tail up to the disc): starts BUBBLE_BELOW px under the centre, tail included. */
export const BUBBLE_BELOW = 14
export function bubbleBoxBelow(at: { x: number; y: number }, b: { place: string | null; quote: string; foot: string }): Box {
  const above = bubbleBox(at, b)
  return { ...above, y: at.y + BUBBLE_BELOW }
}

/**
 * Keeps a bubble on screen: slides it sideways (at most until the tail would reach its rounded corner) so it
 * stays `margin` px inside the screen. Returns the moved box and the slide (dx), which the tail undoes.
 */
export function clampBubble(box: Box, screenW: number, margin = 8): { box: Box; dx: number } {
  let dx = 0
  if (box.x < margin) dx = margin - box.x
  else if (box.x + box.w > screenW - margin) dx = screenW - margin - (box.x + box.w)
  const max = box.w / 2 - 16
  dx = Math.max(-max, Math.min(max, dx))
  return { box: { ...box, x: box.x + dx }, dx }
}

/**
 * Pins drawn on the same spot: only the top one (the selected pin, else the last drawn) may carry text, a tag or a
 * bubble. Otherwise the words of a hidden pin would sit beside the pin people can see. Returns the hidden pins' ids.
 */
export function coveredPins(pins: { id: string; at: { x: number; y: number } }[], selectedId: string | null, near = 6): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < pins.length; i++) {
    for (let j = 0; j < pins.length; j++) {
      if (i === j) continue
      const a = pins[i]
      const b = pins[j]
      if (Math.abs(a.at.x - b.at.x) > near || Math.abs(a.at.y - b.at.y) > near) continue
      // b is drawn over a when b is selected, or b comes later and a is not selected.
      if (a.id !== selectedId && (b.id === selectedId || j > i)) out.add(a.id)
    }
  }
  return out
}

/** Pin text: text/label 13/18, ink, paper halo, at most 120 wide (ellipsis), in the slot right of the pin. */
export const TEXT_MAX_W = 120
/** Shortest pin text worth showing (about 5 characters and an ellipsis). */
export const TEXT_MIN_W = 48
export const TEXT_TAG_GAP = 4
export function pinTextBox(at: { x: number; y: number }, selected: boolean, text: string): Box {
  const w = Math.ceil(Math.min(TEXT_MAX_W, text.length * 6.6)) + 4
  return { x: at.x + slotX(selected), y: at.y - 9, w, h: 18 } // centred on the disc (the anchor)
}

/** A Google place's dot plus its name (Markers .map-place): dot 10 at the anchor, name 11.5/14 starting 9 px right. */
export function placeNameBox(at: { x: number; y: number }, name: string): Box {
  return { x: at.x - 6, y: at.y - 7, w: 15 + Math.ceil(name.length * 6), h: 14 }
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
    // Fresh supports (last 3 h) still raise its rank; the "+N seen" tag is gone (2026-10-23, "+N" now means merged).
    const { fill, past } = ringState(pin, now)
    return {
      content: { kind: 'civic-timer', symbol: 'ring', value: `${daysOpen(pin, now)}d`, ringFill: fill, past },
      urgency: past ? 2 : freshU,
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
  if (pin.type === 'offer') {
    // A claimed place's deal: when it ends ("today", "to Sat"). Ranked a little lower (OFFER_FACTOR).
    const end = pin.endsAt ?? now
    return {
      content: { kind: 'offer', symbol: 'clock', value: sameDay(end, now) ? 'today' : `to ${WEEKDAYS[new Date(end).getDay()]}` },
      urgency: OFFER_FACTOR,
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

/** A merged lead's tag: how many OTHER neighbours posted the same thing at this spot (lib/merge). */
export function mergedContent(others: number): TagContent {
  return { kind: 'merged', symbol: 'none', value: `+${others}` }
}

/** Cluster tag: count of the most common type, "8 events" / "3 issues" / "2 asks". Null when only area pins. */
export function clusterContent(cluster: Cluster): TagContent {
  const counts: Record<string, number> = {}
  for (const p of cluster.pins) counts[p.type] = (counts[p.type] ?? 0) + 1
  const [type, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['civic', cluster.count]
  const noun: Record<string, [string, string]> = { event: ['event', 'events'], civic: ['issue', 'issues'], ask: ['ask', 'asks'], offer: ['offer', 'offers'] }
  const [one, many] = noun[type] ?? ['pin', 'pins']
  return { kind: 'cluster', symbol: 'none', value: `${n} ${n === 1 ? one : many}` }
}

// ---------- screen geometry ----------

/**
 * Marker bodies (2026-10-22, Google-sized round discs, no stem): anchored at the disc centre. Default: 24 disc;
 * selected: 32 disc in a 44 halo. Must match map.css .map-mk.
 */
export function markerBox(at: { x: number; y: number }, selected: boolean): Box {
  return selected ? { x: at.x - 22, y: at.y - 22, w: 44, h: 44 } : { x: at.x - 12, y: at.y - 12, w: 24, h: 24 }
}

/** Where the slot right of the pin starts (text or tag): 4 px right of the disc. */
function slotX(selected: boolean): number {
  return selected ? 20 : 16
}

/** Tag box beside a pin marker: starts 4 px right of the disc, vertically centred on the disc. */
export function pinTagBox(at: { x: number; y: number }, selected: boolean, value: string): Box {
  return { x: at.x + slotX(selected), y: at.y - TAG_H / 2, w: tagWidth(value), h: TAG_H } // centred on the disc
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

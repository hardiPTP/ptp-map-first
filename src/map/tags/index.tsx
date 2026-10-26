// Map tags (PRD "Map tags"), popups (bubbles) and pin text (DECISIONS.md 2026-10-22). Popups are Pulse on the
// map: any pin can get one, ranked by the feed's interest (importance and recency) and nearness to the view centre;
// a pin with a live comment shows its newest comment, any other pin its title. One plan per map
// idle (lib/tags planLayers), also on selection, filter and data arrival. No timers, no intervals, no animation frames.
// Pin text is Google style: the pin's title right of the pin, then its tag after it when it has one.
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, Tag } from '../../design/primitives'
import { awayText, BUBBLE_QUOTE_MAX, liveCountByPin, moreText, newestLiveByPin, quoteText } from '../../lib/comments'
import {
  bubbleBox,
  bubbleBoxBelow,
  clampBubble,
  clusterContent,
  coveredPins,
  clusterTagBox,
  markerBox,
  mergedContent,
  pinTextBox,
  pinTagBox,
  placeNameBox,
  planLayers,
  tagContent,
  toScreen,
  type Box,
  type TagCandidate,
  type TagContent,
} from '../../lib/tags'
import { interest } from '../../lib/rank'
import { eventWhen, offerWhen } from '../../sheet/format'
import { openPlace } from '../../sheet/openPlace'
import { BANDRA_WEST, useStore } from '../../store'
import { labelPlaces } from '../Markers'
import { mapPins } from '../visible'
import { clusterPins } from '../cluster'
import { createTagOverlay, type TagOverlay } from './overlay'
import { loadSeen, saveSeen } from './seen'
import './tags.css'

interface Shown {
  id: string
  lat: number
  lng: number
  content: TagContent
  selected: boolean
  /** Cluster target zoom, else undefined. */
  cluster?: boolean
}

/** Bubbles and labels have no tag content; their candidates only carry a box and a score. */
const NO_CONTENT: TagContent = { kind: 'ask', symbol: 'none', value: '' }

function cssPx(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

function Ring({ fill, past }: { fill: number; past: boolean }) {
  const r = 5.5
  const c = 2 * Math.PI * r
  return (
    <svg className={`map-tag__ring${past ? ' is-past' : ''}`} width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle className="map-tag__ring-track" cx="7" cy="7" r={r} />
      <circle
        className="map-tag__ring-fill"
        cx="7"
        cy="7"
        r={r}
        strokeDasharray={`${c * fill} ${c}`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  )
}

/** Closest existing glyphs: no hand in the icon set, so ask uses ic-heart (offer of help). */
function Symbol({ content }: { content: TagContent }) {
  switch (content.symbol) {
    case 'ring':
      return <Ring fill={content.ringFill ?? 0} past={!!content.past} />
    case 'clock':
      return <Icon name="ic-clock" size={14} />
    case 'avatar':
      // No Google place photos in this build (DECISIONS.md): show the event clock rather than an empty circle.
      return <Icon name="ic-clock" size={14} />
    case 'hand':
      return <Icon name="ic-heart" size={14} />
    default:
      return null
  }
}

function tone(c: TagContent): 'orange' | 'ink' {
  return c.past ? 'orange' : 'ink'
}

function TagButton({ t }: { t: Shown }) {
  const onClick = () => {
    const s = useStore.getState()
    if (t.cluster) {
      s.requestFlyTo({ lat: t.lat, lng: t.lng, zoom: s.viewport.zoom + 2 })
      return
    }
    const seen = loadSeen()
    seen[t.id] = 0
    saveSeen(seen)
    s.selectPin(t.id)
    s.openDetail(t.id)
  }
  const c = t.content
  return (
    <div className="map-tag-anchor" data-lat={t.lat} data-lng={t.lng} style={{ zIndex: t.selected ? 5 : 4 }}>
      <button
        type="button"
        className={`map-tag map-tag--${c.kind}${t.selected ? ' is-selected' : ''}${t.cluster ? ' is-cluster' : ''}`}
        aria-label={c.value}
        // A bigger tap target for the marker beside it, which already has the name and the same action: kept out
        // of the Tab order and the accessibility tree so each pin is one stop, not two (WCAG 2.4.3).
        tabIndex={-1}
        aria-hidden
        onClick={onClick}
      >
        <Tag symbol={<Symbol content={c} />} value={c.value} tone={tone(c)} />
      </button>
    </div>
  )
}

interface Bubble {
  id: string
  lat: number
  lng: number
  /** "@ Place": tappable when the pin is at a Google place (placeId), plain text for a street. */
  place: { placeId: string | null; name: string } | null
  /** The newest live comment in quotes, or the pin's title when it has none (`titled`). */
  quote: string
  titled: boolean
  /** "500 m away", plus " · Today, 5pm" for events and " · until Sat" for offers. */
  away: string
  /** "+2" more live comments, or null. */
  more: string | null
  /** Sideways slide that keeps the bubble on screen; the tail stays over the pin. */
  dx: number
  /** Opened below the pin, tail up. */
  below: boolean
}

interface Label {
  id: string
  lat: number
  lng: number
  text: string
  selected: boolean
  /** The pin's tag, drawn after the text. */
  tag: TagContent | null
  /** Shortened to fit the screen (px, box width incl. the 2 px halo each side), else undefined. */
  maxW?: number
}

/**
 * Speech bubble above a pin: "@ Place" on top (opens everything posted there), the newest live comment, then
 * "500 m away" and "+2" when there are more comments. The quote part opens the detail at its comments.
 */
function BubbleButton({ b }: { b: Bubble }) {
  const open = () => {
    const s = useStore.getState()
    const seen = loadSeen()
    seen[b.id] = 0
    saveSeen(seen)
    s.selectPin(b.id)
    // A comment popup opens the detail at its comments; a title popup at the top.
    s.openDetail(b.id, b.titled ? undefined : { section: 'comments' })
  }
  const place = b.place
  return (
    <div className="map-tag-anchor" data-lat={b.lat} data-lng={b.lng} style={{ zIndex: 6 }}>
      <div className={`map-bubble${b.below ? ' is-below' : ''}`} style={b.dx ? ({ '--bubble-dx': `${b.dx}px` } as React.CSSProperties) : undefined}>
        {place &&
          (place.placeId ? (
            <button
              type="button"
              className="map-bubble__at"
              aria-label={`Everything at ${place.name}`}
              onClick={() => openPlace({ placeId: place.placeId!, placeName: place.name, lat: b.lat, lng: b.lng })}
            >
              <span aria-hidden>@</span> {place.name}
            </button>
          ) : (
            <span className="map-bubble__at">
              <span aria-hidden>@</span> {place.name}
            </span>
          ))}
        <button
          type="button"
          className="map-bubble__main"
          aria-label={`${b.quote}, ${b.away}${b.more ? `, ${b.more.slice(1)} more` : ''}. ${b.titled ? 'Open' : 'Open comments'}`}
          onClick={open}
        >
          <span className="map-bubble__quote">{b.quote}</span>
          <span className="map-bubble__foot">
            <span>{b.away}</span>
            {b.more && <span className="map-bubble__more">{b.more}</span>}
          </span>
        </button>
      </div>
    </div>
  )
}

/** Pin text right of the pin (Google style), then the pin's tag after it. Tapping it opens the pin. */
function PinText({ l }: { l: Label }) {
  const onClick = () => {
    const s = useStore.getState()
    const seen = loadSeen()
    seen[l.id] = 0
    saveSeen(seen)
    s.selectPin(l.id)
    s.openDetail(l.id)
  }
  return (
    <div className="map-tag-anchor" data-lat={l.lat} data-lng={l.lng} style={{ zIndex: l.selected ? 5 : 3 }}>
      <button
        type="button"
        className={`map-text${l.selected ? ' is-selected' : ''}`}
        aria-label={[l.text, l.tag?.value].filter(Boolean).join(', ')}
        // The title is the marker's name already, with the same action (see TagButton).
        tabIndex={-1}
        aria-hidden
        onClick={onClick}
      >
        <span className="map-text__name" style={l.maxW ? { maxWidth: l.maxW - 4 } : undefined}>
          {l.text}
        </span>
        {l.tag && <Tag symbol={<Symbol content={l.tag} />} value={l.tag.value} tone={tone(l.tag)} />}
      </button>
    </div>
  )
}

export function MapTags() {
  const map = useMap()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<TagOverlay | null>(null)
  const [shown, setShown] = useState<Shown[]>([])
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const prevIds = useRef<Set<string>>(new Set())
  const prevBubbles = useRef<Set<string>>(new Set())
  const prevLabels = useRef<Set<string>>(new Set())
  const seenRef = useRef<Record<string, number> | null>(null)

  const viewport = useStore((s) => s.viewport)
  const selectedId = useStore((s) => s.selectedPinId)
  const filter = useStore((s) => s.filter)
  // The sheet moving changes which pins are in view (a user action, like selecting; never a timer).
  const sheetHeight = useStore((s) => s.sheetHeight)
  // Pins arriving (first load, a new post) also need tags; support counts alone do not trigger.
  const pinKey = useStore((s) => s.pins.length)
  // Same for comments arriving (first load, a comment going live). Never on a timer.
  const commentKey = useStore((s) => s.comments.length)
  // While placing a new pin the map belongs to that task: no tags under the place-name label (REVIEW #10).
  const creating = useStore((s) => s.create.step !== 'idle')

  useEffect(() => {
    if (!map) return
    const o = createTagOverlay(map, setHost)
    overlayRef.current = o
    return () => {
      o.setMap(null)
      overlayRef.current = null
      setHost(null)
    }
  }, [map])

  useEffect(() => {
    if (!map || !viewport.bounds) return
    const { pins, supports, comments, highlightedPinId, places, searchPlace, userLocation } = useStore.getState()
    // "500 m away": from where you are; before you share your location, from the area centre (as the place header).
    const from = userLocation ?? BANDRA_WEST
    const now = Date.now()
    const seen = (seenRef.current ??= loadSeen())
    if (selectedId && seen[selectedId]) seen[selectedId] = 0 // tapping the pin counts as a tap

    const div = map.getDiv()
    const w = div.clientWidth
    const h = div.clientHeight
    const top = cssPx('--top-bar-h', 112)
    // The sheet's resting height (not mid-transition), so a sheet move re-plans for the band people will see.
    const bottom = h - cssPx('--sheet-target', cssPx('--sheet-offset', 0))
    // Project from the map's own centre: always current, even when the sheet moved after the last idle.
    const c = map.getCenter()
    const mapCentre = c ? { lat: c.lat(), lng: c.lng() } : viewport.center
    const centreScreen = c ? { x: w / 2, y: h / 2 } : { x: w / 2, y: (top + bottom) / 2 }
    const at = (p: { lat: number; lng: number }) => toScreen(p, mapCentre, viewport.zoom, centreScreen)
    const inBand = (pt: { x: number; y: number }) => pt.x >= 0 && pt.x <= w && pt.y >= top && pt.y <= bottom

    // Similar pins at one spot are merged into their lead (lib/merge), exactly as Markers draws them.
    const { pins: live, others: merged } = mapPins(pins, supports, filter, now, selectedId)
    const keep = new Set([selectedId, highlightedPinId].filter((x): x is string => !!x))
    const { singles, clusters } = clusterPins(live, viewport.zoom, { keepSingle: keep })

    const candidates: TagCandidate[] = []
    const bubbleCands: TagCandidate[] = []
    const labelCands: TagCandidate[] = []
    const info = new Map<string, Shown>()
    const bubbleInfo = new Map<string, Bubble>()
    const labelInfo = new Map<string, Label>()
    const newest = newestLiveByPin(comments)
    const liveCount = liveCountByPin(comments)
    const fits = (b: Box) => b.x >= 0 && b.x + b.w <= w && b.y >= top && b.y + b.h <= bottom
    const obstacles: Box[] = []
    // The floating buttons (zoom, locate, + Pin) sit over the map: nothing is drawn under them. Placed where they
    // will rest (12 px above the sheet's resting height, as app.css does), not mid-transition.
    const fabs = document.querySelector('.app-fabs')?.getBoundingClientRect()
    if (fabs && fabs.width > 0) {
      const fabBottom = bottom - 12
      obstacles.push({ x: fabs.left - 4, y: fabBottom - fabs.height - 4, w: fabs.width + 8, h: fabs.height + 8 })
    }
    // Same stacking as Markers: the selected pin on top, else the last drawn (the feed highlight does not raise).
    const hidden = coveredPins(singles.map((p) => ({ id: p.id, at: at(p) })), selectedId ?? null)
    for (const p of singles) {
      const pt = at(p)
      const sel = p.id === selectedId
      const mb = markerBox(pt, sel || p.id === highlightedPinId)
      obstacles.push(mb)
      if (hidden.has(p.id)) continue // under another pin: its words would read as that pin's
      // A merged lead's tag says how many others posted the same thing here ("+2"), instead of its usual tag.
      const n = merged.get(p.id)?.length ?? 0
      const own = tagContent(p, supports, now)
      const tc = n && own ? { content: mergedContent(n), urgency: own.urgency } : own
      // Pin text: the post's own title (what it is), never who posted it. Ranked like tags (urgency, nearness).
      const text = p.title.trim()
      if (text && (inBand(pt) || sel)) {
        const box = pinTextBox(pt, sel, text)
        if (sel || box.x + box.w <= w) {
          labelCands.push({ id: p.id, lat: p.lat, lng: p.lng, content: NO_CONTENT, urgency: tc?.urgency ?? 1, box, markerBox: mb })
          labelInfo.set(p.id, { id: p.id, lat: p.lat, lng: p.lng, text, selected: sel, tag: null })
        }
      }
      // Popup: any pin. Its newest live comment, else its own title.
      const comment = newest.get(p.id)
      if (!sel && inBand(pt)) {
        const titled = !comment
        const quote = comment ? `\u201c${quoteText(comment.text, BUBBLE_QUOTE_MAX)}\u201d` : p.title.trim()
        const placeName = p.placeName?.trim() || null
        const place = placeName ? { placeId: p.placeId ?? null, name: placeName } : null
        const when =
          p.type === 'event' && p.startsAt != null
            ? eventWhen(p.startsAt, now)
            : p.type === 'offer'
              ? offerWhen(p.endsAt, now).replace(/^Offer · /, '')
              : null
        const away = [awayText(from, p), when].filter(Boolean).join(' · ')
        const more = moreText(liveCount.get(p.id) ?? 0)
        const words = { place: placeName ? `@ ${placeName}` : null, quote, foot: more ? `${away}  ${more}` : away }
        const { box, dx } = clampBubble(bubbleBox(pt, words), w)
        // Below the pin when the spot above is taken (same sideways slide, so dx holds for both).
        const low = clampBubble(bubbleBoxBelow(pt, words), w).box
        const spots = [box, low].filter(fits)
        if (spots.length) {
          bubbleCands.push({
            id: p.id, lat: p.lat, lng: p.lng, content: NO_CONTENT, urgency: interest(p, supports, now),
            box: spots[0], alts: spots.slice(1), markerBox: mb,
          })
          bubbleInfo.set(p.id, { id: p.id, lat: p.lat, lng: p.lng, place, quote, titled, away, more, dx, below: spots[0] === low })
        }
      }
      if (!tc || (!inBand(pt) && !sel)) continue
      // At zoom 13 and below only cluster counts show (plus the selected pin's tag).
      if (viewport.zoom <= 13 && !sel) continue
      const box = pinTagBox(pt, sel, tc.content.value)
      if (!sel && (box.x < 0 || box.x + box.w > w)) continue // never clip a tag at the screen edge (REVIEW #15)
      candidates.push({ id: p.id, lat: p.lat, lng: p.lng, content: tc.content, urgency: tc.urgency, box, markerBox: mb })
      info.set(p.id, { id: p.id, lat: p.lat, lng: p.lng, content: tc.content, selected: sel })
    }
    for (const c of clusters) {
      const pt = at(c)
      if (!inBand(pt)) continue
      const content = clusterContent(c)
      candidates.push({ id: c.id, lat: c.lat, lng: c.lng, content, urgency: 1, box: clusterTagBox(pt, content.value) })
      info.set(c.id, { id: c.id, lat: c.lat, lng: c.lng, content, selected: false, cluster: true })
      obstacles.push({ x: pt.x - 22, y: pt.y - 22, w: 44, h: 44 })
    }

    // Google place names drawn by the places layer (same rule as Markers): pin labels must not land on them.
    const named = labelPlaces(places, viewport.zoom)
    const labelObstacles = places
      .filter((pl) => named.has(pl.id) || pl.id === searchPlace?.placeId)
      .map((pl) => placeNameBox(at(pl), pl.name))
    const plan = planLayers({
      tags: candidates,
      bubbles: bubbleCands,
      titled: new Set([...bubbleInfo.values()].filter((b) => b.titled).map((b) => b.id)),
      labels: labelCands,
      zoom: viewport.zoom,
      viewport: { center: viewport.center },
      selectedId,
      obstacles,
      labelObstacles,
      screenW: w,
      previous: { tags: prevIds.current, bubbles: prevBubbles.current, labels: prevLabels.current },
      seenCounts: seen,
    })
    // A show = a tag or bubble newly appearing on a pin. Staying put through a pan is not a new show.
    for (const id of [...plan.tags, ...plan.bubbles])
      if (!prevIds.current.has(id) && !prevBubbles.current.has(id)) seen[id] = (seen[id] ?? 0) + 1
    saveSeen(seen)
    prevIds.current = new Set(plan.tags)
    prevBubbles.current = new Set(plan.bubbles)
    prevLabels.current = new Set(plan.labels)
    // A pin with text draws its tag after the text (one control); the rest draw the tag alone.
    const withText = new Set(plan.labels)
    setShown(plan.tags.filter((id) => !withText.has(id)).map((id) => info.get(id)!).filter(Boolean))
    setBubbles(
      plan.bubbles
        .map((id) => bubbleInfo.get(id))
        .filter((b): b is Bubble => !!b)
        .map((b) => ({ ...b, below: b.below || plan.below.includes(b.id) })),
    )
    setLabels(
      plan.labels
        .map((id) => labelInfo.get(id))
        .filter((l): l is Label => !!l)
        .map((l) => ({ ...l, tag: plan.tags.includes(l.id) ? (info.get(l.id)?.content ?? null) : null, maxW: plan.textW[l.id] })),
    )
    // Deliberately only these inputs: pans (idle), selection, filter, sheet height, pin and comment arrivals.
  }, [map, viewport, selectedId, filter, sheetHeight, pinKey, commentKey])

  useLayoutEffect(() => {
    overlayRef.current?.draw()
  })

  if (!host || creating) return null
  return createPortal(
    <>
      {labels.map((l) => (
        <PinText key={`l-${l.id}`} l={l} />
      ))}
      {shown.map((t) => (
        <TagButton key={t.id} t={t} />
      ))}
      {bubbles.map((b) => (
        <BubbleButton key={`b-${b.id}`} b={b} />
      ))}
    </>,
    host,
  )
}

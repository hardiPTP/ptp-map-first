// Map tags (PRD "Map tags"). Recomputed ONLY when the viewport changes (map idle) or the selection changes.
// No timers, no intervals, no animation frames.
import { useMap } from '@vis.gl/react-google-maps'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, Tag } from '../../design/primitives'
import {
  clusterContent,
  clusterTagBox,
  markerBox,
  pinTagBox,
  selectTags,
  tagContent,
  toScreen,
  type Box,
  type TagCandidate,
  type TagContent,
} from '../../lib/tags'
import { useStore } from '../../store'
import { visiblePins } from '../visible'
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
    case 'arrow-up':
      return <span className="map-tag__arrow"><Icon name="ic-chevD" size={14} style={{ transform: 'rotate(180deg)' }} /></span>
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
  const tone = c.kind === 'civic-busy' || c.past ? 'orange' : 'ink'
  return (
    <div className="map-tag-anchor" data-lat={t.lat} data-lng={t.lng} style={{ zIndex: t.selected ? 5 : 4 }}>
      <button
        type="button"
        className={`map-tag map-tag--${c.kind}${t.selected ? ' is-selected' : ''}${t.cluster ? ' is-cluster' : ''}`}
        aria-label={c.value}
        onClick={onClick}
      >
        <Tag symbol={<Symbol content={c} />} value={c.value} tone={tone} />
      </button>
    </div>
  )
}

export function MapTags() {
  const map = useMap()
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const overlayRef = useRef<TagOverlay | null>(null)
  const [shown, setShown] = useState<Shown[]>([])
  const prevIds = useRef<Set<string>>(new Set())
  const seenRef = useRef<Record<string, number> | null>(null)

  const viewport = useStore((s) => s.viewport)
  const selectedId = useStore((s) => s.selectedPinId)
  const filter = useStore((s) => s.filter)
  // Pins arriving (first load, a new post) also need tags; support counts alone do not trigger.
  const pinKey = useStore((s) => s.pins.length)
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
    const { pins, supports, highlightedPinId } = useStore.getState()
    const now = Date.now()
    const seen = (seenRef.current ??= loadSeen())
    if (selectedId && seen[selectedId]) seen[selectedId] = 0 // tapping the pin counts as a tap

    const div = map.getDiv()
    const w = div.clientWidth
    const h = div.clientHeight
    const top = cssPx('--top-bar-h', 156)
    const bottom = h - cssPx('--sheet-offset', 0)
    const centreScreen = { x: w / 2, y: (top + bottom) / 2 }
    const at = (p: { lat: number; lng: number }) => toScreen(p, viewport.center, viewport.zoom, centreScreen)
    const inBand = (pt: { x: number; y: number }) => pt.x >= 0 && pt.x <= w && pt.y >= top && pt.y <= bottom

    const live = visiblePins(pins, supports, filter, now)
    const keep = new Set([selectedId, highlightedPinId].filter((x): x is string => !!x))
    const { singles, clusters } = clusterPins(live, viewport.zoom, { keepSingle: keep })

    const candidates: TagCandidate[] = []
    const info = new Map<string, Shown>()
    const obstacles: Box[] = []
    for (const p of singles) {
      const pt = at(p)
      const sel = p.id === selectedId
      const mb = markerBox(pt, sel || p.id === highlightedPinId)
      obstacles.push(mb)
      const tc = tagContent(p, supports, now)
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

    const ids = selectTags(candidates, { center: viewport.center }, viewport.zoom, prevIds.current, seen, { selectedId, obstacles })
    // A show = a tag newly appearing. Staying put through a pan is not a new show.
    for (const id of ids) if (!prevIds.current.has(id)) seen[id] = (seen[id] ?? 0) + 1
    saveSeen(seen)
    prevIds.current = new Set(ids)
    setShown(ids.map((id) => info.get(id)!).filter(Boolean))
    // Deliberately only these inputs: pans (idle), selection, filter, pin arrivals.
  }, [map, viewport, selectedId, filter, pinKey])

  useLayoutEffect(() => {
    overlayRef.current?.draw()
  })

  if (!host || creating) return null
  return createPortal(shown.map((t) => <TagButton key={t.id} t={t} />), host)
}

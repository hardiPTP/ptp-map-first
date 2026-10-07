// Bottom sheet: peek (header only) / half (default) / full (list, map strip left above).
// Drag the handle (pointer events, snap with velocity) or tap it to cycle peek > half > full > half.
// Publishes the visible height in px as --sheet-offset on <html> (the app floats locate / + Pin with it).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { Grabber, SheetSurface } from '../design/primitives'
import { useStore } from '../store'
import type { SheetHeight } from '../types'

const HALF_FRACTION = 0.62 // Gate 3: room for the area strip plus one whole card
/** Fallback for the agent D top bar height; tune with --top-bar-h on :root. */
const TOP_BAR_FALLBACK = 156
const MAP_STRIP_PX = 56
const TAP_SLOP = 6
const FLICK_PROJECT_MS = 160

export function nextHeight(h: SheetHeight): SheetHeight {
  return h === 'peek' ? 'half' : h === 'half' ? 'full' : 'half'
}

/** Snap to the nearest height after projecting the release by its velocity (px/ms, negative = up). */
export function snapTo(current: number, velocity: number, snaps: Record<SheetHeight, number>): SheetHeight {
  const projected = current - velocity * FLICK_PROJECT_MS
  let best: SheetHeight = 'half'
  let bd = Infinity
  for (const k of ['peek', 'half', 'full'] as SheetHeight[]) {
    const d = Math.abs(snaps[k] - projected)
    if (d < bd) { bd = d; best = k }
  }
  return best
}

function topBarPx(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-bar-h'))
  return Number.isFinite(v) ? v : TOP_BAR_FALLBACK
}

export function BottomSheet({
  header,
  children,
  scrollRef,
  onHeaderPill,
}: {
  header: (height: SheetHeight, pill: () => void) => ReactNode
  children: ReactNode
  scrollRef: React.RefObject<HTMLDivElement | null>
  onHeaderPill?: () => void
}) {
  const height = useStore((s) => s.sheetHeight)
  const setHeight = useStore((s) => s.setSheetHeight)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ wrap: typeof window === 'undefined' ? 800 : window.innerHeight, head: 64, safe: 0 })
  const [dragPx, setDragPx] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; v: number; moved: boolean; id: number } | null>(null)

  // measure wrapper, header and safe-area padding
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current
      const head = headRef.current
      const sheet = sheetRef.current
      if (!wrap || !head || !sheet) return
      const safe = parseFloat(getComputedStyle(sheet).paddingBottom) || 0
      setDims((d) => {
        const n = { wrap: wrap.clientHeight || d.wrap, head: head.offsetHeight, safe }
        return n.wrap === d.wrap && n.head === d.head && n.safe === d.safe ? d : n
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    if (headRef.current) ro.observe(headRef.current)
    return () => ro.disconnect()
  }, [])

  const snaps: Record<SheetHeight, number> = {
    peek: dims.head + dims.safe,
    half: Math.round(dims.wrap * HALF_FRACTION),
    full: dims.wrap - topBarPx() - MAP_STRIP_PX,
  }
  const shown = dragPx ?? snaps[height]

  // --sheet-offset follows the real rendered height (also during transitions)
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--sheet-offset', `${el.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const el = sheetRef.current
    if (el) document.documentElement.style.setProperty('--sheet-offset', `${el.offsetHeight}px`)
  }, [shown])

  const cycle = useCallback(() => setHeight(nextHeight(useStore.getState().sheetHeight)), [setHeight])
  const pill = useCallback(() => {
    setHeight(useStore.getState().sheetHeight === 'full' ? 'peek' : 'full')
    onHeaderPill?.()
  }, [setHeight, onHeaderPill])

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { startY: e.clientY, startH: sheetRef.current?.offsetHeight ?? snaps[height], lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return
    d.moved = true
    const dt = Math.max(1, e.timeStamp - d.lastT)
    d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    setDragPx(Math.min(snaps.full, Math.max(snaps.peek, d.startH - dy)))
  }
  const onPointerUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      cycle()
      return
    }
    const current = Math.min(snaps.full, Math.max(snaps.peek, d.startH - (e.clientY - d.startY)))
    setDragPx(null)
    setHeight(snapTo(current, d.v, snaps))
  }
  // Pointer taps and drags are handled on pointerup; a click with detail 0 is keyboard (Enter / Space).
  const onClick = (e: React.MouseEvent) => {
    if (e.detail === 0) cycle()
  }

  return (
    <div className="sheet-wrap" ref={wrapRef}>
      <SheetSurface
        {...({ ref: sheetRef } as object)}
        className={['sheet', `sheet--${height}`, dragPx != null && 'is-dragging'].filter(Boolean).join(' ')}
        style={{ height: shown }}
        data-height={height}
      >
        <div ref={headRef} className="sheet__top">
          <button
            type="button"
            className="sheet__handle"
            aria-label={`Resize sheet, now ${height}. Tap to change.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { drag.current = null; setDragPx(null) }}
            onClick={onClick}
          >
            <Grabber />
          </button>
          {header(height, pill)}
        </div>
        <div className={['sheet__scroll', height === 'peek' && 'is-locked'].filter(Boolean).join(' ')} ref={scrollRef}>
          {children}
        </div>
      </SheetSurface>
    </div>
  )
}

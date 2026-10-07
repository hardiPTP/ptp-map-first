// Long-press on the map (500 ms, under 10 px movement) -> startCreate at that spot.
// LatLng from the pointer via the overlay projection (MapCanvasProjection.fromContainerPixelToLatLng).
import { useEffect, type RefObject } from 'react'
import { useStore } from '../store'
import type { MarkerOverlay } from './overlay'

export const LONG_PRESS_MS = 500
export const LONG_PRESS_SLOP_PX = 10
let suppressClickUntil = 0
/** True right after a long-press fired, so the trailing map click does not deselect. */
export function clickSuppressed() {
  return performance.now() < suppressClickUntil
}

export function useLongPress(map: google.maps.Map | null, overlayRef: RefObject<MarkerOverlay | null>) {
  useEffect(() => {
    if (!map) return
    const div = map.getDiv()
    let timer: ReturnType<typeof setTimeout> | null = null
    let startX = 0
    let startY = 0
    const pointers = new Set<number>()
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId)
      if (pointers.size > 1) return cancel() // pinch
      if (e.button > 0 || (e.target as Element).closest('.map-anchor, button')) return
      startX = e.clientX
      startY = e.clientY
      cancel()
      timer = setTimeout(() => {
        timer = null
        const r = div.getBoundingClientRect()
        const at = overlayRef.current?.latLngFromContainerPx(startX - r.left, startY - r.top)
        if (!at) return
        suppressClickUntil = performance.now() + 600
        useStore.getState().startCreate({ at, skipToDetails: true })
      }, LONG_PRESS_MS)
    }
    const move = (e: PointerEvent) => {
      if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > LONG_PRESS_SLOP_PX) cancel()
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      cancel()
    }
    const ctx = (e: Event) => e.preventDefault()
    div.addEventListener('pointerdown', down, true)
    div.addEventListener('pointermove', move, true)
    div.addEventListener('pointerup', up, true)
    div.addEventListener('pointercancel', up, true)
    div.addEventListener('contextmenu', ctx)
    const l1 = map.addListener('dragstart', cancel)
    const l2 = map.addListener('zoom_changed', cancel)
    return () => {
      cancel()
      div.removeEventListener('pointerdown', down, true)
      div.removeEventListener('pointermove', move, true)
      div.removeEventListener('pointerup', up, true)
      div.removeEventListener('pointercancel', up, true)
      div.removeEventListener('contextmenu', ctx)
      l1.remove()
      l2.remove()
    }
  }, [map, overlayRef])
}

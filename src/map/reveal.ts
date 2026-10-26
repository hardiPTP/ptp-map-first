// Keyboard focus on a map marker that sits under the top bar, the sheet or off screen would be hidden (WCAG 2.4.11
// focus not obscured). Such a marker is brought into the visible band through the usual fly-to (a user action, so the
// tags then re-plan on idle as for any camera move). Pointer taps never get here: they only fire on :focus-visible.
import { useStore } from '../store'

function cssPx(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/** True when `r` lies inside the band people can see: below the top bar (or detail header), above the sheet (or card). */
export function inVisibleBand(r: { top: number; bottom: number; left: number; right: number }, w: number, h: number): boolean {
  const top = cssPx('--detail-top', cssPx('--top-bar-h', 112))
  const bottom = h - cssPx('--detail-bottom', cssPx('--sheet-offset', 0))
  return r.top >= top && r.bottom <= bottom && r.left >= 0 && r.right <= w
}

export function revealOnFocus(e: React.FocusEvent<HTMLElement>, at: { lat: number; lng: number }): void {
  const el = e.currentTarget
  if (typeof el.matches === 'function' && !safeMatches(el, ':focus-visible')) return
  if (inVisibleBand(el.getBoundingClientRect(), window.innerWidth, window.innerHeight)) return
  useStore.getState().requestFlyTo({ lat: at.lat, lng: at.lng })
}

function safeMatches(el: Element, sel: string): boolean {
  try {
    return el.matches(sel)
  } catch {
    return false // engines without :focus-visible: treat as a pointer focus and leave the map alone
  }
}

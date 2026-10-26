// Modal behaviour for the sheets that sit over the page (WCAG 2.1.2, 2.4.3, 4.1.2): focus moves into the dialog
// when it opens, Tab and Shift+Tab stay inside it, Escape closes it, the page behind is inert while it is open,
// and focus goes back to the control that opened it when it closes.
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keyboard-focusable elements inside `root`, in DOM order. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && !el.closest('[inert]'),
  )
}

/** Keeps Tab inside `root`: from the last control to the first and back. */
export function trapTab(e: KeyboardEvent | globalThis.KeyboardEvent, root: HTMLElement): void {
  if (e.key !== 'Tab') return
  const list = focusables(root)
  if (list.length === 0) {
    e.preventDefault()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === root || !root.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

// Sheets can stack (a claim sheet over nothing else today, but cheap to get right): #root stays inert until the last closes.
let openCount = 0

/**
 * Give the returned onKeyDown to the dialog element (tabIndex -1). The app shell (#root) is made inert while it is
 * open; dialogs are portalled to <body>, outside it.
 */
export function useModal(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const opener = document.activeElement
    const root = document.getElementById('root')
    if (root) {
      openCount++
      root.inert = true
    }
    ref.current?.focus()
    return () => {
      if (root && --openCount === 0) root.inert = false
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [ref])

  return (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeRef.current()
    } else if (ref.current) trapTab(e, ref.current)
  }
}

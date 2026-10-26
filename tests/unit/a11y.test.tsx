// Accessibility checks (docs/A11Y.md): axe-core on the rendered components (jsdom, Google mocked), plus the
// keyboard, focus and live-region behaviour axe cannot see, and the token contrast ratios (WCAG 1.4.3 / 1.4.11).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/data', () => ({ repo: { toggleSupport: vi.fn(), claimPlace: vi.fn(), addComment: vi.fn() } }))
// Google is mocked: no places library, no map.
vi.mock('@vis.gl/react-google-maps', () => ({ useMapsLibrary: () => null, useMap: () => null }))

import KitchenSink from '../../src/design/KitchenSink'
import { markerLabel } from '../../src/map/Markers'
import { stepHeight } from '../../src/sheet/BottomSheet'
import { SheetLayer } from '../../src/sheet'
import { PinCard } from '../../src/sheet/PinCard'
import { BANDRA_WEST, useStore } from '../../src/store'
import { TopBar } from '../../src/top'
import { AccountSheet } from '../../src/top/Sheets'
import type { Pin } from '../../src/types'

const now = Date.now()
const H = 3600_000
const pin = (o: Partial<Pin>): Pin => ({
  id: 'p1', type: 'civic', title: 'Streetlight out near the gate', lat: BANDRA_WEST.lat, lng: BANDRA_WEST.lng,
  createdAt: now - H, createdBy: 'device-secret-id', postedAs: 'neighbour', status: 'active', ...o,
})

/** axe in jsdom: no layout, so colour contrast is checked from the tokens below instead; fragments have no landmarks. */
async function violations(el: Element) {
  const r = await axe.run(el, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    pins: [pin({}), pin({ id: 'p2', type: 'event', title: 'Quiz night', placeName: 'The Cafe', startsAt: now + 3 * H })],
    supports: [],
    comments: [],
    deviceId: 'me',
    sheetHeight: 'half',
    filter: 'all',
    searchPlace: null,
    detailPinId: null,
    viewport: { bounds: null, zoom: 15, center: BANDRA_WEST },
  })
})

describe('axe (WCAG 2.2 A/AA rules that work without layout)', () => {
  it('kitchen sink primitives', async () => {
    const { container } = render(<KitchenSink />)
    expect(await violations(container)).toEqual([])
  })
  it('a feed card', async () => {
    const { container } = render(<PinCard pin={pin({ placeId: 'gp-1', placeName: 'Hill Road' })} origin={BANDRA_WEST} now={now} count={3} supported={false} />)
    expect(await violations(container)).toEqual([])
  })
  it('the sheet with its header and feed', async () => {
    const { container } = render(<SheetLayer />)
    expect(await violations(container)).toEqual([])
  })
  it('the top bar with search results open', async () => {
    const { container } = render(<TopBar />)
    const input = screen.getByRole('combobox', { name: 'Search places, pins and events' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'quiz' } })
    expect(await violations(container)).toEqual([])
    expect(await violations(document.querySelector('.top-results')!)).toEqual([])
  })
  it('the account sheet', async () => {
    render(<AccountSheet onClose={() => {}} />)
    expect(await violations(screen.getByRole('dialog'))).toEqual([])
  })
})

describe('bottom sheet without dragging (WCAG 2.5.7, 2.1.1)', () => {
  it('Enter / click on the handle cycles; arrow keys step', () => {
    render(<SheetLayer />)
    const handle = screen.getByRole('button', { name: /Resize the list, now half height/ })
    fireEvent.click(handle) // keyboard Enter and screen reader activation arrive as a click
    expect(useStore.getState().sheetHeight).toBe('full')
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(useStore.getState().sheetHeight).toBe('half')
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(useStore.getState().sheetHeight).toBe('peek')
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(useStore.getState().sheetHeight).toBe('peek')
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(useStore.getState().sheetHeight).toBe('half')
  })
  it('stepHeight stops at the ends', () => {
    expect(stepHeight('full', 1)).toBe('full')
    expect(stepHeight('peek', -1)).toBe('peek')
    expect(stepHeight('half', 1)).toBe('full')
  })
  it('focus landing in the list at peek raises it to half (WCAG 2.4.11)', () => {
    useStore.setState({ sheetHeight: 'peek' })
    render(<SheetLayer />)
    act(() => screen.getByRole('button', { name: 'Quiz night' }).focus())
    expect(useStore.getState().sheetHeight).toBe('half')
  })
  it('is a labelled region with the count line as a polite live region', () => {
    render(<SheetLayer />)
    expect(screen.getByRole('region', { name: 'Pulse' })).toBeInTheDocument()
    expect(document.querySelector('.sheet-header__sub')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('search combobox (WCAG 4.1.2, 4.1.3, 2.1.1)', () => {
  it('arrow keys choose a result through aria-activedescendant, Enter opens it, the count is announced', () => {
    render(<TopBar />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'quiz' } })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const option = screen.getByRole('option', { name: /Quiz night/ })
    expect(option).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', option.id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useStore.getState().detailPinId).toBe('p2')
  })
  it('says when nothing is found', () => {
    render(<TopBar />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.getByRole('status')).toHaveTextContent('Nothing found yet.')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('sheets are modal (WCAG 2.1.2, 2.4.3)', () => {
  it('focus moves in, Tab wraps, Escape closes, the page is inert, focus returns to the opener', () => {
    const root = document.createElement('div')
    root.id = 'root'
    const opener = document.createElement('button')
    opener.textContent = 'Your account'
    root.appendChild(opener)
    document.body.appendChild(root)
    opener.focus()
    const onClose = vi.fn()
    const { unmount } = render(<AccountSheet onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Your account' })
    expect(document.activeElement).toBe(dialog)
    expect(root.inert).toBe(true)
    const buttons = Array.from(dialog.querySelectorAll('button'))
    buttons[buttons.length - 1].focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Close' })[0])
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    unmount()
    expect(root.inert).toBe(false)
    expect(document.activeElement).toBe(opener)
    root.remove()
  })
})

describe('marker names (WCAG 1.1.1)', () => {
  it('say the type the glyph shows, the place for a place post, merges and the pulse', () => {
    expect(markerLabel(pin({}), 0, false)).toBe('Issue: Streetlight out near the gate')
    expect(markerLabel(pin({ type: 'offer', title: '20% off', postedAs: 'place', placeName: 'Trilogy' }), 2, true)).toBe(
      'Offer: 20% off, posted by Trilogy, and 2 similar posts here, recent activity',
    )
  })
})

// ---------- Contrast from tokens.css (WCAG 1.4.3 text 4.5:1, 1.4.11 UI 3:1) ----------
const css = readFileSync(resolve(process.cwd(), 'src/design/tokens.css'), 'utf8')
function token(name: string): [number, number, number, number] {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`no token ${name}`)
  const v = m[1].trim()
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1) as [number, number, number, number]
  const n = v.match(/[\d.]+/g)!.map(Number)
  return [n[0], n[1], n[2], n[3] ?? 1]
}
const over = (fg: number[], bg: number[]) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]))
const lum = (c: number[]) => {
  const s = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
}
function ratio(fg: string, bg: string): number {
  const b = token(bg)
  const f = over(token(fg), b)
  const [x, y] = [lum(f), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('token contrast pairs used by the app', () => {
  const text: [string, string, string][] = [
    ['colour-ink-100', 'surface-canvas', 'body text'],
    ['colour-ink-80', 'surface-well', 'notice rows, labels'],
    ['colour-ink-60', 'surface-paper', 'meta lines, counts'],
    ['colour-ink-60', 'surface-well', 'placeholders, meta on wells'],
    ['colour-accent-cream', 'colour-accent-orange-deep', 'primary button, selected chip'],
    ['colour-accent-orange-deep', 'surface-paper', 'selected chip count, "@ Place", claim link'],
    ['colour-accent-orange-deep', 'colour-accent-orange-soft', 'soft button'],
    ['surface-paper', 'colour-ink-100', 'snack'],
  ]
  it.each(text)('%s on %s (%s) is at least 4.5:1', (fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5))
  const ui: [string, string, string][] = [
    ['colour-accent-orange', 'surface-canvas', 'focus ring'],
    ['colour-accent-orange', 'surface-paper', 'focus ring, civic marker, send button'],
    ['colour-ink-60', 'surface-well', 'grabber, place dots on the map'],
  ]
  it.each(ui)('%s on %s (%s) is at least 3:1', (fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3))
  it('documents why ink-45 and orange are not used for text', () => {
    expect(ratio('colour-ink-45', 'surface-paper')).toBeLessThan(4.5)
    expect(ratio('surface-paper', 'colour-accent-orange')).toBeLessThan(4.5)
  })
})

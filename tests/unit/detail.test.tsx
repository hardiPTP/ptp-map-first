import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/data', () => ({ repo: { toggleSupport: vi.fn().mockResolvedValue({ supported: true }) } }))

import { DetailLayer } from '../../src/detail'
import { BANDRA_WEST, useStore } from '../../src/store'
import { buildFeed } from '../../src/sheet/useFeed'
import type { Pin } from '../../src/types'

const H = 3600_000
const now = Date.now()
let n = 0
const pin = (o: Partial<Pin> = {}): Pin => ({
  id: `p${++n}`, type: 'ask', title: `Synthetic title ${n}`, lat: BANDRA_WEST.lat, lng: BANDRA_WEST.lng,
  createdAt: now - 1 * H, createdBy: 'device-secret-id', postedAs: 'neighbour', status: 'active', ...o,
})

function setup(pins: Pin[], open: string | null) {
  useStore.setState({
    pins, supports: [], detailPinId: open, selectedPinId: null, filter: 'all', searchPlace: null, flyTo: null,
    viewport: { bounds: null, zoom: 15, center: BANDRA_WEST }, deviceId: 'me',
  })
}

beforeEach(() => {
  cleanup()
  n = 0
})

describe('DetailLayer', () => {
  it('renders nothing without detailPinId and closes area pins', () => {
    const area = pin({ type: 'area', postedAs: 'ptp', title: 'Water cut' })
    setup([area], null)
    const { container } = render(<DetailLayer />)
    expect(container).toBeEmptyDOMElement()
    act(() => useStore.getState().openDetail(area.id))
    expect(useStore.getState().detailPinId).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows poster labels only, never a user name', () => {
    const a = pin({ type: 'civic', postedAs: 'neighbour', createdBy: 'Asha Rao' })
    setup([a], a.id)
    localStorage.setItem('ptp.displayName', 'Asha Rao')
    render(<DetailLayer />)
    expect(screen.getByText('Neighbour')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Asha')
    expect(document.body.textContent).not.toContain('device-secret-id')
  })

  it('uses the one action label per type', () => {
    for (const [type, label] of [['civic', 'I see it too'], ['event', "I'm going"], ['ask', 'I can help']] as const) {
      const p = pin({ type, startsAt: now + 2 * H })
      setup([p], p.id)
      const { unmount } = render(<DetailLayer />)
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      unmount()
    }
  })

  it('civic shows days open, event shows directions, ask shows how long ago', () => {
    const c = pin({ type: 'civic', createdAt: now - 3 * 24 * H })
    setup([c], c.id)
    const r = render(<DetailLayer />)
    expect(screen.getByText('Open 3 days')).toBeInTheDocument()
    r.unmount()
    const e = pin({ type: 'event', startsAt: now + 2 * H, placeName: 'Some Hall' })
    setup([e], e.id)
    const r2 = render(<DetailLayer />)
    expect(screen.getByRole('link', { name: /Directions/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir'))
    r2.unmount()
    const a = pin({ type: 'ask', createdAt: now - 2 * H })
    setup([a], a.id)
    render(<DetailLayer />)
    expect(screen.getByText('Asked 2 hrs ago')).toBeInTheDocument()
  })

  it('next and previous follow the feed order, one segment per item', () => {
    const list = [pin({ createdAt: now - 10 * 60_000 }), pin({ createdAt: now - 20 * 60_000 }), pin({ createdAt: now - 30 * 60_000 })]
    setup(list, list[0].id)
    render(<DetailLayer />)
    const s0 = useStore.getState()
    const order = buildFeed({ pins: s0.pins, supports: [], filter: 'all', bounds: null, searchPlaceId: null, origin: BANDRA_WEST, now }).items.map((p) => p.id)
    expect(order).toHaveLength(3)
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 1 of 3')
    const first = useStore.getState().detailPinId
    expect(first).toBe(list[0].id)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const second = useStore.getState().detailPinId
    expect(second).toBe(order[order.indexOf(first as string) + 1])
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 2 of 3')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 3 of 3')
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(useStore.getState().detailPinId).toBe(second)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(useStore.getState().detailPinId).toBe(first)
  })

  it('a pin outside the feed is shown alone with one segment', () => {
    const old = pin({ createdAt: now - 40 * 24 * H, type: 'civic' })
    setup([old], old.id)
    render(<DetailLayer />)
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 1 of 1')
  })

  it('close button and Escape close; map window closes and flies', () => {
    const p = pin()
    setup([p], p.id)
    const r = render(<DetailLayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useStore.getState().detailPinId).toBeNull()
    r.unmount()
    setup([p], p.id)
    render(<DetailLayer />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(useStore.getState().detailPinId).toBeNull()
    cleanup()
    setup([p], p.id)
    render(<DetailLayer />)
    fireEvent.click(screen.getByRole('button', { name: /Show on the map/ }))
    expect(useStore.getState().detailPinId).toBeNull()
    expect(useStore.getState().selectedPinId).toBe(p.id)
    expect(useStore.getState().flyTo).not.toBeNull()
  })

  it('browser back (popstate) closes the view', () => {
    const p = pin()
    setup([p], p.id)
    render(<DetailLayer />)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(useStore.getState().detailPinId).toBeNull()
  })
})

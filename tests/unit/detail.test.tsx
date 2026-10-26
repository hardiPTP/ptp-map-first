import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/data', () => ({
  repo: {
    toggleSupport: vi.fn().mockResolvedValue({ supported: true }),
    addComment: vi.fn().mockResolvedValue({ id: 'new', status: 'under_review' }),
  },
}))

import { repo } from '../../src/data'
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
    pins, supports: [], comments: [], detailSection: 'top', detailPinId: open, selectedPinId: null, filter: 'all', searchPlace: null, flyTo: null,
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
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }))
    const second = useStore.getState().detailPinId
    expect(second).toBe(order[order.indexOf(first as string) + 1])
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 2 of 3')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 3 of 3')
    expect(screen.queryByRole('button', { name: 'Next item' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(useStore.getState().detailPinId).toBe(second)
    fireEvent.click(screen.getByRole('button', { name: 'Previous item' }))
    expect(useStore.getState().detailPinId).toBe(first)
  })

  it('a pin outside the feed is shown alone with one segment', () => {
    const old = pin({ createdAt: now - 40 * 24 * H, type: 'civic' })
    setup([old], old.id)
    render(<DetailLayer />)
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Item 1 of 1')
  })

  it('close button and Escape close', () => {
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
  })
  it('flies the live map to the pin, zoomed in, and publishes the header and card heights', () => {
    const p = pin({ lat: 19.06, lng: 72.83 })
    setup([p], p.id)
    const r = render(<DetailLayer />)
    const fly = useStore.getState().flyTo!
    expect([fly.lat, fly.lng, fly.zoom]).toEqual([19.06, 72.83, 17])
    expect(document.documentElement.style.getPropertyValue('--detail-bottom')).not.toBe('')
    r.unmount()
    expect(document.documentElement.style.getPropertyValue('--detail-bottom')).toBe('')
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

describe('DetailLayer media', () => {
  it('puts the item\'s own photo inside the card, credited with its source; no boxed map', () => {
    const p = pin({ type: 'event', startsAt: now + 3 * H, imageUrl: 'https://example.org/banner.jpg', sourceLabel: 'Listing on example.org', postedAs: 'ptp' })
    setup([p], p.id)
    const { container } = render(<DetailLayer />)
    const img = container.querySelector('.detail-sheet .detail-photo__img') as HTMLImageElement
    expect(img.src).toBe('https://example.org/banner.jpg')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(screen.getByText('Listing on example.org', { selector: 'figcaption' })).toBeInTheDocument()
    expect(container.querySelector('.detail-map')).toBeNull()
  })
  it('no photo: the card is text only', () => {
    const p = pin()
    setup([p], p.id)
    const { container } = render(<DetailLayer />)
    expect(container.querySelector('.detail-photo')).toBeNull()
  })
})

describe('Detail comments', () => {
  it('lists live comments as Neighbour only, never the device id, and skips under_review', () => {
    const p = pin({ type: 'civic' })
    setup([p], p.id)
    useStore.setState({
      comments: [
        { id: 'c1', pinId: p.id, text: 'Still dark last night.', createdAt: now - 2 * H, deviceId: 'device-secret-id', status: 'live' },
        { id: 'c2', pinId: p.id, text: 'Waiting comment text', createdAt: now - H, deviceId: 'device-secret-id', status: 'under_review' },
      ],
    })
    render(<DetailLayer />)
    expect(screen.getByText('Still dark last night.')).toBeTruthy()
    expect(screen.queryByText('Waiting comment text')).toBeNull()
    expect(screen.getByText('Neighbour', { selector: '.detail-comment__by' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('device-secret-id')
  })

  it('posting sends the text, clears the field and says it waits for review', async () => {
    const p = pin()
    setup([p], p.id)
    render(<DetailLayer />)
    const field = screen.getByPlaceholderText('Add what you saw') as HTMLInputElement
    expect(field.maxLength).toBe(280)
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(field, { target: { value: 'Seen it at 8 am too' } })
    await act(async () => {
      fireEvent.click(send)
    })
    expect(repo.addComment).toHaveBeenCalledWith({ pinId: p.id, text: 'Seen it at 8 am too' })
    expect(field.value).toBe('')
    expect(screen.getByRole('status').textContent).toMatch(/once it has been checked/)
  })

  it('a bubble tap opens the detail at the comments section', () => {
    const p = pin()
    setup([p], null)
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<DetailLayer />)
    act(() => useStore.getState().openDetail(p.id, { section: 'comments' }))
    expect(useStore.getState().detailSection).toBe('comments')
    expect(scroll).toHaveBeenCalled()
    expect((scroll.mock.contexts[0] as Element).classList.contains('detail-comments__inner')).toBe(true)
  })
})

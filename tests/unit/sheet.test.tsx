import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/data', () => ({ repo: { toggleSupport: vi.fn().mockResolvedValue({ supported: true }) } }))

import { repo } from '../../src/data'
import { BANDRA_WEST, useStore } from '../../src/store'
import { AreaStrip, activeAreaUpdates } from '../../src/sheet/AreaStrip'
import { nextHeight, snapTo } from '../../src/sheet/BottomSheet'
import { areaWhen, clock, ago, directionsUrl, whatsappUrl } from '../../src/sheet/format'
import { PinCard } from '../../src/sheet/PinCard'
import { headerCopy } from '../../src/sheet/SheetHeader'
import { buildFeed } from '../../src/sheet/useFeed'
import type { Pin } from '../../src/types'

const H = 3600_000
const now = new Date(2030, 5, 15, 14, 0, 0).getTime()
const origin = { lat: 1, lng: 1 }
let n = 0
const pin = (o: Partial<Pin> = {}): Pin => ({
  id: `p${++n}`, type: 'ask', title: 'Synthetic title', lat: 1, lng: 1, createdAt: now - 2 * H, createdBy: 'device-secret-id',
  postedAs: 'neighbour', status: 'active', ...o,
})

beforeEach(() => {
  cleanup()
  useStore.setState({ pins: [], supports: [], selectedPinId: null, detailPinId: null, selectedAreaId: null, flyTo: null })
})

describe('sheet heights', () => {
  it('cycles peek > half > full > half', () => {
    expect([nextHeight('peek'), nextHeight('half'), nextHeight('full')]).toEqual(['half', 'full', 'half'])
  })
  const snaps = { peek: 100, half: 400, full: 700 }
  it('snaps to nearest', () => expect(snapTo(380, 0, snaps)).toBe('half'))
  it('a fast upward flick goes up a step', () => expect(snapTo(420, -1.2, snaps)).toBe('full'))
  it('a fast downward flick goes down', () => expect(snapTo(420, 1.2, snaps)).toBe('peek'))
})

describe('format', () => {
  it('ago', () => {
    expect(ago(now - 10_000, now)).toBe('Just now')
    expect(ago(now - 2 * H, now)).toBe('2 hrs ago')
    expect(ago(now - 1 * H, now)).toBe('1 hr ago')
    expect(ago(now - 50 * H, now)).toBe('2 days ago')
  })
  it('clock', () => {
    expect(clock(new Date(2030, 5, 15, 17, 0).getTime())).toBe('5pm')
    expect(clock(new Date(2030, 5, 15, 9, 30).getTime())).toBe('9:30am')
  })
  it('areaWhen', () => {
    const p = pin({ type: 'area', startsAt: new Date(2030, 5, 16, 10, 0).getTime(), endsAt: new Date(2030, 5, 16, 18, 0).getTime() })
    expect(areaWhen(p, now)).toBe('Tomorrow, 10 AM to 6 PM')
  })
  it('urls', () => {
    expect(whatsappUrl('a b\nc')).toBe('https://wa.me/?text=a%20b%0Ac')
    const u = directionsUrl(pin({ placeId: 'PID', placeName: 'Some Hall', lat: 1, lng: 2 }))
    expect(u).toContain('https://www.google.com/maps/dir/?api=1&destination=Some%20Hall')
    expect(u).toContain('destination_place_id=PID')
  })
})

describe('headerCopy', () => {
  const feed = (nearCount: number, mode: 'last3h' | 'sinceLastNight' = 'last3h') => ({ nearCount, mode, items: [] as Pin[] })
  it('area mode', () =>
    expect(headerCopy({ feed: feed(14), areaMode: 'area', searchName: null })).toEqual({
      title: '14 things within a 10 min walk today', sub: 'Showing Bandra West',
    }))
  it('near me', () => expect(headerCopy({ feed: feed(1), areaMode: 'nearMe', searchName: null })).toEqual({ title: '1 thing within a 10 min walk today', sub: null }))
  it('since last night', () => {
    expect(headerCopy({ feed: feed(3, 'sinceLastNight'), areaMode: 'nearMe', searchName: null }).sub).toBe('Since last night')
    expect(headerCopy({ feed: feed(3, 'sinceLastNight'), areaMode: 'area', searchName: null }).sub).toBe('Showing Bandra West, since last night')
  })
  it('zero', () => expect(headerCopy({ feed: feed(0), areaMode: 'nearMe', searchName: null }).title).toBe('Nothing new within a 10 min walk'))
})

describe('buildFeed', () => {
  const base = { supports: [], filter: 'all' as const, bounds: null, searchPlaceId: null, origin, now }
  it('filters by bounds and chip, drops area updates', () => {
    const inside = pin({ lat: 1, lng: 1 })
    const outside = pin({ lat: 5, lng: 5 })
    const area = pin({ type: 'area', postedAs: 'ptp', endsAt: now + H })
    const r = buildFeed({ ...base, pins: [inside, outside, area], bounds: { north: 2, south: 0, east: 2, west: 0 } })
    expect(r.items.map((p) => p.id)).toEqual([inside.id])
    const civic = pin({ type: 'civic' })
    expect(buildFeed({ ...base, pins: [inside, civic], filter: 'civic' }).items.map((p) => p.id)).toEqual([civic.id])
  })
  it('search place shows only that place', () => {
    const a = pin({ placeId: 'X' }); const b = pin({ placeId: 'Y', createdAt: now - 100 * H })
    expect(buildFeed({ ...base, pins: [a, b], searchPlaceId: 'X' }).items).toEqual([a])
  })
  it('events chip lists upcoming events beyond today', () => {
    const e = pin({ type: 'event', startsAt: now + 72 * H, createdAt: now - 30 * H })
    expect(buildFeed({ ...base, pins: [e], filter: 'event' }).items).toEqual([e])
    expect(buildFeed({ ...base, pins: [e] }).items).toEqual([])
  })
  it('counts items within the 800 m ring', () => {
    const near = pin(); const far = pin({ lat: 1.02 })
    expect(buildFeed({ ...base, pins: [near, far] }).nearCount).toBe(1)
  })
})

describe('PinCard', () => {
  it('shows poster, type, walk, title, button and never the creator id', () => {
    const p = pin({ type: 'event', startsAt: now + 3 * H, placeName: 'Synthetic Hall' })
    const { container } = render(<PinCard pin={p} origin={origin} now={now} count={4} supported={false} />)
    expect(screen.getByText('Neighbour')).toBeInTheDocument()
    expect(screen.getByText(/Event · ~1 min walk/)).toBeInTheDocument()
    expect(screen.getByText('Synthetic title')).toBeInTheDocument()
    expect(screen.getByText('Today, 5pm')).toBeInTheDocument()
    expect(screen.getByText('Synthetic Hall')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I'm going" })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('4 going')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Directions/ })).toBeInTheDocument()
    expect(container.textContent).not.toContain('device-secret-id')
  })
  it('action button toggles support and does not open the detail', () => {
    render(<PinCard pin={pin({ type: 'civic' })} origin={origin} now={now} count={0} supported />)
    const b = screen.getByRole('button', { name: 'I see it too' })
    expect(b).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(b)
    expect(repo.toggleSupport).toHaveBeenCalled()
    expect(useStore.getState().detailPinId).toBeNull()
  })
  it('card tap selects with fly and opens detail', () => {
    const p = pin()
    useStore.setState({ pins: [p] })
    const { container } = render(<PinCard pin={p} origin={origin} now={now} count={0} supported={false} />)
    fireEvent.click(container.querySelector('article')!)
    expect(useStore.getState().selectedPinId).toBe(p.id)
    expect(useStore.getState().detailPinId).toBe(p.id)
    expect(useStore.getState().flyTo).not.toBeNull()
  })
  it('just now for under a minute', () => {
    render(<PinCard pin={pin({ createdAt: now - 5000 })} origin={origin} now={now} count={0} supported={false} />)
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })
})

describe('AreaStrip', () => {
  const area = (o: Partial<Pin> = {}) =>
    pin({ type: 'area', postedAs: 'ptp', topic: 'water', radiusM: 500, lat: BANDRA_WEST.lat, lng: BANDRA_WEST.lng, startsAt: now, endsAt: now + 5 * H, ...o })
  it('covers origin or masthead centre; expired and far ones are excluded', () => {
    const ok = area(); const expired = area({ endsAt: now - 1 }); const far = area({ lat: 20, lng: 80 })
    expect(activeAreaUpdates([ok, expired, far], [], { lat: 20, lng: 80 }, now).map((p) => p.id).sort()).toEqual([ok.id, far.id].sort())
    expect(activeAreaUpdates([far], [], BANDRA_WEST, now)).toEqual([])
  })
  it('renders nothing when empty, 3 rows plus +N more, extended, and select + share', () => {
    const { container, rerender } = render(<AreaStrip origin={BANDRA_WEST} now={now} />)
    expect(container).toBeEmptyDOMElement()
    const rows = [1, 2, 3, 4, 5].map((i) => area({ title: `Notice ${i}`, startsAt: now + i }))
    rows[0] = { ...rows[0], endsAt: now + 6 * H, endsAtOriginal: now + 5 * H }
    useStore.setState({ pins: rows })
    rerender(<AreaStrip origin={BANDRA_WEST} now={now} />)
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(3)
    expect(screen.getByText('Extended')).toBeInTheDocument()
    fireEvent.click(screen.getByText('+2 more'))
    expect(screen.getByText('Notice 5')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Notice 1'))
    expect(useStore.getState().selectedAreaId).toBe(rows[0].id)
    expect(screen.getByText('Share on WhatsApp')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Notice 1'))
    expect(useStore.getState().selectedAreaId).toBeNull()
  })
})

describe('buildFeed: just posted by this device goes first (lead, Gate 2)', () => {
  it('puts own pin posted < 10 min ago at the top regardless of score', async () => {
    const { buildFeed } = await import('../../src/sheet/useFeed')
    const now = 1_000_000_000_000
    const o = { lat: 0, lng: 0 }
    const base = { title: 'x', status: 'active' as const, postedAs: 'neighbour' as const, type: 'ask' as const }
    const far = { ...base, id: 'mine', lat: 0.02, lng: 0, createdAt: now - 60_000, createdBy: 'dev-me' }
    const near = { ...base, id: 'other', lat: 0, lng: 0, createdAt: now - 60_000, createdBy: 'dev-x' }
    const r = buildFeed({ pins: [near, far], supports: [], filter: 'all', bounds: null, searchPlaceId: null, origin: o, now, deviceId: 'dev-me' })
    expect(r.items.map((p) => p.id)).toEqual(['mine', 'other'])
    const r2 = buildFeed({ pins: [near, far], supports: [], filter: 'all', bounds: null, searchPlaceId: null, origin: o, now, deviceId: 'dev-x' })
    expect(r2.items[0].id).toBe('other')
  })
})

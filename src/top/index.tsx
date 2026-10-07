// Top bar: masthead line, search with account avatar, filter chips. Floats over the map (z 10).
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Chip, Icon } from '../design/primitives'
import { useStore } from '../store'
import { isLive } from '../lib/pulse'
import type { Filter, Pin } from '../types'
import { DEBOUNCE_MS, MIN_CHARS, SearchSession, type PlaceSuggestion } from './autocomplete'
import { AccountSheet } from './Sheets'
import './top.css'

// Figma map chips: no "All" chip. None selected = everything; each chip isolates one layer.
const CHIPS: { value: Exclude<Filter, 'all'>; label: string }[] = [
  { value: 'civic', label: 'Issues' },
  { value: 'event', label: 'Events' },
  { value: 'ask', label: 'Asks' },
  { value: 'places', label: 'Places' },
]

const readNow = () => Date.now()

/** What is in view right now, per chip. Recomputed on map idle (viewport) and data changes only. */
function useChipCounts(): Record<Exclude<Filter, 'all'>, number> {
  const pins = useStore((s) => s.pins)
  const supports = useStore((s) => s.supports)
  const places = useStore((s) => s.places)
  const b = useStore((s) => s.viewport.bounds)
  return useMemo(() => {
    const now = readNow()
    const inView = (p: { lat: number; lng: number }) =>
      !b || (p.lat <= b.north && p.lat >= b.south && p.lng >= b.west && p.lng <= b.east)
    const c = { civic: 0, event: 0, ask: 0, places: 0 }
    for (const p of pins) if (p.type !== 'area' && inView(p) && isLive(p, supports, now)) c[p.type]++
    c.places = places.filter(inView).length
    return c
  }, [pins, supports, places, b])
}

export function filterOurPins(pins: Pin[], q: string): Pin[] {
  const n = q.trim().toLowerCase()
  if (n.length < MIN_CHARS) return []
  return pins
    .filter((p) => p.type !== 'area' && p.status === 'active')
    .filter((p) => p.title.toLowerCase().includes(n) || (p.placeName ?? '').toLowerCase().includes(n))
    .slice(0, 5)
}

function SearchBar({ onAccount }: { onAccount: () => void }) {
  const places = useMapsLibrary('places')
  const pins = useStore((s) => s.pins)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [google, setGoogle] = useState<PlaceSuggestion[]>([])
  const session = useRef<SearchSession | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    session.current = places ? new SearchSession(places) : null
  }, [places])

  // Debounced Google call: only from an effect on the query, never in render, never under 3 chars.
  useEffect(() => {
    const n = q.trim()
    if (n.length < MIN_CHARS) return
    const id = ++seq.current
    const t = window.setTimeout(() => {
      session.current?.suggest(n).then(
        (r) => { if (id === seq.current) setGoogle(r) },
        () => { if (id === seq.current) setGoogle([]) },
      )
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [q])

  const short = q.trim().length < MIN_CHARS
  const ours = useMemo(() => filterOurPins(pins, q), [pins, q])
  const theirs = short ? [] : google

  const end = () => {
    seq.current++
    session.current?.reset()
    setGoogle([])
  }
  const clear = () => { setQ(''); end() }
  const close = () => { setOpen(false); setQ(''); end() }

  const pickPin = (p: Pin) => {
    const s = useStore.getState()
    s.setSearchPlace(null)
    s.selectPin(p.id, { fly: true })
    s.openDetail(p.id)
    close()
  }
  const pickPlace = async (sug: PlaceSuggestion) => {
    seq.current++
    const r = await session.current?.select(sug).catch(() => null)
    if (!r) return
    const s = useStore.getState()
    s.requestFlyTo({ ...r.location, zoom: 17 })
    s.setSearchPlace({ placeId: r.placeId, placeName: r.placeName })
    close()
  }

  const showPanel = open && !short && (ours.length > 0 || theirs.length > 0)
  const showEmpty = open && !short && !showPanel

  return (
    <div className="top-search-wrap">
      <div className="top-search">
        <Icon name="map-search" size={19} />
        <input
          className="top-search__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Places, pins, events"
          aria-label="Search places, pins and events"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) end() }}
          onKeyDown={(e) => e.key === 'Escape' && close()}
        />
        {q && (
          <button type="button" className="top-search__clear" aria-label="Clear search" onClick={clear}>
            <Icon name="ic-close" size={18} />
          </button>
        )}
        <button type="button" className="top-avatar" aria-label="Your account" onClick={() => { close(); onAccount() }}>
          <Icon name="ic-user" size={20} />
        </button>
      </div>
      {open && createPortal(
        <>
          <button type="button" className="top-search__dismiss" aria-label="Close search" onClick={close} />
          {(showPanel || showEmpty) && (
            <div className="top-results" role="listbox" aria-label="Search results">
              {ours.length > 0 && <div className="top-results__head">On Push The Pin</div>}
              {ours.map((p) => (
                <button key={p.id} type="button" role="option" aria-selected={false} className="top-result" onClick={() => pickPin(p)}>
                  <span className="top-result__main">{p.title}</span>
                  {p.placeName && <span className="top-result__sub">{p.placeName}</span>}
                </button>
              ))}
              {theirs.length > 0 && <div className="top-results__head">Places</div>}
              {theirs.map((g) => (
                <button key={g.placeId} type="button" role="option" aria-selected={false} className="top-result" onClick={() => pickPlace(g)}>
                  <span className="top-result__main">{g.main}</span>
                  {g.secondary && <span className="top-result__sub">{g.secondary}</span>}
                </button>
              ))}
              {showEmpty && <p className="top-results__none">Nothing found yet.</p>}
            </div>
          )}
        </>,
        document.body,
      )}
    </div>
  )
}

export function TopBar() {
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const counts = useChipCounts()
  const [sheet, setSheet] = useState<'account' | null>(null)
  return (
    <header className="top-bar">
      <SearchBar onAccount={() => setSheet('account')} />
      <div className="top-chips" role="group" aria-label="Show on the map">
        {CHIPS.map((c) => (
          <Chip key={c.value} selected={filter === c.value} count={counts[c.value]} onClick={() => setFilter(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {sheet === 'account' && <AccountSheet onClose={() => setSheet(null)} />}
    </header>
  )
}

export { AccountSheet, AreaSheet } from './Sheets'

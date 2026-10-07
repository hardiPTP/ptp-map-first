// Top bar: masthead line, search with account avatar, filter chips. Floats over the map (z 10).
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Chip, Icon } from '../design/primitives'
import { AREA_NAME, useStore } from '../store'
import type { Filter, Pin } from '../types'
import { DEBOUNCE_MS, MIN_CHARS, SearchSession, type PlaceSuggestion } from './autocomplete'
import { AccountSheet, AreaSheet } from './Sheets'
import './top.css'

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'civic', label: 'Issues' },
  { value: 'event', label: 'Events' },
  { value: 'ask', label: 'Asks' },
]

export function filterOurPins(pins: Pin[], q: string): Pin[] {
  const n = q.trim().toLowerCase()
  if (n.length < MIN_CHARS) return []
  return pins
    .filter((p) => p.type !== 'area' && p.status === 'active')
    .filter((p) => p.title.toLowerCase().includes(n) || (p.placeName ?? '').toLowerCase().includes(n))
    .slice(0, 5)
}

function Masthead({ onOpen }: { onOpen: () => void }) {
  const areaMode = useStore((s) => s.areaMode)
  return (
    <button type="button" className="top-masthead" onClick={onOpen} aria-haspopup="dialog">
      <span className="top-masthead__line">
        <span className="top-masthead__name">{areaMode === 'nearMe' ? 'Near me' : AREA_NAME}</span>
        <Icon name="masthead-chevron-down-18" size={18} />
      </span>
    </button>
  )
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
          placeholder="Search places, events, issues"
          aria-label="Search places, events, issues"
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
  const [sheet, setSheet] = useState<'area' | 'account' | null>(null)
  return (
    <header className="top-bar">
      <Masthead onOpen={() => setSheet('area')} />
      <SearchBar onAccount={() => setSheet('account')} />
      <div className="top-chips" role="radiogroup" aria-label="Filter">
        {CHIPS.map((c) => (
          <Chip key={c.value} selected={filter === c.value} onClick={() => setFilter(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {sheet === 'area' && <AreaSheet onClose={() => setSheet(null)} />}
      {sheet === 'account' && <AccountSheet onClose={() => setSheet(null)} />}
    </header>
  )
}

export { AccountSheet } from './Sheets'

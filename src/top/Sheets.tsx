import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Field, Grabber, Icon, SheetSurface } from '../design/primitives'
import { distanceM } from '../lib/geo'
import { requestLocation } from '../lib/locate'
import { AREA_NAME, BANDRA_WEST, DEFAULT_ZOOM, useStore } from '../store'
import { loadName, saveName } from './account'
import './top.css'

/** Sheet at z 50, portalled to body so the top layer's stacking context does not cap it. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="top-sheet-layer">
      <button type="button" className="top-scrim" aria-label="Close" onClick={onClose} />
      <SheetSurface className="top-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="top-grabber" aria-label="Close" onClick={onClose}>
          <Grabber />
        </button>
        <h2 className="top-sheet__title">{title}</h2>
        {children}
      </SheetSurface>
    </div>,
    document.body,
  )
}

function formatDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

export function AreaSheet({ onClose }: { onClose: () => void }) {
  const areaMode = useStore((s) => s.areaMode)
  const userLocation = useStore((s) => s.userLocation)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  const pickArea = () => {
    const s = useStore.getState()
    s.setAreaMode('area')
    s.requestFlyTo({ ...BANDRA_WEST, zoom: DEFAULT_ZOOM })
    onClose()
  }
  const pickNearMe = async () => {
    setBusy(true)
    setDenied(false)
    const loc = await requestLocation()
    setBusy(false)
    if (!loc) {
      setDenied(true)
      return
    }
    const s = useStore.getState()
    s.setAreaMode('nearMe')
    s.requestFlyTo({ ...loc, zoom: 16 })
    onClose()
  }

  return (
    <Sheet title="Switch area" onClose={onClose}>
      <div role="radiogroup" aria-label="Area" className="top-rows">
        <AreaRow label={AREA_NAME} selected={areaMode === 'area'} icon="row-area-location" onClick={pickArea}
          value={userLocation ? formatDist(distanceM(userLocation, BANDRA_WEST)) : ''} />
        <AreaRow label="Near me" selected={areaMode === 'nearMe'} icon="row-area-location" onClick={pickNearMe}
          value={busy ? 'Finding you' : ''} />
      </div>
      {denied && (
        <p className="top-note" role="status">
          Location is off for this site, so we are staying on {AREA_NAME}. Turn it on in your browser settings to use Near me.
        </p>
      )}
    </Sheet>
  )
}

function AreaRow({ label, value, selected, icon, onClick }: { label: string; value: string; selected: boolean; icon: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`top-arow${selected ? ' is-selected' : ''}`} onClick={onClick}>
      <span className="top-arow__puck">
        <Icon name={selected ? 'row-area-check-selected' : icon} size={18} tint={false} />
      </span>
      <span className="top-arow__pill">
        <span className="top-arow__name">{label}</span>
        {value && <span className="top-arow__value">{value}</span>}
      </span>
    </button>
  )
}

const TYPE_LABEL: Record<string, string> = { civic: 'Issue', event: 'Event', ask: 'Ask' }

export function ago(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60000))
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(loadName)
  const pins = useStore((s) => s.pins)
  const deviceId = useStore((s) => s.deviceId)
  const mine = deviceId ? pins.filter((p) => p.createdBy === deviceId && p.type !== 'area' && p.status === 'active') : []
  mine.sort((a, b) => b.createdAt - a.createdAt)

  return (
    <Sheet title="Your account" onClose={onClose}>
      <label className="top-label" htmlFor="top-name">Your name</label>
      <Field id="top-name" value={name} placeholder="Only you see this, on this phone" autoComplete="off"
        onChange={(e) => { setName(e.target.value); saveName(e.target.value) }} />
      <p className="top-note">Neighbours never see your name. You post as Neighbour.</p>
      <h3 className="top-sheet__sub">My pins</h3>
      {mine.length === 0 ? (
        <p className="top-note">Pins you post will be listed here.</p>
      ) : (
        <ul className="top-mine">
          {mine.map((p) => (
            <li key={p.id}>
              <button type="button" className="top-mine__row" onClick={() => {
                const s = useStore.getState()
                s.selectPin(p.id, { fly: true })
                s.openDetail(p.id)
                onClose()
              }}>
                <span className="top-mine__title">{p.title}</span>
                <span className="top-mine__meta">{TYPE_LABEL[p.type] ?? p.type} · {ago(p.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

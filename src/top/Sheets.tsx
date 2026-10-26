import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Field, Grabber, Icon, SheetSurface } from '../design/primitives'
import { useModal } from '../design/useModal'
import { distanceM } from '../lib/geo'
import { requestLocation } from '../lib/locate'
import { AREA_NAME, BANDRA_WEST, DEFAULT_ZOOM, useStore } from '../store'
import { loadName, saveName } from './account'
import './top.css'

/**
 * Sheet at z 50, portalled to body so the top layer's stacking context does not cap it. A modal dialog
 * (design/useModal): focus moves in, Tab stays inside, Escape closes, focus returns to the opener.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = useModal(ref, onClose)
  const titleId = useId()
  return createPortal(
    <div className="top-sheet-layer">
      {/* Pointer-only: the grabber below is the keyboard and screen reader close. */}
      <button type="button" className="top-scrim" aria-hidden tabIndex={-1} onClick={onClose} />
      <SheetSurface
        {...({ ref } as object)}
        className="top-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="top-grabber" aria-label="Close" onClick={onClose}>
          <Grabber />
        </button>
        <h2 className="top-sheet__title" id={titleId}>{title}</h2>
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

  const deniedText = `Location is off for this site, so we are staying on ${AREA_NAME}. Turn it on in your browser settings to use Near me.`
  return (
    <Sheet title="Switch area" onClose={onClose}>
      <div role="radiogroup" aria-label="Area" className="top-rows">
        <AreaRow label={AREA_NAME} selected={areaMode === 'area'} icon="row-area-location" onClick={pickArea}
          value={userLocation ? formatDist(distanceM(userLocation, BANDRA_WEST)) : ''} />
        <AreaRow label="Near me" selected={areaMode === 'nearMe'} icon="row-area-location" onClick={pickNearMe}
          value={busy ? 'Finding you' : ''} />
      </div>
      {/* The live region is always rendered, so the message is announced when it appears (WCAG 4.1.3). */}
      <p className="sr-only" role="status">
        {busy ? 'Finding you' : denied ? deniedText : ''}
      </p>
      {denied && <p className="top-note">{deniedText}</p>}
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
  const locationStatus = useStore((s) => s.locationStatus)
  const mine = deviceId ? pins.filter((p) => p.createdBy === deviceId && p.type !== 'area' && p.status === 'active') : []
  mine.sort((a, b) => b.createdAt - a.createdAt)

  return (
    <Sheet title="Your account" onClose={onClose}>
      <label className="top-label" htmlFor="top-name">Your name</label>
      <Field id="top-name" value={name} placeholder="Only you see this, on this phone" autoComplete="nickname"
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
      {/* PRD "Search bar": the photo opens account, my pins and settings. */}
      <h3 className="top-sheet__sub">Settings</h3>
      <div className="top-setting">
        <span className="top-setting__text">
          <span>Location</span>
          <span className="top-note">
            {locationStatus === 'granted' ? 'Shared while the app is open' : locationStatus === 'denied' ? 'Not allowed on this phone' : 'Not shared yet'}
          </span>
        </span>
        {locationStatus !== 'granted' && locationStatus !== 'denied' && (
          <Button variant="quiet" onClick={async () => {
            const loc = await requestLocation()
            if (loc) {
              const s = useStore.getState()
              s.setAreaMode('nearMe')
              s.requestFlyTo({ ...loc, zoom: 16 })
            }
          }}>Use my location</Button>
        )}
      </div>
      {name && (
        <Button variant="quiet" onClick={() => { setName(''); saveName('') }}>Forget my name on this phone</Button>
      )}
    </Sheet>
  )
}

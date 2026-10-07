// Detail view (Agent G). Story-style layout of Figma node 3552:3120 ("Since yesterday"), with the changes
// logged in docs/DECISIONS.md (Phase 2 brief): map window instead of a photo, no timer, no civic rail, no comments.
// Card/map window: Figma node 3675:13987. Header/segments: Figma story/header 3547:3210 (left third back, right two thirds forward).
//
// Segments = the feed list as it was when the view opened (snapshot, so a support tap that re-ranks the
// feed does not move you). Left/right, the arrow buttons, taps and the arrow keys move through it. No timers.
// History: opening pushes one history entry; browser/Android back (popstate) closes the view. Closing by
// any other route pops that entry again.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Button, Icon, NeighbourLabel, PlaceLabel, PtpLabel, ShellButton } from '../design/primitives'
import { repo } from '../data'
import { clock, ago, dayLabel, daysOpen, directionsUrl, eventWhen, openWhatsapp } from '../sheet/format'
import { shareText } from '../sheet/PinCard'
import { useFeed } from '../sheet/useFeed'
import { useStore } from '../store'
import type { Filter, Pin } from '../types'
import './detail.css'

const ACTION_LABEL = { civic: 'I see it too', event: "I'm going", ask: 'I can help', area: '' } as const
const COUNT_WORD = { civic: 'see it', event: 'going', ask: 'can help', area: '' } as const
const CHIP_TITLE: Record<Filter, string> = { all: '', civic: 'Issues', event: 'Events', ask: 'Asks', places: 'Places' }
const TYPE_TITLE = { civic: 'Issue', event: 'Event', ask: 'Ask', area: 'Update' } as const

/** Header title: the feed's Pulse wording, the chip name when a type chip is active, the place when searching. */
export function headerTitle(mode: string, filter: Filter, searchName: string | null, inFeed: boolean, pin: Pin): string {
  if (!inFeed) return TYPE_TITLE[pin.type]
  if (mode === 'search' && searchName) return searchName
  if (mode === 'type') return CHIP_TITLE[filter]
  return mode === 'sinceLastNight' ? 'Since last night' : 'Last 3 hours'
}

function streetOf(pin: Pin): string | null {
  return (pin as Pin & { street?: string | null }).street || null
}

function posted(ts: number, now: number): string {
  return `${dayLabel(ts, now)}, ${clock(ts)}`
}

/** Figma card/map: pressed window, abstract roads at 75%, the real selected marker, landmark pill. */
function MapWindow({ pin }: { pin: Pin }) {
  const close = () => {
    const s = useStore.getState()
    s.openDetail(null)
    s.selectPin(pin.id, { fly: true })
  }
  const cls = ['detail-mk', `detail-mk--${pin.type}`, pin.postedAs === 'place' && 'is-place'].filter(Boolean).join(' ')
  const landmark = pin.placeName || streetOf(pin)
  return (
    <button type="button" className="detail-map" aria-label={`Show on the map${landmark ? `: ${landmark}` : ''}`} onClick={close}>
      <span className="detail-map__road detail-map__road--h1" />
      <span className="detail-map__road detail-map__road--h2" />
      <span className="detail-map__road detail-map__road--v1" />
      <span className="detail-map__road detail-map__road--v2" />
      <span className={cls} aria-hidden>
        <span className="detail-mk__halo" />
        <span className="detail-mk__stalk" />
        <span className="detail-mk__tip" />
        <span className="detail-mk__disc">
          {pin.type === 'civic' && <Icon name="pin-icon-warning" size={16} tint={false} />}
          {pin.type === 'event' && <Icon name="pin-icon-calendar" size={16} tint={false} />}
          {pin.type === 'ask' && <Icon name="ic-bubble" size={16} />}
        </span>
      </span>
      {landmark && <span className="detail-map__landmark">{landmark}</span>}
    </button>
  )
}

function Sheet({ pin, now }: { pin: Pin; now: number }) {
  const supports = useStore((s) => s.supports)
  const deviceId = useStore((s) => s.deviceId)
  const count = supports.filter((s) => s.pinId === pin.id).length
  const supported = deviceId != null && supports.some((s) => s.pinId === pin.id && s.deviceId === deviceId)
  const place = pin.placeName || streetOf(pin)
  const showPlace = place && !(pin.postedAs === 'place' && place === pin.placeName)
  const days = daysOpen(pin.createdAt, now)
  const toggle = () => {
    repo.toggleSupport(pin.id).catch(() => {})
  }
  return (
    <div className="detail-sheet">
      <div className="detail-sheet__meta">
        <div className="detail-sheet__when">
          {showPlace && <span>{place}</span>}
          <span>{posted(pin.createdAt, now)}</span>
        </div>
        <div className="detail-sheet__poster">
          {pin.postedAs === 'place' ? (
            <PlaceLabel name={pin.placeName || 'Place'} photoUri={pin.placePhotoUri} />
          ) : pin.postedAs === 'ptp' ? (
            <PtpLabel />
          ) : (
            <NeighbourLabel style="chip" />
          )}
        </div>
      </div>
      <h2 className="detail-sheet__title" id="detail-title">
        {pin.title}
      </h2>
      {pin.body && <p className="detail-sheet__body">{pin.body}</p>}
      <div className="detail-sheet__facts">
        {pin.type === 'civic' && <span>{days >= 1 ? `Open ${days === 1 ? '1 day' : `${days} days`}` : 'Opened today'}</span>}
        {pin.type === 'ask' && <span>Asked {ago(pin.createdAt, now).replace(/^Just now$/, 'just now')}</span>}
        {pin.type === 'event' && pin.startsAt != null && (
          <span className="detail-sheet__fact-main">
            <Icon name="calendar-when" size={18} tint={false} />
            {eventWhen(pin.startsAt, now)}
          </span>
        )}
        {pin.type === 'event' && (
          <a className="detail-sheet__link" href={directionsUrl(pin)} target="_blank" rel="noopener noreferrer">
            <Icon name="ic-directions" size={16} />
            Directions
          </a>
        )}
      </div>
      <div className="detail-sheet__actions">
        <Button variant={supported ? 'soft' : 'quiet'} pressed={supported} icon="ic-checkcircle" onClick={toggle}>
          {ACTION_LABEL[pin.type]}
        </Button>
        <span className="detail-sheet__count">
          {count} {COUNT_WORD[pin.type]}
        </span>
        <ShellButton
          icon="ic-whatsapp"
          label="Share on WhatsApp"
          size={46}
          variant="raised"
          onClick={() => openWhatsapp(shareText(pin, now))}
        />
      </div>
    </div>
  )
}

export function DetailLayer() {
  const detailId = useStore((s) => s.detailPinId)
  const pins = useStore((s) => s.pins)
  const pin = useMemo(() => pins.find((p) => p.id === detailId) ?? null, [pins, detailId])
  if (!detailId || !pin) return null
  if (pin.type === 'area') return <AreaGuard />
  return <Detail pin={pin} />
}

/** Area-type pins never open here. */
function AreaGuard() {
  useEffect(() => {
    useStore.getState().openDetail(null)
  }, [])
  return null
}

function Detail({ pin }: { pin: Pin }) {
  const feed = useFeed()
  const filter = useStore((s) => s.filter)
  const searchName = useStore((s) => s.searchPlace?.placeName ?? null)
  const rootRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)
  const pushed = useRef(false)
  const live = useRef(false)

  // Snapshot of the list order (and header wording) taken when the view opens.
  const [snap] = useState(() => {
    const listed = feed.items.map((p) => p.id)
    const inFeed = listed.includes(pin.id)
    return { ids: inFeed ? listed : [pin.id], title: headerTitle(feed.mode, filter, searchName, inFeed, pin) }
  })
  const ids = snap.ids
  const index = Math.max(0, ids.indexOf(pin.id))
  const hasPrev = index > 0
  const hasNext = index < ids.length - 1

  const go = useCallback(
    (delta: number) => {
      const target = ids[index + delta]
      if (!target) return
      const s = useStore.getState()
      if (s.pins.find((p) => p.id === target)?.type === 'area') return
      s.selectPin(target)
      s.openDetail(target)
    },
    [ids, index],
  )

  // Focus into the dialog on open, back to the opener on close.
  useLayoutEffect(() => {
    returnFocus.current = document.activeElement
    rootRef.current?.focus()
    return () => {
      const el = returnFocus.current
      if (el instanceof HTMLElement && el.isConnected) el.focus()
    }
  }, [])

  // Back button: one history entry while open. The pop is deferred a microtask so React StrictMode's
  // simulated unmount/remount in dev does not pop the entry it just pushed.
  useEffect(() => {
    live.current = true
    if (!pushed.current) {
      history.pushState({ ptpDetail: true }, '')
      pushed.current = true
    }
    const onPop = () => {
      pushed.current = false
      useStore.getState().openDetail(null)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      live.current = false
      queueMicrotask(() => {
        if (!live.current && pushed.current) {
          pushed.current = false
          history.back()
        }
      })
    }
  }, [])

  const close = () => useStore.getState().openDetail(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
  }

  const onMediaTap = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX - r.left < r.width / 3) go(-1)
    else go(1)
  }

  return (
    <div
      ref={rootRef}
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="detail-head">
        <div className="detail-head__bar">
          <ShellButton icon="ic-close" label="Close" size={46} onClick={close} />
          <p className="detail-head__title">{snap.title}</p>
        </div>
        <div className="detail-head__prog" role="group" aria-label={`Item ${index + 1} of ${ids.length}`}>
          {ids.map((id, i) => (
            <span key={id} className={['detail-seg', i <= index && 'is-done', i === index && 'is-now'].filter(Boolean).join(' ')}>
              <span className="detail-seg__b" />
            </span>
          ))}
        </div>
      </header>
      <div className="detail-media" onClick={onMediaTap}>
        <MapWindow pin={pin} />
        {hasPrev && (
          <button type="button" className="detail-arrow detail-arrow--l" aria-label="Previous" onClick={() => go(-1)}>
            <Icon name="ic-chevL" size={20} />
          </button>
        )}
        {hasNext && (
          <button type="button" className="detail-arrow detail-arrow--r" aria-label="Next" onClick={() => go(1)}>
            <Icon name="ic-chevR" size={20} />
          </button>
        )}
      </div>
      <Sheet pin={pin} now={feed.now} />
    </div>
  )
}

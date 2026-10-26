// Detail view (Agent G). Story-style layout of Figma node 3552:3120 ("Since yesterday"), with the changes
// logged in docs/DECISIONS.md: no timer, no civic rail. Comments added 2026-10-22 (Comments.tsx).
// Layout (2026-10-08): the view sits on the live map, which flies to the pin zoomed in; the card at the bottom
// carries the item's own photo (listing banner or report photo) in the Figma media well. No boxed map window. Never a stand-in stock or Figma photo:
// a picture on a real item tells people "this is what it looks like".
// Card/map window: Figma node 3675:13987. Header/segments: Figma story/header 3547:3210 (left third back, right two thirds forward).
//
// Segments = the feed list as it was when the view opened (snapshot, so a support tap that re-ranks the
// feed does not move you). Left/right, the arrow buttons, taps and the arrow keys move through it. No timers.
// History: opening pushes one history entry; browser/Android back (popstate) closes the view. Closing by
// any other route pops that entry again.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Icon, NeighbourLabel, PlaceLabel, PtpLabel, ShellButton } from '../design/primitives'
import { repo } from '../data'
import { canMerge } from '../lib/merge'
import { isLive } from '../lib/pulse'
import { clock, ago, dayLabel, daysOpen, directionsUrl, eventWhen, offerWhen, openWhatsapp } from '../sheet/format'
import { openPlace } from '../sheet/openPlace'
import { shareText } from '../sheet/PinCard'
import { useFeed } from '../sheet/useFeed'
import { useStore } from '../store'
import type { Filter, Pin } from '../types'
import { trapTab } from '../design/useModal'
import { Comments } from './Comments'
import './detail.css'

const ACTION_LABEL = { civic: 'I see it too', event: "I'm going", ask: 'I can help', offer: "I'm interested", area: '' } as const
const COUNT_WORD = { civic: 'see it', event: 'going', ask: 'can help', offer: 'interested', area: '' } as const
const CHIP_TITLE: Record<Filter, string> = { all: '', civic: 'Issues', event: 'Events', ask: 'Asks', places: 'Places' }
const TYPE_TITLE = { civic: 'Issue', event: 'Event', ask: 'Ask', offer: 'Offer', area: 'Update' } as const

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

/** Posted photos fetched once per pin for this page session (they never change). */
const photoCache = new Map<string, string | null>()

/** A posted photo (pins with hasPhoto), fetched when the detail opens. */
function usePostedPhoto(pin: Pin): string | null {
  const [url, setUrl] = useState(() => photoCache.get(pin.id) ?? null)
  useEffect(() => {
    if (!pin.hasPhoto || photoCache.has(pin.id)) return
    let alive = true
    repo
      .getPhoto(pin.id)
      .then((u) => {
        photoCache.set(pin.id, u)
        if (alive) setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [pin.id, pin.hasPhoto])
  return url
}

/**
 * Figma media well inside the card (card/update "mw"): 7px pressed lip, 20 outer, photo at 14, credit under it.
 * Only the item's own image: the listing banner or report photo, or the photo its poster added (2026-10-23).
 * No image, no well: the card stays text only.
 */
function PhotoWell({ pin }: { pin: Pin }) {
  const [broken, setBroken] = useState(false)
  const posted = usePostedPhoto(pin)
  const src = pin.imageUrl || posted
  // A posted photo's well is drawn at once (fixed height), so the card does not grow when the photo arrives.
  if ((!src && !pin.hasPhoto) || broken) return null
  const credit = pin.imageUrl
    ? (pin.sourceLabel ?? 'Photo')
    : pin.postedAs === 'place'
      ? `Photo by ${pin.placeName || 'the place'}`
      : 'Photo by a neighbour'
  return (
    <figure className="detail-photo">
      <div className="detail-photo__well">
        <div className="detail-photo__inner">
          {src && <img className="detail-photo__img" src={src} alt={`Photo: ${pin.title}`} referrerPolicy="no-referrer" onError={() => setBroken(true)} />}
        </div>
      </div>
      <figcaption className="detail-photo__credit">{credit}</figcaption>
    </figure>
  )
}

function Sheet({ pin, now, sheetRef }: { pin: Pin; now: number; sheetRef: React.RefObject<HTMLDivElement | null> }) {
  const supports = useStore((s) => s.supports)
  const deviceId = useStore((s) => s.deviceId)
  const count = supports.filter((s) => s.pinId === pin.id).length
  const supported = deviceId != null && supports.some((s) => s.pinId === pin.id && s.deviceId === deviceId)
  const place = pin.placeName || streetOf(pin)
  const showPlace = place && !(pin.postedAs === 'place' && place === pin.placeName)
  const days = daysOpen(pin.createdAt, now)
  // Others who posted the same thing here (merged into one marker on the map, lib/merge).
  const pins = useStore((s) => s.pins)
  const similar = pins.filter((p) => canMerge(pin, p) && isLive(p, supports, now)).length
  const toggle = () => {
    repo.toggleSupport(pin.id).catch(() => {})
  }
  // Opened from a map bubble: scroll the card to the comments (the field is not focused, so no keyboard pops up).
  const section = useStore((s) => s.detailSection)
  const commentsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (section === 'comments') commentsRef.current?.scrollIntoView?.({ block: 'start' })
  }, [section, pin.id])
  return (
    <div className="detail-sheet" ref={sheetRef}>
      <div className="detail-sheet__meta">
        <div className="detail-sheet__when">
          {showPlace &&
            (pin.placeId && pin.placeName ? (
              <button
                type="button"
                className="detail-sheet__at"
                aria-label={`Everything at ${pin.placeName}`}
                onClick={() => openPlace({ placeId: pin.placeId!, placeName: pin.placeName!, lat: pin.lat, lng: pin.lng })}
              >
                @ {place}
              </button>
            ) : (
              <span>{place}</span>
            ))}
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
      <PhotoWell key={pin.id} pin={pin} />
      {pin.body && <p className="detail-sheet__body">{pin.body}</p>}
      <div className="detail-sheet__facts">
        {pin.type === 'civic' && <span>{days >= 1 ? `Open ${days === 1 ? '1 day' : `${days} days`}` : 'Opened today'}</span>}
        {pin.type === 'ask' && <span>Asked {ago(pin.createdAt, now).replace(/^Just now$/, 'just now')}</span>}
        {pin.type === 'offer' && <span className="detail-sheet__fact-main">{offerWhen(pin.endsAt, now)}</span>}
        {similar > 0 && <span>{similar === 1 ? '1 more neighbour posted this here' : `${similar} more neighbours posted this here`}</span>}
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
      <Comments key={`comments-${pin.id}`} pinId={pin.id} now={now} sectionRef={commentsRef} />
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
  const headRef = useRef<HTMLElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Fly the real map to this pin, zoomed in, centred between the header and the card. The card's height
  // changes per item (photo or not), so it is measured after layout, every time the item changes.
  useLayoutEffect(() => {
    const root = document.documentElement
    const top = headRef.current?.getBoundingClientRect().bottom ?? 0
    const bottom = sheetRef.current?.offsetHeight ?? 0
    root.style.setProperty('--detail-top', `${Math.round(top)}px`)
    root.style.setProperty('--detail-bottom', `${bottom}px`)
    useStore.getState().requestFlyTo({ lat: pin.lat, lng: pin.lng, zoom: 17 })
  }, [pin.id, pin.lat, pin.lng])
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--detail-top')
      document.documentElement.style.removeProperty('--detail-bottom')
    },
    [],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keyboard focus stays in the dialog (WCAG 2.1.2 / 2.4.3); the map behind still pans by pointer.
    if (e.key === 'Tab' && rootRef.current) trapTab(e, rootRef.current)
    else if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
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
      <header className="detail-head" ref={headRef}>
        <div className="detail-head__bar">
          <ShellButton icon="ic-close" label="Close" size={46} onClick={close} />
          <p className="detail-head__title">{snap.title}</p>
          {/* Stepping with the arrows changes the item: say which one (WCAG 4.1.3). */}
          <p className="sr-only" aria-live="polite">{`Item ${index + 1} of ${ids.length}: ${pin.title}`}</p>
        </div>
        <div className="detail-head__prog" role="group" aria-label={`Item ${index + 1} of ${ids.length}`}>
          {ids.map((id, i) => (
            <span key={id} className={['detail-seg', i <= index && 'is-done', i === index && 'is-now'].filter(Boolean).join(' ')}>
              <span className="detail-seg__b" />
            </span>
          ))}
        </div>
      </header>
      {/* The live map shows through here, flown to the pin. Arrows step through the list. */}
      <div className="detail-band">
        {hasPrev && (
          <button type="button" className="detail-arrow detail-arrow--l" aria-label="Previous item" onClick={() => go(-1)}>
            <Icon name="ic-chevL" size={20} />
          </button>
        )}
        {hasNext && (
          <button type="button" className="detail-arrow detail-arrow--r" aria-label="Next item" onClick={() => go(1)}>
            <Icon name="ic-chevR" size={20} />
          </button>
        )}
      </div>
      <Sheet pin={pin} now={feed.now} sheetRef={sheetRef} />
    </div>
  )
}

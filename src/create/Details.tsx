// Details step: type tiles, title, event day + time, Post. Everyone posts as Neighbour. The one exception
// (DECISIONS.md 2026-10-22): a device holding an ACTIVE claim on this spot's place gets a "Post as" choice, and as
// the place it posts an Offer (with a last day) or an Event. The repo and the rules check the claim again.
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { repo } from '../data'
import { Button, Chip, Field, Grabber, Icon } from '../design/primitives'
import { canPostAsPlace, offerEndsAt, type OfferEnd } from '../lib/claims'
import { shrinkPhoto } from '../lib/photo'
import { useStore } from '../store'
import { dateValue, buildStartsAt, postBlocker, PLACEHOLDER, TITLE_MAX, TYPE_LABEL, type CreateType, type Day } from './logic'
import { lookupNearest } from './nearby'

const TILES: { type: CreateType; icon: string }[] = [
  { type: 'civic', icon: 'ic-warn' },
  { type: 'event', icon: 'ic-gather' },
  { type: 'ask', icon: 'ic-bubble' },
]
const PLACE_TILES: { type: CreateType; icon: string }[] = [
  { type: 'offer', icon: 'ic-heart' },
  { type: 'event', icon: 'ic-gather' },
]

export function Details({ onBack, onPosted, fromPlacing }: { onBack: () => void; onPosted: () => void; fromPlacing: boolean }) {
  const create = useStore((s) => s.create)
  const places = useMapsLibrary('places')
  const canPlace = useStore((s) => canPostAsPlace(s.create.placeId, s.deviceId, s.claims))
  const [asPlace, setAsPlace] = useState(() => create.asPlace)
  const placeMode = asPlace && canPlace
  const [end, setEnd] = useState<OfferEnd>('week')
  const [type, setType] = useState<CreateType | null>(null)
  // Optional photo: shrunk on the phone as soon as it is picked (DECISIONS.md 2026-10-23).
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<'idle' | 'preparing' | 'failed'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    setPhotoState('preparing')
    shrinkPhoto(file)
      .then((url) => {
        setPhoto(url)
        setPhotoState('idle')
      })
      .catch(() => setPhotoState('failed'))
  }
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<Day>('today')
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Clock for the 'time has passed' check; refreshed whenever the user edits day or time.
  const [now, setNow] = useState(() => Date.now())
  const blocker = postBlocker({ type, title, day, dateStr, timeStr, end, asPlace: placeMode }, now)
  const pickPoster = (place: boolean) => {
    setAsPlace(place)
    if (type && !(place ? PLACE_TILES : TILES).some((t) => t.type === type)) setType(null)
  }

  // Long-press entry: no place yet. ONE nearby lookup for that spot (never repeated).
  const looked = useRef<string | null>(null)
  useEffect(() => {
    const at = create.at
    if (!places || !at || fromPlacing || create.placeId || create.placeName) return
    const key = `${at.lat},${at.lng}`
    if (looked.current === key) return
    looked.current = key
    void lookupNearest(places, at).then((p) => {
      const cur = useStore.getState().create
      if (p && cur.step === 'details' && cur.at && cur.at.lat === at.lat && cur.at.lng === at.lng)
        useStore.getState().confirmSpot(at, { placeId: p.placeId, placeName: p.placeName })
    })
  }, [places, create.at, create.placeId, create.placeName, fromPlacing])

  const today = useMemo(() => dateValue(new Date(now)), [now])

  // The "+ Pin" button that had focus is gone: move focus into the sheet (WCAG 2.4.3). Escape steps back.
  const sheetRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => sheetRef.current?.focus(), [])

  const post = async () => {
    if (blocker || !type || !create.at || busy) return
    setBusy(true)
    setError(null)
    try {
      const startsAt = type === 'event' ? buildStartsAt(day, dateStr, timeStr, Date.now()) : null
      const endsAt = type === 'offer' ? offerEndsAt(end, dateStr, Date.now()) : null
      const pin = await repo.createPin({
        type,
        title: title.trim(),
        lat: create.at.lat,
        lng: create.at.lng,
        placeId: create.placeId,
        placeName: create.placeName,
        startsAt,
        ...(endsAt != null ? { endsAt } : {}),
        ...(placeMode ? { asPlace: true } : {}),
        ...(photo ? { photo } : {}),
      })
      const s = useStore.getState()
      s.cancelCreate()
      s.setSheetHeight('half')
      s.selectPin(pin.id)
      onPosted()
      // Let the sheet finish rising to half before the map centres the pin in the visible band.
      setTimeout(() => useStore.getState().requestFlyTo({ lat: pin.lat, lng: pin.lng }), 300)
    } catch (e) {
      setError(`Could not post: ${e instanceof Error ? e.message : 'something went wrong'}. Your text is kept, try again.`)
      setBusy(false)
    }
  }

  return (
    <div
      className="ptp-sheet create-sheet"
      role="dialog"
      aria-label="New pin"
      data-testid="create-sheet"
      ref={sheetRef}
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && onBack()}
    >
      <div className="create-sheet__grab">
        <Grabber />
      </div>
      <div className="create-sheet__head">
        <Button onClick={onBack} icon="ic-chevL" aria-label="Back" />
        <div className="create-sheet__spot">
          <Icon name="ic-location" size={20} />
          <span data-testid="create-spot">{create.placeName ?? 'Unnamed spot'}</span>
        </div>
      </div>

      {canPlace && (
        <div className="create-block">
          <span className="create-label">Post as</span>
          <div className="create-chips" role="radiogroup" aria-label="Post as">
            <Chip role="radio" selected={!placeMode} onClick={() => pickPoster(false)}>
              Neighbour
            </Chip>
            <Chip role="radio" selected={placeMode} onClick={() => pickPoster(true)}>
              {create.placeName}
            </Chip>
          </div>
        </div>
      )}

      <div className="create-block">
        <h2 className="create-h">What is it?</h2>
        <div className="create-tiles" role="radiogroup" aria-label="Type">
          {(placeMode ? PLACE_TILES : TILES).map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={type === t.type}
              className="create-tile"
              onClick={() => setType(t.type)}
            >
              <Icon name={t.icon} size={28} />
              {TYPE_LABEL[t.type]}
            </button>
          ))}
        </div>
      </div>

      {type && (
        <div className="create-block">
          <label className="create-label" htmlFor="create-title">
            Title
          </label>
          <Field
            id="create-title"
            value={title}
            maxLength={TITLE_MAX}
            placeholder={PLACEHOLDER[type]}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            aria-describedby={blocker ? 'create-blocker' : undefined}
          />
          {/* Why Post is disabled, read while typing; on screen it is the Post button's own text, so sr-only here. */}
          {blocker && (
            <p id="create-blocker" className="sr-only">
              {blocker}
            </p>
          )}
        </div>
      )}

      {type === 'event' && (
        <div className="create-block">
          <span className="create-label">When</span>
          <div className="create-chips" role="radiogroup" aria-label="Day">
            <Chip role="radio" selected={day === 'today'} onClick={() => (setNow(Date.now()), setDay('today'))}>
              Today
            </Chip>
            <Chip role="radio" selected={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>
              Tomorrow
            </Chip>
            <Chip role="radio" selected={day === 'date'} onClick={() => setDay('date')}>
              Pick a date
            </Chip>
          </div>
          <div className="create-when">
            {day === 'date' && (
              <Field type="date" aria-label="Date" min={today} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            )}
            <Field type="time" aria-label="Time" value={timeStr} onChange={(e) => (setNow(Date.now()), setTimeStr(e.target.value))} />
          </div>
        </div>
      )}

      {type === 'offer' && (
        <div className="create-block">
          <span className="create-label">Last day</span>
          <div className="create-chips" role="radiogroup" aria-label="Last day">
            <Chip role="radio" selected={end === 'today'} onClick={() => (setNow(Date.now()), setEnd('today'))}>
              Today
            </Chip>
            <Chip role="radio" selected={end === 'week'} onClick={() => setEnd('week')}>
              In a week
            </Chip>
            <Chip role="radio" selected={end === 'date'} onClick={() => setEnd('date')}>
              Pick a date
            </Chip>
          </div>
          {end === 'date' && (
            <div className="create-when">
              <Field type="date" aria-label="Last day" min={today} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
          )}
          <p className="create-hint">Marked “Offer” for neighbours, and shown a little below their posts.</p>
        </div>
      )}

      {type && (
        <div className="create-block">
          <span className="create-label">Photo (optional)</span>
          {photo ? (
            <div className="create-photo">
              <img className="create-photo__img" src={photo} alt="Your photo" />
              <Button variant="quiet" icon="ic-trash" onClick={() => setPhoto(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <Button
              variant="quiet"
              icon="ic-camera"
              disabled={photoState === 'preparing'}
              onClick={() => fileRef.current?.click()}
            >
              {photoState === 'preparing' ? 'Preparing photo' : 'Add photo'}
            </Button>
          )}
          {/* The phone offers the camera or the gallery. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            data-testid="create-photo-input"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {photoState === 'failed' && (
            <p className="create-hint" role="alert">
              That photo could not be read. Try another one.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="create-error" role="alert">
          {error}
        </p>
      )}

      <Button variant="primary" size="big" fill disabled={!!blocker || busy || photoState === 'preparing'} onClick={post}>
        {blocker ?? (busy ? 'Posting' : photoState === 'preparing' ? 'Preparing photo' : 'Post')}
      </Button>
    </div>
  )
}

// Details step: type tiles, title, event day + time, Post. Users post as Neighbour only (repo forces it);
// there is deliberately no poster choice here.
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useRef, useState } from 'react'
import { repo } from '../data'
import { Button, Chip, Field, Grabber, Icon } from '../design/primitives'
import { useStore } from '../store'
import { dateValue, buildStartsAt, postBlocker, PLACEHOLDER, TITLE_MAX, TYPE_LABEL, type CreateType, type Day } from './logic'
import { lookupNearest } from './nearby'

const TILES: { type: CreateType; icon: string }[] = [
  { type: 'civic', icon: 'ic-warn' },
  { type: 'event', icon: 'ic-gather' },
  { type: 'ask', icon: 'ic-bubble' },
]

export function Details({ onBack, onPosted, fromPlacing }: { onBack: () => void; onPosted: () => void; fromPlacing: boolean }) {
  const create = useStore((s) => s.create)
  const places = useMapsLibrary('places')
  const [type, setType] = useState<CreateType | null>(null)
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<Day>('today')
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Clock for the 'time has passed' check; refreshed whenever the user edits day or time.
  const [now, setNow] = useState(() => Date.now())
  const blocker = postBlocker({ type, title, day, dateStr, timeStr }, now)

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

  const post = async () => {
    if (blocker || !type || !create.at || busy) return
    setBusy(true)
    setError(null)
    try {
      const startsAt = type === 'event' ? buildStartsAt(day, dateStr, timeStr, Date.now()) : null
      const pin = await repo.createPin({
        type,
        title: title.trim(),
        lat: create.at.lat,
        lng: create.at.lng,
        placeId: create.placeId,
        placeName: create.placeName,
        startsAt,
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
    <div className="ptp-sheet create-sheet" role="dialog" aria-label="New pin" data-testid="create-sheet">
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

      <div className="create-block">
        <h2 className="create-h">What is it?</h2>
        <div className="create-tiles" role="radiogroup" aria-label="Type">
          {TILES.map((t) => (
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
          />
        </div>
      )}

      {type === 'event' && (
        <div className="create-block">
          <span className="create-label">When</span>
          <div className="create-chips" role="radiogroup" aria-label="Day">
            <Chip selected={day === 'today'} onClick={() => (setNow(Date.now()), setDay('today'))}>
              Today
            </Chip>
            <Chip selected={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>
              Tomorrow
            </Chip>
            <Chip selected={day === 'date'} onClick={() => setDay('date')}>
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

      {error && (
        <p className="create-error" role="alert">
          {error}
        </p>
      )}

      <Button variant="primary" size="big" fill disabled={!!blocker || busy} onClick={post}>
        {blocker ?? (busy ? 'Posting' : 'Post')}
      </Button>
    </div>
  )
}

// Feed card, Figma card/update + card/event anatomy (docs/figma/SPEC.md section 1):
// meta row (place left, distance or date right), title, when row (events), one action with its count beside it,
// and a source line at the foot. Never renders a user name: Neighbour / the place / Push The Pin only.
import { memo, type MouseEvent } from 'react'
import { Button, Icon, ShellButton } from '../design/primitives'
import { formatDistance } from '../lib/geo'
import { repo } from '../data'
import { useStore } from '../store'
import type { LatLng, Pin } from '../types'
import { clock, dayLabel, eventWhen, openWhatsapp } from './format'

const ACTION_LABEL = { civic: 'I see it too', event: "I'm going", ask: 'I can help', area: '' } as const
const ACTION_ICON = { civic: 'ic-checkcircle', event: 'calendar-check-off', ask: 'ic-bubble', area: 'ic-check' } as const

export function countText(pin: Pin, n: number): string | null {
  if (pin.type === 'ask') return n === 0 ? 'No replies yet' : n === 1 ? '1 can help' : `${n} can help`
  if (n === 0) return null
  if (pin.type === 'event') return `${n} going`
  return n === 1 ? '1 neighbour sees it' : `${n} neighbours see it`
}

/** Posted time for civic and asks: "Today, 6:10pm" within two days, else "27 Aug". Never elapsed time (Figma). */
export function postedText(pin: Pin, now: number): string {
  if (now - pin.createdAt < 2 * 60_000) return 'Just now' // PRD "Creating a pin" step 6
  const label = dayLabel(pin.createdAt, now)
  return label === 'Today' || label === 'Yesterday' ? `${label}, ${clock(pin.createdAt)}` : label
}

export function whenText(pin: Pin, now: number): string {
  if (pin.type === 'event' && pin.startsAt != null)
    return now - pin.createdAt < 2 * 60_000 ? `Just now · ${eventWhen(pin.startsAt, now)}` : eventWhen(pin.startsAt, now)
  return postedText(pin, now)
}

export function shareText(pin: Pin, now: number): string {
  const lines = [pin.title, [whenText(pin, now), pin.placeName].filter(Boolean).join(', '), `Push The Pin, ${location.origin}`]
  return lines.join('\n')
}

function SourceLine({ pin }: { pin: Pin }) {
  if (pin.postedAs === 'neighbour')
    return (
      <div className="sheet-card__source">
        <Icon name="source-dot-ink25" size={6} tint={false} />
        Neighbour
      </div>
    )
  const words = pin.postedAs === 'place' ? 'Posted by the place' : pin.sourceLabel ?? 'Push The Pin'
  return (
    <div className="sheet-card__source">
      <Icon name="source-dot-orange" size={6} tint={false} />
      {pin.sourceUrl ? (
        <a href={pin.sourceUrl} target="_blank" rel="noopener noreferrer">
          {words}
        </a>
      ) : (
        words
      )}
    </div>
  )
}

interface Props {
  pin: Pin
  origin: LatLng
  now: number
  /** Total supports for this pin (a social count; ranking uses 7 day supports). */
  count: number
  supported: boolean
  highlighted?: boolean
}

export const PinCard = memo(function PinCard({ pin, origin, now, count, supported, highlighted }: Props) {
  const open = () => {
    const s = useStore.getState()
    s.selectPin(pin.id, { fly: true })
    s.openDetail(pin.id)
  }
  const onCardClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    open()
  }
  const toggle = () => {
    repo.toggleSupport(pin.id).catch(() => {})
  }
  const where = pin.placeName ?? 'Bandra West'
  const right = pin.type === 'event' ? formatDistance(origin, pin) : postedText(pin, now)
  const counted = countText(pin, count)

  return (
    <article
      className={['ptp-card', 'sheet-card', highlighted && 'is-highlighted'].filter(Boolean).join(' ')}
      data-pin-id={pin.id}
      onClick={onCardClick}
    >
      <div className="sheet-card__meta">
        <span className="sheet-card__where">
          <span className="sheet-card__where-name">{where}</span>
          {pin.postedAs === 'place' && <Icon name="verified" size={15} tint={false} />}
        </span>
        <span className="sheet-card__right">{right}</span>
      </div>
      <h3 className="sheet-card__title">
        <button type="button" className="sheet-card__open" onClick={open}>
          {pin.title}
        </button>
      </h3>
      {pin.type === 'event' && pin.startsAt != null && (
        <div className="sheet-card__when">
          <Icon name="calendar-when" size={18} tint={false} />
          {whenText(pin, now)}
        </div>
      )}
      {pin.type === 'civic' && pin.body && <p className="sheet-card__body">{pin.body}</p>}
      <div className="sheet-card__actions">
        <Button variant={supported ? 'soft' : 'quiet'} pressed={supported} icon={ACTION_ICON[pin.type]} onClick={toggle}>
          {ACTION_LABEL[pin.type]}
        </Button>
        <span className="sheet-card__count">{counted}</span>
        <ShellButton icon="ic-whatsapp" label="Share on WhatsApp" variant="quiet" onClick={() => openWhatsapp(shareText(pin, now))} />
      </div>
      <SourceLine pin={pin} />
    </article>
  )
})

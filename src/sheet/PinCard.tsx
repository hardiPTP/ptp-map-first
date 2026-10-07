// Feed card. PRD "Pin types and the card": poster+type+walk, title, when, place, one action + WhatsApp.
// Never renders a user name: poster labels only (Neighbour / Place / Push The Pin).
import { memo, type MouseEvent } from 'react'
import { Button, Card, Icon, NeighbourLabel, PlaceLabel, PtpLabel, ShellButton } from '../design/primitives'
import { formatWalk, walkMin } from '../lib/geo'
import { repo } from '../data'
import { useStore } from '../store'
import type { LatLng, Pin } from '../types'
import { ago, daysOpen, directionsUrl, eventWhen, openWhatsapp } from './format'

const TYPE_LABEL = { civic: 'Issue', event: 'Event', ask: 'Ask', area: 'Update' } as const
const ACTION_LABEL = { civic: 'I see it too', event: "I'm going", ask: 'I can help', area: '' } as const
const COUNT_WORD = { civic: 'see it', event: 'going', ask: 'can help', area: '' } as const

/** Nearest street: the data model has no street field, so it is only shown if a pin carries one. */
function streetOf(pin: Pin): string | null {
  const s = (pin as Pin & { street?: string | null }).street
  return s || null
}

export function whenText(pin: Pin, now: number): string {
  // PRD "Creating a pin" 6: a new card reads "Just now"; events keep their start time after it.
  if (pin.type === 'event' && pin.startsAt != null)
    return now - pin.createdAt < 2 * 60_000 ? `Just now · ${eventWhen(pin.startsAt, now)}` : eventWhen(pin.startsAt, now)
  return ago(pin.createdAt, now)
}

export function shareText(pin: Pin, now: number): string {
  const where = pin.placeName || streetOf(pin)
  const lines = [pin.title, [whenText(pin, now), where].filter(Boolean).join(', '), `Push The Pin, ${location.origin}`]
  return lines.join('\n')
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
  const walk = formatWalk(walkMin(origin, pin))
  const where = pin.placeName || streetOf(pin)
  const showWhere = where && !(pin.postedAs === 'place' && where === pin.placeName)
  const open_ = pin.type === 'civic' ? daysOpen(pin.createdAt, now) : 0

  return (
    <Card
      as="article"
      edge={pin.postedAs === 'ptp' ? 'ptp' : undefined}
      className={['sheet-card', highlighted && 'is-highlighted'].filter(Boolean).join(' ')}
      data-pin-id={pin.id}
      onClick={onCardClick}
    >
      <div className="sheet-card__head">
        <div className="sheet-card__poster">
          {pin.postedAs === 'place' ? (
            <PlaceLabel name={pin.placeName || 'Place'} photoUri={pin.placePhotoUri} />
          ) : pin.postedAs === 'ptp' ? (
            <PtpLabel />
          ) : (
            <NeighbourLabel style="line" />
          )}
        </div>
        <span className="sheet-card__type">
          · {TYPE_LABEL[pin.type]} · {walk}
        </span>
      </div>
      <h3 className="sheet-card__title">
        <button type="button" className="sheet-card__open" onClick={open}>
          {pin.title}
        </button>
      </h3>
      <div className="sheet-card__when">
        <span className="sheet-card__when-main">
          {pin.type === 'event' && <Icon name="calendar-when" size={18} tint={false} />}
          {whenText(pin, now)}
        </span>
        {pin.type === 'civic' && open_ >= 1 && (
          <span className="sheet-card__extra">Open {open_ === 1 ? '1 day' : `${open_} days`}</span>
        )}
        {pin.type === 'event' && (
          <a className="sheet-card__link" href={directionsUrl(pin)} target="_blank" rel="noopener noreferrer">
            <Icon name="ic-directions" size={16} />
            Directions
          </a>
        )}
      </div>
      {showWhere && <div className="sheet-card__place">{where}</div>}
      <div className="sheet-card__actions">
        <Button variant={supported ? 'soft' : 'quiet'} pressed={supported} icon="ic-checkcircle" onClick={toggle}>
          {ACTION_LABEL[pin.type]}
        </Button>
        <span className="sheet-card__count">
          {count} {COUNT_WORD[pin.type]}
        </span>
        <ShellButton
          icon="ic-whatsapp"
          label="Share on WhatsApp"
          variant="quiet"
          onClick={() => openWhatsapp(shareText(pin, now))}
        />
      </div>
    </Card>
  )
})

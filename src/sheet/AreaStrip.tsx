// Notices from Push The Pin, at the top of Pulse. Figma "source" rule: a confirmed source is a 6px orange dot and
// grey words, never a coloured edge, so a run of notices reads as small dots, not orange lines.
// One well row per notice (icon, fact, when, source line). Max 3, "+N more". Tap a row: tint the area, offer share.
import { useMemo, useState } from 'react'
import { Button, Icon } from '../design/primitives'
import { distanceM } from '../lib/geo'
import { isLive } from '../lib/pulse'
import { BANDRA_WEST, useStore } from '../store'
import type { AreaTopic, LatLng, Pin, Support } from '../types'
import { areaWhen, isExtended, openWhatsapp } from './format'

const TOPIC_ICON: Record<AreaTopic, string> = {
  water: 'ic-droplet',
  power: 'ic-bulb',
  traffic: 'ic-warn',
  road: 'ic-footpath',
  festival: 'calendar-when',
}
const MAX_ROWS = 3

/** Live area updates covering the origin or the masthead area (centre of Bandra West). */
export function activeAreaUpdates(pins: Pin[], supports: Support[], origin: LatLng, now: number): Pin[] {
  return pins
    .filter((p) => p.type === 'area' && isLive(p, supports, now))
    .filter((p) => {
      const r = p.radiusM ?? 0
      return distanceM(origin, p) <= r || distanceM(BANDRA_WEST, p) <= r
    })
    .sort((a, b) => (a.startsAt ?? a.createdAt) - (b.startsAt ?? b.createdAt))
}

const dayMonth = (t: number) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(t)

/** Multi-day notices read as a date range; same-day ones keep the clock times. */
function noticeWhen(p: Pin, now: number): string {
  if (p.startsAt != null && p.endsAt != null && p.endsAt - p.startsAt > 24 * 3600_000) {
    return p.startsAt <= now ? `Until ${dayMonth(p.endsAt)}` : `${dayMonth(p.startsAt)} to ${dayMonth(p.endsAt)}`
  }
  return areaWhen(p, now)
}

export function AreaStrip({ origin, now }: { origin: LatLng; now: number }) {
  const pins = useStore((s) => s.pins)
  const supports = useStore((s) => s.supports)
  const selectedAreaId = useStore((s) => s.selectedAreaId)
  const selectArea = useStore((s) => s.selectArea)
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => activeAreaUpdates(pins, supports, origin, now), [pins, supports, origin, now])
  if (rows.length === 0) return null
  const shown = expanded ? rows : rows.slice(0, MAX_ROWS)
  const more = rows.length - shown.length

  return (
    <section className="sheet-notices" aria-label="Notices for this area">
      <ul className="sheet-notices__list">
        {shown.map((p) => {
          const selected = selectedAreaId === p.id
          const when = noticeWhen(p, now)
          return (
            <li key={p.id}>
              <button
                type="button"
                className={['sheet-notice', selected && 'is-selected'].filter(Boolean).join(' ')}
                aria-pressed={selected}
                onClick={() => selectArea(selected ? null : p.id)}
              >
                <Icon name={TOPIC_ICON[p.topic ?? 'road']} size={18} />
                <span className="sheet-notice__text">
                  <span className="sheet-notice__title">
                    {p.title}
                    <span className="sheet-notice__when">
                      {', '}
                      {when}
                      {isExtended(p) && ' (extended)'}
                    </span>
                  </span>
                  <span className="sheet-notice__source">
                    <Icon name="source-dot-orange" size={6} tint={false} />
                    Push The Pin{p.sourceLabel ? `, ${p.sourceLabel.toLowerCase()}` : ''}
                  </span>
                </span>
              </button>
              {selected && (
                <div className="sheet-notice__more">
                  {p.body && <p className="sheet-notice__body">{p.body}</p>}
                  <div className="sheet-notice__actions">
                    <Button variant="quiet" icon="ic-whatsapp" onClick={() => openWhatsapp(`${p.title}, ${when}\n${p.body ?? ''}\nPush The Pin`)}>
                      Share
                    </Button>
                    {p.sourceUrl && (
                      <a className="sheet-notice__link" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Source
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {more > 0 && (
        <button type="button" className="sheet-notices__more" onClick={() => setExpanded(true)}>
          {more} more {more === 1 ? 'notice' : 'notices'}
        </button>
      )}
    </section>
  )
}

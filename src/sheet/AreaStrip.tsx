// "In your area" strip. PRD "Area updates": PTP mark + accent orange edge, max 3 rows, "+N more",
// tap a row to tint the area on the map and offer Share on WhatsApp.
import { useMemo, useState } from 'react'
import { Button, Card, Icon, PtpLabel } from '../design/primitives'
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
    <Card as="div" edge="ptp" className="sheet-area" aria-label="In your area">
      <div className="sheet-area__head">
        <PtpLabel />
        <span className="sheet-area__head-sub">In your area</span>
      </div>
      <ul className="sheet-area__list">
        {shown.map((p) => {
          const selected = selectedAreaId === p.id
          const when = areaWhen(p, now)
          const text = [p.title, when, isExtended(p) ? 'Extended' : ''].filter(Boolean).join('\n')
          return (
            <li key={p.id}>
              <button
                type="button"
                className={['sheet-area__row', selected && 'is-selected'].filter(Boolean).join(' ')}
                aria-pressed={selected}
                onClick={() => selectArea(selected ? null : p.id)}
              >
                <span className="sheet-area__icon">
                  <Icon name={TOPIC_ICON[p.topic ?? 'road']} size={20} />
                </span>
                <span className="sheet-area__text">
                  <span className="sheet-area__title">{p.title}</span>
                  <span className="sheet-area__when">
                    {when}
                    {isExtended(p) && <span className="sheet-area__ext">Extended</span>}
                  </span>
                </span>
              </button>
              {selected && (
                <div className="sheet-area__share">
                  <Button variant="quiet" icon="ic-whatsapp" onClick={() => openWhatsapp(`${text}\nPush The Pin, Bandra West`)}>
                    Share on WhatsApp
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {more > 0 && (
        <button type="button" className="sheet-area__more" onClick={() => setExpanded(true)}>
          +{more} more
        </button>
      )}
    </Card>
  )
}

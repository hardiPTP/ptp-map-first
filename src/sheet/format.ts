// Plain local-time formatting for cards and the area strip. No date library, no timers.
import type { Pin } from '../types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** "Just now" under a minute, "5 min ago", "1 hr ago", "2 hrs ago", "3 days ago". */
export function ago(ts: number, now: number): string {
  const d = Math.max(0, now - ts)
  if (d < MIN) return 'Just now'
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`
  if (d < DAY) {
    const h = Math.floor(d / HOUR)
    return h === 1 ? '1 hr ago' : `${h} hrs ago`
  }
  const days = Math.floor(d / DAY)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** Whole days a pin has been open (0 when under a day). */
export function daysOpen(createdAt: number, now: number): number {
  return Math.floor(Math.max(0, now - createdAt) / DAY)
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Whole calendar days from `now` to `ts` in local time. */
function dayDiff(ts: number, now: number): number {
  return Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
}

/** "Today", "Tomorrow", "Yesterday", "Sat" within a week, else "12 Oct". */
export function dayLabel(ts: number, now: number): string {
  const diff = dayDiff(ts, now)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(ts)
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(ts)
}

/** Event clock: "5pm", "5:30pm". */
export function clock(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`
}

/** Area-update clock: "10 AM", "6:30 PM". */
export function clockCaps(ts: number): string {
  return clock(ts).replace(/(am|pm)$/, (s) => ' ' + s.toUpperCase())
}

/** "Today, 5pm" */
export function eventWhen(startsAt: number, now: number): string {
  return `${dayLabel(startsAt, now)}, ${clock(startsAt)}`
}

/** "Tomorrow, 10 AM to 6 PM", or "Today, until 6 PM" when there is no start time. */
export function areaWhen(pin: Pin, now: number): string {
  const end = pin.endsAt
  const start = pin.startsAt
  if (end == null && start == null) return ''
  if (start != null && end != null) {
    if (dayDiff(start, now) === dayDiff(end, now)) return `${dayLabel(start, now)}, ${clockCaps(start)} to ${clockCaps(end)}`
    return `${dayLabel(start, now)}, ${clockCaps(start)} to ${dayLabel(end, now)}, ${clockCaps(end)}`
  }
  if (end != null) return `${dayLabel(end, now)}, until ${clockCaps(end)}`
  return `From ${dayLabel(start as number, now)}, ${clockCaps(start as number)}`
}

export function isExtended(pin: Pin): boolean {
  return pin.endsAt != null && pin.endsAtOriginal != null && pin.endsAt > pin.endsAtOriginal
}

/**
 * Google Maps URLs, directions: https://developers.google.com/maps/documentation/urls/get-started
 * api=1 is required; destination_place_id needs the destination text parameter too.
 */
export function directionsUrl(pin: Pin): string {
  const dest = pin.placeName ? `${pin.placeName}` : `${pin.lat},${pin.lng}`
  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`
  if (pin.placeId) url += `&destination_place_id=${encodeURIComponent(pin.placeId)}`
  return url
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function openWhatsapp(text: string): void {
  window.open(whatsappUrl(text), '_blank', 'noopener')
}

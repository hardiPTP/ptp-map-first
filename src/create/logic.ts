// Pure helpers for the create flow (no Google, no store): validation, event time, placeholders.
export type CreateType = 'civic' | 'event' | 'ask'
export type Day = 'today' | 'tomorrow' | 'date'

export const TITLE_MIN = 3
export const TITLE_MAX = 120

/** Per-type example placeholders, verbatim from PRD "Pin types and the card". */
export const PLACEHOLDER: Record<CreateType, string> = {
  civic: 'Hawkers back on the footpath outside no. 42',
  event: 'Watercolour class for beginners, Sat 5pm',
  ask: 'Need someone to water plants for 3 days',
}

export const TYPE_LABEL: Record<CreateType, string> = { civic: 'Issue', event: 'Event', ask: 'Ask' }

const pad = (n: number) => String(n).padStart(2, '0')
/** Local date as yyyy-mm-dd, the value format of <input type="date">. */
export function dateValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Epoch ms of the chosen day + "HH:MM" in the device's local time zone, or null if incomplete. */
export function buildStartsAt(day: Day, dateStr: string, timeStr: string, now: number): number | null {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null
  const base = new Date(now)
  let ymd: string
  if (day === 'today') ymd = dateValue(base)
  else if (day === 'tomorrow') ymd = dateValue(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1))
  else ymd = dateStr
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm).getTime()
}

export interface Draft {
  type: CreateType | null
  title: string
  day: Day
  dateStr: string
  timeStr: string
}

/** Why Post is disabled, or null when it can go. Figma button: "a disabled button says why". */
export function postBlocker(d: Draft, now: number): string | null {
  if (!d.type) return 'Choose Issue, Event or Ask'
  if (d.title.trim().length < TITLE_MIN) return 'Add a title, 3 letters or more'
  if (d.type === 'event') {
    if (d.day === 'date' && !d.dateStr) return 'Pick a date'
    const at = buildStartsAt(d.day, d.dateStr, d.timeStr, now)
    if (at == null) return 'Pick a time'
    if (at < now) return 'Pick a time that has not passed'
  }
  return null
}

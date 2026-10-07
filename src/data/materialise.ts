// Turns the offset-based seed (seed.generated.json) into concrete Pins and Supports for a given "now".
import type { Pin, Support } from '../types.ts'
import type { RelTime, SeedFile } from './seedTypes.ts'

const MIN = 60_000
const DAY = 24 * 60 * MIN
const IST = 330 * MIN // India has no DST, so a fixed offset is exact.

export function resolveTime(t: RelTime, now: number): number {
  if ('min' in t) return now + t.min * MIN
  const istNow = now + IST
  const midnightIst = Math.floor(istNow / DAY) * DAY // start of today in IST, as shifted-UTC
  const dow = new Date(istNow).getUTCDay() // 0 = Sunday
  let days = 0
  if (t.day === 'tomorrow') days = 1
  else if (t.day === 'sat' || t.day === 'sun') {
    const target = t.day === 'sat' ? 6 : 0
    days = (target - dow + 7) % 7
  }
  const at = midnightIst + days * DAY + (t.h * 60 + (t.m ?? 0)) * MIN - IST
  // A weekend slot that already passed today moves to next week.
  return at < now && (t.day === 'sat' || t.day === 'sun') ? at + 7 * DAY : at
}

const QUARTER = 15 * MIN

/** Minutes past midnight IST for an epoch ms. */
function istMinuteOfDay(t: number): number {
  return Math.floor(((t + IST) % DAY) / MIN)
}

/**
 * Relative ("in 90 min") event slots are anchored to whenever the seed runs, which gives odd clock
 * times ("12:05am"). Snap future relative starts up to the quarter hour, and move starts that land
 * in the quiet hours (22:00 to 06:30 IST) to the next morning, keeping order and duration.
 * Lead fix at Gate 1, logged in docs/DECISIONS.md.
 */
export function tidyRelativeSlot(start: number, end: number | null, now: number): { start: number; end: number | null } {
  if (start <= now) return { start, end }
  const dur = end != null ? end - start : null
  let s = Math.ceil(start / QUARTER) * QUARTER
  const m = istMinuteOfDay(s)
  if (m >= 22 * 60 || m < 6 * 60 + 30) {
    const minutesAhead = (s - now) / MIN // keeps relative order between seeded slots
    const nextMorning = s + ((m >= 22 * 60 ? 24 * 60 - m : 0) + 7 * 60 - (m >= 22 * 60 ? 0 : m)) * MIN
    s = nextMorning + Math.min(180, Math.round(minutesAhead / 15) * 15) * MIN
  }
  return { start: s, end: dur != null ? s + dur : null }
}

export function materialise(seed: SeedFile, now: number): { pins: Pin[]; supports: Support[] } {
  const supports: Support[] = seed.supports.map((s) => ({
    id: `${s.pinId}_${s.deviceId}`,
    pinId: s.pinId,
    deviceId: s.deviceId,
    createdAt: now + s.createdAtMin * MIN,
  }))
  const lastByPin = new Map<string, number>()
  for (const s of supports) lastByPin.set(s.pinId, Math.max(lastByPin.get(s.pinId) ?? 0, s.createdAt))
  const pins: Pin[] = seed.pins.map((p) => {
    const { createdAtMin, startsAt, endsAt, endsAtOriginal, ...rest } = p
    let start = startsAt ? resolveTime(startsAt, now) : null
    let end = endsAt ? resolveTime(endsAt, now) : null
    if (p.type === 'event' && start != null && startsAt && 'min' in startsAt) {
      ;({ start, end } = tidyRelativeSlot(start, end, now))
    } else {
      if (startsAt && 'min' in startsAt && start != null) start = Math.round(start / QUARTER) * QUARTER
      if (endsAt && 'min' in endsAt && end != null) end = Math.round(end / QUARTER) * QUARTER
    }
    return {
      ...rest,
      createdAt: now + createdAtMin * MIN,
      startsAt: start,
      endsAt: end,
      endsAtOriginal: endsAtOriginal
        ? 'min' in endsAtOriginal
          ? Math.round(resolveTime(endsAtOriginal, now) / QUARTER) * QUARTER
          : resolveTime(endsAtOriginal, now)
        : null,
      lastSupportAt: lastByPin.get(p.id) ?? null,
    }
  })
  return { pins, supports }
}
